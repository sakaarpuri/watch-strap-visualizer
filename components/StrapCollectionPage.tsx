import Image from "next/image";
import Link from "next/link";
import type { StrapVariant } from "@/lib/strapLibrary";
import { STRAP_STYLE_TAGS, getStrapSlug } from "@/lib/strapLibrary";
import type { PublicStrapCategoryConfig } from "@/lib/strapSeo";
import { SITE_URL, getTopStyleTags } from "@/lib/strapSeo";

type StrapCollectionPageProps = {
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  breadcrumbCurrent: string;
  straps: StrapVariant[];
  categoryConfig?: PublicStrapCategoryConfig;
  showGlobalCounts?: boolean;
  groupedCounts?: Array<{ category: string; count: number }>;
};

export default function StrapCollectionPage({
  heroEyebrow,
  heroTitle,
  heroDescription,
  breadcrumbCurrent,
  straps,
  categoryConfig,
  showGlobalCounts = false,
  groupedCounts = []
}: StrapCollectionPageProps) {
  const visibleStyleTags = categoryConfig ? getTopStyleTags(straps) : STRAP_STYLE_TAGS;
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: categoryConfig ? `${categoryConfig.title} | Watchstrapper` : "Watchstrapper Strap Catalogue",
    url: categoryConfig ? `${SITE_URL}/straps/${categoryConfig.slug}` : `${SITE_URL}/straps`,
    description: categoryConfig ? categoryConfig.seoDescription : heroDescription
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffefb_0%,#f8f1e7_100%)] px-4 pb-16 pt-8 text-[#2b241d] sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#7c6a56]">
          <Link href="/" className="hover:text-[#3b3128]">
            Home
          </Link>
          <span>/</span>
          <Link href="/straps" className="hover:text-[#3b3128]">
            Straps
          </Link>
          {categoryConfig ? (
            <>
              <span>/</span>
              <span className="text-[#3b3128]">{breadcrumbCurrent}</span>
            </>
          ) : null}
        </div>

        <section className="mt-6 rounded-[2rem] border border-[#ead8c0]/80 bg-white/80 p-6 shadow-[0_20px_40px_rgba(58,43,28,0.08)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b7761]">{heroEyebrow}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-[#2b241d] sm:text-5xl">{heroTitle}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#5f5143] sm:text-lg">{heroDescription}</p>

          {showGlobalCounts ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {groupedCounts.map((group) => (
                <div key={group.category} className="rounded-[1.4rem] border border-[#ead8c0]/80 bg-[#fffaf3] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">{group.category}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#2b241d]">{group.count}</p>
                  <p className="mt-1 text-sm text-[#6a5a4b]">public strap pages</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-8 rounded-[1.5rem] border border-[#ead8c0]/80 bg-[#fffaf3] p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">
              {categoryConfig ? "Common style tags" : "Style tags"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleStyleTags.map((tag) => (
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
          {straps.map((strap) => (
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
