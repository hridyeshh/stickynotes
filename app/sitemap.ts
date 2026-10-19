import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The public pages worth finding. Shared topics are shared by link, not published, and /sample is a stand-in article.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/privacy", "/terms"].map((path) => ({ url: new URL(path, SITE_URL).href }));
}
