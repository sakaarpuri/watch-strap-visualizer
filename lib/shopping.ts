import { getStrapsForCategory, StrapVariant } from "@/lib/strapLibrary";

export interface SimilarProduct {
  id: string;
  title: string;
  store: string;
  url: string;
  affiliateUrl?: string;
  imageSrc: string;
  material: StrapVariant["shopping"]["material"];
  styleFamilies: StrapVariant["shopping"]["styleFamily"][];
  colorFamilies: StrapVariant["shopping"]["colorFamily"][];
  hardwareFinishes: StrapVariant["shopping"]["hardwareFinish"][];
  keywords?: string[];
}

export interface SimilarProductCard {
  id: string;
  title: string;
  store: string;
  url: string;
  imageSrc: string;
}

const CURATED_PRODUCTS: SimilarProduct[] = [
  {
    id: "wg-leather-classics",
    title: "Leather Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/leather-watch-straps",
    imageSrc: "/strap-selection-kie/black-smooth-leather-buckle.png",
    material: "leather",
    styleFamilies: ["classic", "smooth", "grain", "pebbled", "pull-up"],
    colorFamilies: ["black", "brown", "tan", "beige", "burgundy"],
    hardwareFinishes: ["silver"]
  },
  {
    id: "cns-leather-bands",
    title: "Leather Watch Bands",
    store: "CNS Watch Bands",
    url: "https://cnswatchbands.com/leather-watch-bands/",
    imageSrc: "/strap-selection-kie/cognac-grain-leather-buckle.png",
    material: "leather",
    styleFamilies: ["classic", "smooth", "grain", "saffiano"],
    colorFamilies: ["brown", "tan", "black", "gray"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "wg-suede-straps",
    title: "Suede Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/suede-watch-straps",
    imageSrc: "/strap-selection-kie/sapphire-suede-buckle.png",
    material: "leather",
    styleFamilies: ["suede"],
    colorFamilies: ["blue", "green", "beige", "burgundy", "tan"],
    hardwareFinishes: ["silver"]
  },
  {
    id: "wg-nubuck-straps",
    title: "Nubuck & Soft Leather Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/leather-watch-straps",
    imageSrc: "/strap-selection-kie/clean/taupe-nubuck-leather-buckle.png",
    material: "leather",
    styleFamilies: ["suede", "pull-up"],
    colorFamilies: ["brown", "gray", "green"],
    hardwareFinishes: ["silver"]
  },
  {
    id: "wg-canvas-straps",
    title: "Canvas Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/canvas-watch-straps",
    imageSrc: "/strap-selection-kie/fabric-khaki-canvas-buckle.png",
    material: "fabric",
    styleFamilies: ["canvas"],
    colorFamilies: ["green", "gray", "beige", "blue"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "wg-nylon-straps",
    title: "Nylon Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/nylon-watch-straps",
    imageSrc: "/strap-selection-kie/olive-nato-buckle.png",
    material: "fabric",
    styleFamilies: ["nato"],
    colorFamilies: ["green", "blue", "gray", "multicolor", "beige"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "cns-nylon-bands",
    title: "Nylon Watch Bands",
    store: "CNS Watch Bands",
    url: "https://cnswatchbands.com/nylon-watch-bands/",
    imageSrc: "/strap-selection-kie/holi-stripe-nato-buckle.png",
    material: "fabric",
    styleFamilies: ["nato", "canvas", "sailcloth"],
    colorFamilies: ["green", "blue", "gray", "multicolor", "beige"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "wg-sailcloth-straps",
    title: "Sailcloth Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/canvas-watch-straps",
    imageSrc: "/strap-selection-kie/fabric-black-sailcloth-buckle.png",
    material: "fabric",
    styleFamilies: ["sailcloth"],
    colorFamilies: ["black", "gray", "blue"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "barton-tropical-rubber",
    title: "Tropical-Style Rubber Watch Bands",
    store: "BARTON",
    url: "https://www.bartonwatchbands.com/collections/rubber-watch-bands",
    imageSrc: "/strap-selection-kie/rubber-orange-tropic-buckle.png",
    material: "rubber",
    styleFamilies: ["tropic", "rubber"],
    colorFamilies: ["orange", "blue", "black"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "barton-elite-silicone",
    title: "Elite Silicone Watch Bands",
    store: "BARTON",
    url: "https://www.bartonwatchbands.com/collections/elite-silicone-watch-bands",
    imageSrc: "/strap-selection-kie/olive-performance-rubber-buckle.png",
    material: "rubber",
    styleFamilies: ["performance", "rubber"],
    colorFamilies: ["green", "blue", "black", "orange"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "barton-rubber-collection",
    title: "Rubber Watch Bands",
    store: "BARTON",
    url: "https://www.bartonwatchbands.com/collections/rubber-watch-bands",
    imageSrc: "/strap-selection-kie/rubber-sand-fkm-buckle.png",
    material: "rubber",
    styleFamilies: ["fkm", "performance", "rubber"],
    colorFamilies: ["beige", "blue", "black", "green"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "wg-metal-straps",
    title: "Metal Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/metal-watch-straps",
    imageSrc: "/strap-selection-kie/steel-bracelet-buckle.png",
    material: "metal",
    styleFamilies: ["bracelet", "link-bracelet", "mesh"],
    colorFamilies: ["silver", "black"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "strapcode-metal-bracelets",
    title: "Metal Watch Bands",
    store: "Strapcode",
    url: "https://www.strapcode.com/collections/watch-bands",
    imageSrc: "/strap-selection-kie/steel-link-bracelet-buckle.png",
    material: "metal",
    styleFamilies: ["bracelet", "link-bracelet"],
    colorFamilies: ["silver", "black"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "strapcode-mesh-bands",
    title: "Mesh Watch Bands",
    store: "Strapcode",
    url: "https://www.strapcode.com/collections/mesh-watch-bands",
    imageSrc: "/strap-selection-kie/black-pvd-bracelet-buckle.png",
    material: "metal",
    styleFamilies: ["mesh"],
    colorFamilies: ["silver", "black"],
    hardwareFinishes: ["silver", "black"]
  }
];

const scoreProduct = (strap: StrapVariant, product: SimilarProduct) => {
  const meta = strap.shopping;
  let score = 0;

  if (product.material === meta.material) score += 7;
  if (product.styleFamilies.includes(meta.styleFamily)) score += 5;
  if (product.colorFamilies.includes(meta.colorFamily)) score += 4;
  if (product.hardwareFinishes.includes(meta.hardwareFinish)) score += 2;

  const sharedKeywords = (product.keywords || []).filter((keyword) => meta.keywords.includes(keyword));
  score += sharedKeywords.length;

  return score;
};

export const getSimilarProductsForStrap = (strapId: string, limit = 4): SimilarProductCard[] => {
  const strap = getStrapsForCategory("All categories").find((entry) => entry.id === strapId);
  if (!strap) return [];

  return CURATED_PRODUCTS
    .map((product) => ({
      product,
      score: scoreProduct(strap, product)
    }))
    .filter(({ score }) => score >= 8)
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title))
    .slice(0, limit)
    .map(({ product }) => ({
      id: product.id,
      title: product.title,
      store: product.store,
      url: product.affiliateUrl || product.url,
      imageSrc: product.imageSrc
    }));
};
