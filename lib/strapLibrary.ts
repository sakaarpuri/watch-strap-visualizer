import type { StrapStyle } from "@/lib/compose";

export type StrapCategory = "All categories" | "Leather" | "Rubber" | "Fabric" | "Metal";

export interface StrapVariant {
  id: string;
  label: string;
  category: StrapCategory;
  strapASrc: string;
  strapBSrc: string;
  tint: StrapStyle;
}

const BASE_A = "/sample-strap-a.png";
const BASE_B = "/sample-strap-b.png";
const METAL_A = "/metal-strap-a.png";
const METAL_B = "/metal-strap-b.png";
const SEL = "/strap-selection-kie";

const ORIG_TINT: StrapStyle = { name: "Original", color: "#000000", alpha: 0 };

export const STRAP_LIBRARY: Record<Exclude<StrapCategory, "All categories">, StrapVariant[]> = {
  Leather: [
    { id: "leather-classic", label: "Classic Leather", category: "Leather", strapASrc: BASE_A, strapBSrc: BASE_B, tint: ORIG_TINT },
    {
      id: "leather-black-smooth",
      label: "Black Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/black-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/black-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-black-grain",
      label: "Black Grain Leather",
      category: "Leather",
      strapASrc: `${SEL}/black-grain-leather-buckle.png`,
      strapBSrc: `${SEL}/black-grain-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-dark-brown-smooth",
      label: "Dark Brown Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/dark-brown-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/dark-brown-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-espresso-smooth",
      label: "Espresso Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/espresso-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/espresso-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-cognac-grain",
      label: "Cognac Grain Leather",
      category: "Leather",
      strapASrc: `${SEL}/cognac-grain-leather-buckle.png`,
      strapBSrc: `${SEL}/cognac-grain-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-cognac-smooth",
      label: "Cognac Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/cognac-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/cognac-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-sand-suede",
      label: "Sand Suede Leather",
      category: "Leather",
      strapASrc: `${SEL}/sand-suede-buckle.png`,
      strapBSrc: `${SEL}/sand-suede-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-tan-suede",
      label: "Tan Suede Leather",
      category: "Leather",
      strapASrc: `${SEL}/tan-suede-buckle.png`,
      strapBSrc: `${SEL}/tan-suede-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-tan-smooth",
      label: "Tan Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/tan-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/tan-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-beige-suede",
      label: "Beige Suede Leather",
      category: "Leather",
      strapASrc: `${SEL}/beige-suede-leather-buckle.png`,
      strapBSrc: `${SEL}/beige-suede-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-beige-smooth",
      label: "Beige Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/beige-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/beige-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-burgundy-pebbled",
      label: "Burgundy Pebbled Leather",
      category: "Leather",
      strapASrc: `${SEL}/burgundy-pebbled-leather-buckle.png`,
      strapBSrc: `${SEL}/burgundy-pebbled-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-burgundy-smooth",
      label: "Burgundy Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/burgundy-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/burgundy-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-navy-smooth",
      label: "Navy Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/navy-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/navy-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-olive-smooth",
      label: "Olive Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/olive-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/olive-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-gray-smooth",
      label: "Gray Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/gray-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/gray-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-chocolate-smooth",
      label: "Chocolate Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/chocolate-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/chocolate-smooth-leather-tail.png`,
      tint: ORIG_TINT
    }
  ],
  Rubber: [
    {
      id: "rubber-black-performance",
      label: "Black Performance Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/black-performance-rubber-buckle.png`,
      strapBSrc: `${SEL}/black-performance-rubber-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "rubber-olive-performance",
      label: "Olive Performance Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/olive-performance-rubber-buckle.png`,
      strapBSrc: `${SEL}/olive-performance-rubber-tail.png`,
      tint: ORIG_TINT
    }
  ],
  Fabric: [
    { id: "fabric-nato", label: "NATO Fabric", category: "Fabric", strapASrc: BASE_A, strapBSrc: BASE_B, tint: ORIG_TINT },
    {
      id: "fabric-grey-canvas",
      label: "Grey Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/grey-canvas-buckle.png`,
      strapBSrc: `${SEL}/grey-canvas-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "fabric-navy-canvas",
      label: "Navy Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/navy-canvas-buckle.png`,
      strapBSrc: `${SEL}/navy-canvas-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "fabric-olive-nato",
      label: "Olive NATO",
      category: "Fabric",
      strapASrc: `${SEL}/olive-nato-buckle.png`,
      strapBSrc: `${SEL}/olive-nato-tail.png`,
      tint: ORIG_TINT
    }
  ],
  Metal: [
    { id: "metal-bracelet", label: "Steel Bracelet", category: "Metal", strapASrc: METAL_A, strapBSrc: METAL_B, tint: ORIG_TINT },
    {
      id: "metal-steel-link",
      label: "Steel Link Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/steel-bracelet-buckle.png`,
      strapBSrc: `${SEL}/steel-bracelet-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "metal-black-pvd-bracelet",
      label: "Black PVD Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/black-pvd-bracelet-buckle.png`,
      strapBSrc: `${SEL}/black-pvd-bracelet-tail.png`,
      tint: ORIG_TINT
    }
  ]
};

export const STRAP_CATEGORIES: StrapCategory[] = [
  "All categories",
  "Leather",
  "Rubber",
  "Fabric",
  "Metal"
];

export const getStrapsForCategory = (category: StrapCategory): StrapVariant[] => {
  if (category === "All categories") {
    return [
      ...STRAP_LIBRARY.Leather,
      ...STRAP_LIBRARY.Rubber,
      ...STRAP_LIBRARY.Fabric,
      ...STRAP_LIBRARY.Metal
    ];
  }
  return STRAP_LIBRARY[category];
};
