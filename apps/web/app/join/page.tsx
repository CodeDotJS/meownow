import { JoinForm } from "./join-form";

export default function JoinPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
	return (
		<main>
			<h1>Join</h1>
			<JoinLoader searchParams={searchParams} />
		</main>
	);
}

async function JoinLoader({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
	const params = await searchParams;
	return <JoinForm initialToken={params.t ?? ""} />;
}
