import type { Metadata } from "next";
import StrapCollectionPage from "@/components/StrapCollectionPage";
import { getPublicStrapCategory, getStrapsForPublicCategory, SITE_URL } from "@/lib/strapSeo";

const categoryConfig = getPublicStrapCategory("leather")!;
const straps = getStrapsForPublicCategory(categoryConfig.category);

export const metadata: Metadata = {
  title: categoryConfig.title,
  description: categoryConfig.seoDescription,
  alternates: {
    canonical: `/straps/${categoryConfig.slug}`
  },
  openGraph: {
    title: `${categoryConfig.title} | Watchstrapper`,
    description: categoryConfig.seoDescription,
    url: `${SITE_URL}/straps/${categoryConfig.slug}`,
    type: "website",
    images: [
      {
        url: `${SITE_URL}/straps/opengraph-image`,
        width: 1200,
        height: 630,
        alt: `${categoryConfig.title} preview`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${categoryConfig.title} | Watchstrapper`,
    description: categoryConfig.seoDescription,
    images: [`${SITE_URL}/straps/opengraph-image`]
  }
};

export default function LeatherStrapsPage() {
  return (
    <StrapCollectionPage
      heroEyebrow="Leather catalogue"
      heroTitle={categoryConfig.heroTitle}
      heroDescription={categoryConfig.description}
      breadcrumbCurrent="Leather"
      straps={straps}
      categoryConfig={categoryConfig}
    />
  );
}
