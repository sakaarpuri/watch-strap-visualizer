import type { MetadataRoute } from "next";
import { ALL_PUBLIC_STRAPS, getStrapSlug } from "@/lib/strapLibrary";
import { PUBLIC_STRAP_CATEGORY_PAGES } from "@/lib/strapSeo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://watchstrapper.com";
  const now = new Date();
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${base}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5
    },
    {
      url: `${base}/straps`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8
    },
    ...PUBLIC_STRAP_CATEGORY_PAGES.map((category) => ({
      url: `${base}/straps/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75
    })),
    ...ALL_PUBLIC_STRAPS.map((strap) => ({
      url: `${base}/straps/${getStrapSlug(strap)}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7
    }))
  ];
}
