import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/concept/", "/api/"]
      }
    ],
    sitemap: "https://watchstrapper.com/sitemap.xml"
  };
}
