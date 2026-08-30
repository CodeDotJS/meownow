import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: ["/", "/about", "/play"],
			disallow: [
				"/account",
				"/admin",
				"/api/",
				"/access",
				"/enroll",
				"/invites",
				"/join",
				"/pair",
				"/recover",
				"/requests",
				"/setup",
			],
		},
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
