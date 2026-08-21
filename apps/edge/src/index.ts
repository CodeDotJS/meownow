import { DurableObject } from "cloudflare:workers";

export class HubDO extends DurableObject {}

export default {
	async fetch(): Promise<Response> {
		throw new Error("not implemented");
	},
};
