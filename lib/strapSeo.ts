import type { StrapCategory, StrapStyleTag, StrapVariant } from "@/lib/strapLibrary";
import { ALL_PUBLIC_STRAPS, getStrapsForCategory } from "@/lib/strapLibrary";

export const SITE_URL = "https://watchstrapper.com";

export type PublicStrapCategorySlug = "leather" | "fabric" | "rubber" | "metal";

export interface PublicStrapCategoryConfig {
  slug: PublicStrapCategorySlug;
  category: Exclude<StrapCategory, "All categories" | "Women">;
  title: string;
  heroTitle: string;
  description: string;
  seoDescription: string;
}

export const PUBLIC_STRAP_CATEGORY_PAGES: PublicStrapCategoryConfig[] = [
  {
    slug: "leather",
    category: "Leather",
    title: "Leather Watch Straps",
    heroTitle: "Leather watch straps with dress, heritage, and artisanal moods.",
    description:
      "Explore Watchstrapper's leather strap catalogue with smooth, grain, suede, pebbled, and decorated leather options that are ready for try-on in the visualizer.",
    seoDescription:
      "Browse leather watch straps on Watchstrapper, including smooth, grain, suede, and decorated leather options with style tags and fit-ready images."
  },
  {
    slug: "fabric",
    category: "Fabric",
    title: "Fabric Watch Straps",
    heroTitle: "Fabric watch straps for casual, boho, and statement looks.",
    description:
      "Browse NATO, canvas, and sailcloth straps with colour, pattern, and everyday wearability in mind, all published as crawlable Watchstrapper catalogue pages.",
    seoDescription:
      "Browse fabric watch straps on Watchstrapper, including NATO, canvas, and sailcloth options with style tags and fit-ready images."
  },
  {
    slug: "rubber",
    category: "Rubber",
    title: "Rubber Watch Straps",
    heroTitle: "Rubber watch straps for sporty, rugged, and tool-watch styling.",
    description:
      "Explore tropic, FKM, and performance rubber straps with fit-ready product imagery and practical style metadata for dive and sport watches.",
    seoDescription:
      "Browse rubber watch straps on Watchstrapper, including tropic, FKM, and performance styles with style tags and fit-ready images."
  },
  {
    slug: "metal",
    category: "Metal",
    title: "Metal Watch Bracelets",
    heroTitle: "Metal bracelets for dressy, formal, and clean modern looks.",
    description:
      "Explore steel, gold, and mixed-tone bracelets with link and mesh styles, published as crawlable Watchstrapper pages for discovery and sharing.",
    seoDescription:
      "Browse metal watch bracelets on Watchstrapper, including steel, gold, link, and mesh styles with fit-ready images."
  }
];

export const getPublicStrapCategory = (slug: string) =>
  PUBLIC_STRAP_CATEGORY_PAGES.find((entry) => entry.slug === slug);

export const getStrapsForPublicCategory = (category: PublicStrapCategoryConfig["category"]): StrapVariant[] =>
  getStrapsForCategory(category);

export const getTopStyleTags = (straps: StrapVariant[]): StrapStyleTag[] => {
  const counts = new Map<StrapStyleTag, number>();

  straps.forEach((strap) => {
    strap.styleTags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([tag]) => tag);
};

export const getOgShowcaseStraps = (): StrapVariant[] => {
  const preferredIds = [
    "leather-sapphire-suede",
    "leather-oxblood-pebbled",
    "fabric-talavera-blue-nato",
    "metal-steel-link-bracelet"
  ];

  return preferredIds
    .map((id) => ALL_PUBLIC_STRAPS.find((strap) => strap.id === id))
    .filter((strap): strap is StrapVariant => Boolean(strap));
};

