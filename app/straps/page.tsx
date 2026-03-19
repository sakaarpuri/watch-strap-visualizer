import type { Metadata } from "next";
import StrapCollectionPage from "@/components/StrapCollectionPage";
import { ALL_PUBLIC_STRAPS, STRAP_CATEGORIES } from "@/lib/strapLibrary";
import { SITE_URL } from "@/lib/strapSeo";

const title = "Watch Straps Catalogue";
const description =
  "Browse Watchstrapper's strap catalogue by material and style. Explore leather, fabric, rubber, and metal straps with fashion-oriented tags and fit-ready imagery.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/straps"
  },
  openGraph: {
    title: `${title} | Watchstrapper`,
    description,
    url: `${SITE_URL}/straps`,
    type: "website",
    images: [
      {
        url: `${SITE_URL}/straps/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Watchstrapper strap catalogue preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Watchstrapper`,
    description,
    images: [`${SITE_URL}/straps/opengraph-image`]
  }
};

const groupedCounts = STRAP_CATEGORIES.filter((category) => category !== "All categories").map((category) => ({
  category,
  count: ALL_PUBLIC_STRAPS.filter((strap) => strap.category === category).length
}));

export default function StrapsPage() {
  return (
    <StrapCollectionPage
      heroEyebrow="Crawlable catalogue"
      heroTitle="Browse watch straps by material, mood, and finish."
      heroDescription="These catalogue pages give Google and shoppers a clearer view of the straps behind the visualizer. Each strap now has its own detail page with material data, style tags, and fit-ready images."
      breadcrumbCurrent="Straps"
      straps={ALL_PUBLIC_STRAPS}
      showGlobalCounts
      groupedCounts={groupedCounts}
    />
  );
}
