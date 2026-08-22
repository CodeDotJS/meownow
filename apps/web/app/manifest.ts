export default function manifest() {
	return {
		id: "/",
		name: "meownow",
		short_name: "meownow",
		description: "Copy on one device. Paste on the next.",
		start_url: "/",
		scope: "/",
		display: "standalone",
		display_override: ["standalone", "minimal-ui"],
		background_color: "#eef0f3",
		theme_color: "#eef0f3",
		orientation: "any",
		lang: "en",
		categories: ["utilities", "productivity"],
		icons: [
			{
				src: "/icons/icon-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/icons/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/icons/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
		shortcuts: [
			{
				name: "Clipboard",
				short_name: "Paste",
				url: "/",
				icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
			},
			{
				name: "Show a code",
				short_name: "Show",
				url: "/pair/show",
				icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
			},
			{
				name: "Add a device",
				short_name: "Add",
				url: "/pair/scan",
				icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
			},
		],
		share_target: {
			action: "/share",
			method: "POST",
			enctype: "multipart/form-data",
			params: {
				title: "title",
				text: "text",
				url: "url",
			},
		},
	};
}
