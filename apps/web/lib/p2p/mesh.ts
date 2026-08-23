import { type DcEnvelope, dcEnvelopeSchema, type WsEnvelope } from "@meownow/protocol";
import { isHostCandidate, isLanPair, STUN_URLS } from "./lan";
import { planRtcSignal } from "./mesh-signal";
import type { PeerLink } from "./send";

export class Mesh {
	private readonly peers = new Map<
		string,
		{
			pc: RTCPeerConnection;
			channel: RTCDataChannel | null;
			hostLocal: boolean;
			hostRemote: boolean;
		}
	>();
	private readonly starting = new Set<string>();
	private readonly chain = new Map<string, Promise<void>>();
	private lan = false;

	constructor(
		private readonly selfId: string,
		private readonly signal: (envelope: WsEnvelope) => void,
		private readonly onItem: (envelope: DcEnvelope) => void,
		private readonly onLocal: (local: boolean) => void,
	) {}

	handlePresence(devices: string[]): void {
		const others = devices.filter((id) => id && id !== this.selfId);
		for (const id of others) {
			if (!this.peers.has(id) && !this.starting.has(id) && this.selfId < id) {
				this.starting.add(id);
				this.enqueue(id, () => this.offer(id));
			}
		}
		for (const id of this.peers.keys()) {
			if (!others.includes(id)) {
				this.closePeer(id);
			}
		}
	}

	async handleSignal(envelope: WsEnvelope): Promise<void> {
		if (envelope.type === "rtc.offer") {
			await this.enqueue(envelope.from, () => this.acceptOffer(envelope.from, envelope.sdp));
			return;
		}
		if (envelope.type === "rtc.answer") {
			await this.enqueue(envelope.from, () => this.acceptAnswer(envelope.from, envelope.sdp));
			return;
		}
		if (envelope.type === "rtc.ice") {
			const peer = this.peers.get(envelope.from);
			if (peer && envelope.candidate) {
				if (isHostCandidate(envelope.candidate)) {
					peer.hostRemote = true;
				}
				try {
					await peer.pc.addIceCandidate({
						candidate: envelope.candidate,
						sdpMid: envelope.sdpMid,
						sdpMLineIndex: envelope.sdpMLineIndex,
					});
				} catch {
					return;
				}
				await this.refreshLan();
			}
		}
	}

	links(): PeerLink[] {
		const out: PeerLink[] = [];
		for (const peer of this.peers.values()) {
			const channel = peer.channel;
			if (channel?.readyState !== "open") {
				continue;
			}
			out.push({
				local: this.lan,
				send: (envelope) => {
					channel.send(JSON.stringify(envelope));
				},
			});
		}
		return out;
	}

	close(): void {
		for (const id of [...this.peers.keys()]) {
			this.closePeer(id);
		}
	}

	private createPc(peerId: string): RTCPeerConnection {
		const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_URLS }] });
		const record = {
			pc,
			channel: null as RTCDataChannel | null,
			hostLocal: false,
			hostRemote: false,
		};
		this.peers.set(peerId, record);
		pc.onicecandidate = (event) => {
			const candidate = event.candidate;
			if (!candidate) {
				return;
			}
			if (isHostCandidate(candidate.candidate)) {
				record.hostLocal = true;
			}
			this.signal({
				v: 1,
				type: "rtc.ice",
				from: this.selfId,
				to: peerId,
				candidate: candidate.candidate,
				sdpMid: candidate.sdpMid,
				sdpMLineIndex: candidate.sdpMLineIndex,
			});
		};
		pc.ondatachannel = (event) => {
			this.wire(record, event.channel);
		};
		pc.oniceconnectionstatechange = () => {
			void this.refreshLan();
		};
		return pc;
	}

	private enqueue(peerId: string, op: () => Promise<void>): Promise<void> {
		const next = (this.chain.get(peerId) ?? Promise.resolve())
			.catch(() => undefined)
			.then(op)
			.catch(() => undefined);
		this.chain.set(peerId, next);
		return next;
	}

	private async offer(peerId: string): Promise<void> {
		try {
			if (this.peers.has(peerId)) {
				return;
			}
			const pc = this.createPc(peerId);
			const record = this.peers.get(peerId);
			if (record) {
				this.wire(record, pc.createDataChannel("meownow"));
			}
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			if (!offer.sdp) {
				return;
			}
			this.signal({ v: 1, type: "rtc.offer", from: this.selfId, to: peerId, sdp: offer.sdp });
		} finally {
			this.starting.delete(peerId);
		}
	}

	private async acceptOffer(peerId: string, sdp: string): Promise<void> {
		let pc = this.peers.get(peerId)?.pc;
		if (!pc) {
			pc = this.createPc(peerId);
		}
		const sameRemote = pc.remoteDescription?.type === "offer" && pc.remoteDescription.sdp === sdp;
		if (planRtcSignal(pc.signalingState, "offer", sameRemote) !== "apply-offer") {
			return;
		}
		await pc.setRemoteDescription({ type: "offer", sdp });
		if (pc.signalingState !== "have-remote-offer") {
			return;
		}
		const answer = await pc.createAnswer();
		if (pc.signalingState !== "have-remote-offer") {
			return;
		}
		await pc.setLocalDescription(answer);
		if (!answer.sdp) {
			return;
		}
		this.signal({ v: 1, type: "rtc.answer", from: this.selfId, to: peerId, sdp: answer.sdp });
	}

	private async acceptAnswer(peerId: string, sdp: string): Promise<void> {
		const peer = this.peers.get(peerId);
		if (!peer) {
			return;
		}
		if (planRtcSignal(peer.pc.signalingState, "answer") !== "apply-answer") {
			return;
		}
		await peer.pc.setRemoteDescription({ type: "answer", sdp });
	}

	private wire(record: { channel: RTCDataChannel | null }, channel: RTCDataChannel): void {
		record.channel = channel;
		channel.onmessage = (event) => {
			if (typeof event.data !== "string") {
				return;
			}
			try {
				const parsed = dcEnvelopeSchema.safeParse(JSON.parse(event.data));
				if (parsed.success) {
					this.onItem(parsed.data);
				}
			} catch {
				return;
			}
		};
	}

	private async refreshLan(): Promise<void> {
		let lan = false;
		for (const peer of this.peers.values()) {
			if (
				peer.pc.iceConnectionState !== "connected" &&
				peer.pc.iceConnectionState !== "completed"
			) {
				continue;
			}
			if (peer.hostLocal && peer.hostRemote) {
				lan = true;
				break;
			}
			const stats = await peer.pc.getStats();
			for (const row of stats.values()) {
				if (row.type !== "candidate-pair") {
					continue;
				}
				const pair = row as RTCIceCandidatePairStats & { nominated?: boolean };
				if (!pair.nominated) {
					continue;
				}
				const local = stats.get(pair.localCandidateId);
				const remote = stats.get(pair.remoteCandidateId);
				const localType = (local as { candidateType?: string } | undefined)?.candidateType;
				const remoteType = (remote as { candidateType?: string } | undefined)?.candidateType;
				if (localType && remoteType && isLanPair(localType, remoteType)) {
					lan = true;
				}
			}
		}
		if (lan !== this.lan) {
			this.lan = lan;
			this.onLocal(lan);
		}
	}

	private closePeer(id: string): void {
		this.starting.delete(id);
		const peer = this.peers.get(id);
		peer?.channel?.close();
		peer?.pc.close();
		this.peers.delete(id);
		void this.refreshLan();
	}
}
