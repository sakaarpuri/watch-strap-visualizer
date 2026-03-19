import type { Metadata } from "next";
import HomePageClient from "@/components/HomePageClient";

const siteUrl = "https://watchstrapper.com";
const title = "Watchstrapper | See Any Strap On Your Watch Before You Buy";
const description =
  "Upload your watch photo, preview different straps on it, compare materials and styles, and fine-tune the fit before you buy a new watch strap.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Watchstrapper",
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Watchstrapper homepage preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${siteUrl}/opengraph-image`]
  }
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Watchstrapper",
  url: siteUrl,
  description,
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/?q={search_term_string}`,
    "query-input": "required name=search_term_string"
  }
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Watchstrapper",
  url: siteUrl
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <HomePageClient />
      <section className="border-t border-[#ead8c0]/70 bg-white/70 px-4 py-12 text-[#5f5143] sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f6c57]">What it does</p>
            <h2 className="mt-3 text-xl font-semibold text-[#2f2418]">Preview straps on your own watch photo</h2>
            <p className="mt-3 text-sm leading-6">
              Watchstrapper helps you upload a watch photo, crop the watch head cleanly, and compare strap styles on the same watch before you commit to buying.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f6c57]">How it works</p>
            <p className="mt-3 text-sm leading-6">
              Start by uploading a straight-on watch image. Then browse leather, fabric, rubber, or metal straps, adjust fit if needed, and save the look you want to keep.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f6c57]">Why it matters</p>
            <p className="mt-3 text-sm leading-6">
              Strap color, finish, texture, and width can change the character of a watch completely. This tool is designed to make that decision visual instead of guesswork.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
