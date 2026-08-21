export default function manifest() {
	return {
		name: "meownow",
		short_name: "meownow",
		description: "Private clipboard",
		start_url: "/",
		display: "standalone",
		background_color: "#f1f2f4",
		theme_color: "#14161a",
		orientation: "any",
		icons: [
			{
				src: "/icons/icon-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any maskable",
			},
			{
				src: "/icons/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
		],
		shortcuts: [
			{
				name: "Clipboard",
				short_name: "Paste",
				url: "/",
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
