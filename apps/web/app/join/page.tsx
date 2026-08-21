import { Panel } from "@/lib/ui/panel";
import { JoinForm } from "./join-form";

export default function JoinPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
	return (
		<main>
			<Panel>
				<h1>Join</h1>
				<p className="lead">Invite, handle, passkey. Then create a vault.</p>
				<JoinLoader searchParams={searchParams} />
			</Panel>
		</main>
	);
}

async function JoinLoader({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
	const params = await searchParams;
	return <JoinForm initialToken={params.t ?? ""} />;
}
