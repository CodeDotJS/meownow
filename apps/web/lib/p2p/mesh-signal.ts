export type RtcIncoming = "offer" | "answer";

export type RtcPlan = "apply-offer" | "apply-answer" | "ignore";

export function planRtcSignal(
	state: RTCSignalingState,
	incoming: RtcIncoming,
	sameRemoteSdp = false,
): RtcPlan {
	if (incoming === "offer") {
		if (sameRemoteSdp || state !== "stable") {
			return "ignore";
		}
		return "apply-offer";
	}
	if (state !== "have-local-offer") {
		return "ignore";
	}
	return "apply-answer";
}
