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
const SEL = "/strap-selection";

const ORIG_TINT: StrapStyle = { name: "Original", color: "#000000", alpha: 0 };

export const STRAP_LIBRARY: Record<Exclude<StrapCategory, "All categories">, StrapVariant[]> = {
  Leather: [
    { id: "leather-classic", label: "Classic Leather", category: "Leather", strapASrc: BASE_A, strapBSrc: BASE_B, tint: ORIG_TINT },
    {
      id: "leather-black-grain",
      label: "Black Grain Leather",
      category: "Leather",
      strapASrc: `${SEL}/black-grain-leather-buckle.jpg`,
      strapBSrc: `${SEL}/black-grain-leather-tail.jpg`,
      tint: ORIG_TINT
    },
    {
      id: "leather-dark-brown-smooth",
      label: "Dark Brown Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/dark-brown-smooth-leather-buckle.jpg`,
      strapBSrc: `${SEL}/dark-brown-smooth-leather-tail.jpg`,
      tint: ORIG_TINT
    },
    {
      id: "leather-cognac-grain",
      label: "Cognac Grain Leather",
      category: "Leather",
      strapASrc: `${SEL}/cognac-grain-leather-buckle.jpg`,
      strapBSrc: `${SEL}/cognac-grain-leather-tail.jpg`,
      tint: ORIG_TINT
    },
    {
      id: "leather-sand-suede",
      label: "Sand Suede Leather",
      category: "Leather",
      strapASrc: `${SEL}/sand-suede-buckle.jpg`,
      strapBSrc: `${SEL}/sand-suede-tail.jpg`,
      tint: ORIG_TINT
    }
  ],
  Rubber: [
    { id: "rubber-sport", label: "Sport Rubber", category: "Rubber", strapASrc: BASE_A, strapBSrc: BASE_B, tint: ORIG_TINT },
    {
      id: "rubber-black",
      label: "Black Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/black-rubber-buckle.jpg`,
      strapBSrc: `${SEL}/black-rubber-tail.jpg`,
      tint: ORIG_TINT
    }
  ],
  Fabric: [
    { id: "fabric-nato", label: "NATO Fabric", category: "Fabric", strapASrc: BASE_A, strapBSrc: BASE_B, tint: ORIG_TINT },
    {
      id: "fabric-grey-canvas",
      label: "Grey Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/grey-canvas-buckle.jpg`,
      strapBSrc: `${SEL}/grey-canvas-tail.jpg`,
      tint: ORIG_TINT
    },
    {
      id: "fabric-navy-canvas",
      label: "Navy Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/navy-canvas-buckle.jpg`,
      strapBSrc: `${SEL}/navy-canvas-tail.jpg`,
      tint: ORIG_TINT
    },
    {
      id: "fabric-olive-nato",
      label: "Olive NATO",
      category: "Fabric",
      strapASrc: `${SEL}/olive-nato-buckle.jpg`,
      strapBSrc: `${SEL}/olive-nato-tail.jpg`,
      tint: ORIG_TINT
    }
  ],
  Metal: [
    { id: "metal-bracelet", label: "Steel Bracelet", category: "Metal", strapASrc: METAL_A, strapBSrc: METAL_B, tint: ORIG_TINT },
    {
      id: "metal-steel-link",
      label: "Steel Link Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/steel-bracelet-buckle.jpg`,
      strapBSrc: `${SEL}/steel-bracelet-tail.jpg`,
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
