import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_PUBLIC_STRAPS, type StrapStyleTag, getStrapBySlug, getStrapSlug } from "@/lib/strapLibrary";

const siteUrl = "https://watchstrapper.com";

const humanize = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const strapDescription = (label: string, material: string, styleFamily: string, styleTags: StrapStyleTag[]) => {
  const mood = styleTags.length ? `${styleTags.map(humanize).join(", ")} inspired` : "watch-ready";
  return `${label} is a ${mood.toLowerCase()} ${material} strap with a ${humanize(styleFamily).toLowerCase()} finish, published as a crawlable Watchstrapper catalogue page.`;
};

export function generateStaticParams() {
  return ALL_PUBLIC_STRAPS.map((strap) => ({
    slug: getStrapSlug(strap)
  }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const strap = getStrapBySlug(params.slug);
  if (!strap) {
    return {
      title: "Strap Not Found",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const description = strapDescription(
    strap.label,
    strap.shopping.material,
    strap.shopping.styleFamily,
    strap.styleTags
  );

  return {
    title: `${strap.label} Strap`,
    description,
    alternates: {
      canonical: `/straps/${params.slug}`
    },
    openGraph: {
      title: `${strap.label} | Watchstrapper`,
      description,
      url: `${siteUrl}/straps/${params.slug}`,
      type: "website",
      images: [
        {
          url: `${siteUrl}/straps/${params.slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${strap.label} share preview`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${strap.label} | Watchstrapper`,
      description,
      images: [`${siteUrl}/straps/${params.slug}/opengraph-image`]
    }
  };
}

export default function StrapDetailPage({ params }: { params: { slug: string } }) {
  const strap = getStrapBySlug(params.slug);
  if (!strap) notFound();

  const description = strapDescription(
    strap.label,
    strap.shopping.material,
    strap.shopping.styleFamily,
    strap.styleTags
  );

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Straps",
        item: `${siteUrl}/straps`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: strap.label,
        item: `${siteUrl}/straps/${params.slug}`
      }
    ]
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: strap.label,
    category: strap.category,
    description,
    image: [`${siteUrl}${strap.strapASrc}`, `${siteUrl}${strap.strapBSrc}`],
    material: humanize(strap.shopping.material),
    color: humanize(strap.shopping.colorFamily),
    brand: {
      "@type": "Brand",
      name: "Watchstrapper"
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffefb_0%,#f8f1e7_100%)] px-4 pb-16 pt-8 text-[#2b241d] sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#7c6a56]">
          <Link href="/" className="hover:text-[#3b3128]">
            Home
          </Link>
          <span>/</span>
          <Link href="/straps" className="hover:text-[#3b3128]">
            Straps
          </Link>
          <span>/</span>
          <span className="text-[#3b3128]">{strap.label}</span>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <article className="rounded-[2rem] border border-[#ead8c0]/80 bg-white/88 p-6 shadow-[0_20px_40px_rgba(58,43,28,0.08)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b7761]">{strap.category} strap</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-[#2b241d] sm:text-5xl">{strap.label}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#5f5143] sm:text-lg">{description}</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[#ead8c0]/80 bg-[#f8f6f2] p-4">
                <div className="relative h-80 overflow-hidden rounded-[1.2rem] bg-white">
                  <Image src={strap.strapASrc} alt={`${strap.label} buckle side`} fill className="object-contain p-4" />
                </div>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6752]">Buckle side</p>
              </div>
              <div className="rounded-[1.5rem] border border-[#ead8c0]/80 bg-[#f8f6f2] p-4">
                <div className="relative h-80 overflow-hidden rounded-[1.2rem] bg-white">
                  <Image src={strap.strapBSrc} alt={`${strap.label} tail side`} fill className="object-contain p-4" />
                </div>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#7b6752]">Tail side</p>
              </div>
            </div>

            <section className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.4rem] border border-[#ead8c0]/80 bg-[#fffaf3] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">Material + build</p>
                <dl className="mt-3 space-y-3 text-sm text-[#5f5143]">
                  <div className="flex justify-between gap-4">
                    <dt className="font-medium text-[#3b3128]">Material</dt>
                    <dd>{humanize(strap.shopping.material)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="font-medium text-[#3b3128]">Style family</dt>
                    <dd>{humanize(strap.shopping.styleFamily)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="font-medium text-[#3b3128]">Hardware</dt>
                    <dd>{humanize(strap.shopping.hardwareFinish)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="font-medium text-[#3b3128]">Color family</dt>
                    <dd>{humanize(strap.shopping.colorFamily)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[1.4rem] border border-[#ead8c0]/80 bg-[#fffaf3] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">Style tags</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {strap.styleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#e0c9aa] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6c5847]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-[#5f5143]">
                  These tags help users browse by fashion mood as well as material, so this page supports both SEO and in-app discovery.
                </p>
              </div>
            </section>
          </article>

          <aside className="space-y-4">
            <div className="rounded-[1.6rem] border border-[#ead8c0]/80 bg-white/88 p-5 shadow-[0_16px_34px_rgba(58,43,28,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">Use in the visualizer</p>
              <p className="mt-3 text-sm leading-6 text-[#5f5143]">
                This strap is available inside the main Watchstrapper visualizer. Upload a watch photo to preview it on your own watch head.
              </p>
              <Link
                href={`/?strap=${getStrapSlug(strap)}`}
                className="mt-4 inline-flex rounded-full border border-[#d7c1a3] bg-[#fff8ef] px-4 py-2 text-sm font-semibold text-[#3b3128]"
              >
                Open in Watchstrapper
              </Link>
            </div>

            <div className="rounded-[1.6rem] border border-[#ead8c0]/80 bg-white/88 p-5 shadow-[0_16px_34px_rgba(58,43,28,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7761]">Keywords</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {strap.shopping.keywords.slice(0, 8).map((keyword) => (
                  <span key={keyword} className="rounded-full border border-[#ead8c0] bg-[#fffaf3] px-3 py-1 text-xs text-[#6c5847]">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
