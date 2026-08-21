"use client";

import { CreateVaultFlow } from "@/lib/ui/create-vault";

export default function SetupPage() {
	return (
		<main>
			<CreateVaultFlow
				onComplete={() => {
					window.location.href = "/";
				}}
			/>
		</main>
	);
}
