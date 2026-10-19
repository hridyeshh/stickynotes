import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Signed-in pages (middleware.ts's matcher) only redirect a crawler to /signin, and /api starts Google sign-in.
// Shared topics (/s) stay crawlable: they carry their own noindex, which a crawler has to fetch to obey.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/library", "/t/", "/settings", "/onboarding", "/extension/", "/export"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
