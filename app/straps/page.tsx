import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ALL_PUBLIC_STRAPS, STRAP_CATEGORIES, STRAP_STYLE_TAGS, getStrapSlug } from "@/lib/strapLibrary";

const siteUrl = "https://watchstrapper.com";
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
    url: `${siteUrl}/straps`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/straps/opengraph-image`,
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
    images: [`${siteUrl}/straps/opengraph-image`]
  }
};

const groupedCounts = STRAP_CATEGORIES.filter((category) => category !== "All categories").map((category) => ({
  category,
  count: ALL_PUBLIC_STRAPS.filter((strap) => strap.category === category).length
}));

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Watchstrapper Strap Catalogue",
  url: `${siteUrl}/straps`,
  description
};

export default function StrapsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffefb_0%,#f8f1e7_100%)] px-4 pb-16 pt-8 text-[#2b241d] sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#7c6a56]">
          <Link href="/" className="hover:text-[#3b3128]">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#3b3128]">Straps</span>
        </div>

        <section className="mt-6 rounded-[2rem] border border-[#ead8c0]/80 bg-white/80 p-6 shadow-[0_20px_40px_rgba(58,43,28,0.08)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b7761]">Crawlable catalogue</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-[#2b241d] sm:text-5xl">
            Browse watch straps by material, mood, and finish.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#5f5143] sm:text-lg">
            These catalogue pages give Google and shoppers a clearer view of the straps behind the visualizer. Each strap
            now has its own detail page with material data, style tags, and fit-ready images.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {groupedCounts.map((group) => (
              <div key={group.category} className="rounded-[1.4rem] border border-[#ead8c0]/80 bg-[#fffaf3] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">{group.category}</p>
                <p className="mt-2 text-2xl font-semibold text-[#2b241d]">{group.count}</p>
                <p className="mt-1 text-sm text-[#6a5a4b]">public strap pages</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-[#ead8c0]/80 bg-[#fffaf3] p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">Style tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STRAP_STYLE_TAGS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#e0c9aa] bg-white px-3 py-1 text-sm font-medium text-[#5b4b3b]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ALL_PUBLIC_STRAPS.map((strap) => (
            <article
              key={strap.id}
              className="rounded-[1.7rem] border border-[#ead8c0]/80 bg-white/88 p-4 shadow-[0_16px_34px_rgba(58,43,28,0.06)]"
            >
              <Link href={`/straps/${getStrapSlug(strap)}`} className="block">
                <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] border border-[#ead8c0]/70 bg-[#f8f6f2] p-3">
                  <div className="relative h-44 overflow-hidden rounded-[1rem] bg-white">
                    <Image src={strap.strapASrc} alt={`${strap.label} buckle side`} fill className="object-contain p-2" />
                  </div>
                  <div className="relative h-44 overflow-hidden rounded-[1rem] bg-white">
                    <Image src={strap.strapBSrc} alt={`${strap.label} tail side`} fill className="object-contain p-2" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">{strap.category}</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#2b241d]">{strap.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5f5143]">
                    {strap.shopping.material} strap with a {strap.shopping.styleFamily.replace("-", " ")} finish and{" "}
                    {strap.shopping.hardwareFinish} hardware.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {strap.styleTags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#e0c9aa] bg-[#fffaf3] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6c5847]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
