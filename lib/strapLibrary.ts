import type { StrapStyle } from "@/lib/compose";

export type StrapCategory = "All categories" | "Leather" | "Rubber" | "Fabric" | "Metal";

export interface StrapVariant {
  id: string;
  label: string;
  category: StrapCategory;
  strapASrc: string;
  strapBSrc: string;
  tint: StrapStyle;
  autoFitWidthFactor?: number;
  autoGapFactor?: number;
  joinShape?: "flat" | "curved";
}

const BASE_A = "/sample-strap-a.png";
const BASE_B = "/sample-strap-b.png";
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
    },
    {
      id: "leather-bourbon-pullup",
      label: "Bourbon Pull-Up Leather",
      category: "Leather",
      strapASrc: `${SEL}/bourbon-pullup-leather-buckle.png`,
      strapBSrc: `${SEL}/bourbon-pullup-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-taupe-nubuck",
      label: "Taupe Nubuck Leather",
      category: "Leather",
      strapASrc: `${SEL}/taupe-nubuck-leather-buckle.png`,
      strapBSrc: `${SEL}/taupe-nubuck-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-oxblood-pebbled",
      label: "Oxblood Pebbled Leather",
      category: "Leather",
      strapASrc: `${SEL}/oxblood-pebbled-leather-buckle.png`,
      strapBSrc: `${SEL}/oxblood-pebbled-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-forest-calf",
      label: "Forest Calf Leather",
      category: "Leather",
      strapASrc: `${SEL}/forest-calf-leather-buckle.png`,
      strapBSrc: `${SEL}/forest-calf-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-slate-saffiano",
      label: "Slate Saffiano Leather",
      category: "Leather",
      strapASrc: `${SEL}/slate-saffiano-leather-buckle.png`,
      strapBSrc: `${SEL}/slate-saffiano-leather-tail.png`,
      tint: ORIG_TINT
    }
  ],
  Rubber: [
    {
      id: "rubber-olive-performance",
      label: "Olive Performance Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/olive-performance-rubber-buckle.png`,
      strapBSrc: `${SEL}/olive-performance-rubber-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.11
    },
    {
      id: "rubber-blue-tropic",
      label: "Blue Tropic Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-blue-tropic-buckle.png`,
      strapBSrc: `${SEL}/rubber-blue-tropic-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.11
    },
    {
      id: "rubber-orange-tropic",
      label: "Orange Tropic Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-orange-tropic-buckle.png`,
      strapBSrc: `${SEL}/rubber-orange-tropic-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.11
    },
    {
      id: "rubber-white-fkm",
      label: "White FKM Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-white-fkm-buckle.png`,
      strapBSrc: `${SEL}/rubber-white-fkm-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.115
    },
    {
      id: "rubber-sand-fkm",
      label: "Sand FKM Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-sand-fkm-buckle.png`,
      strapBSrc: `${SEL}/rubber-sand-fkm-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.115
    },
    {
      id: "rubber-grey-waffle",
      label: "Grey Waffle Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-grey-waffle-buckle.png`,
      strapBSrc: `${SEL}/rubber-grey-waffle-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.11
    },
    {
      id: "rubber-red-waffle",
      label: "Red Waffle Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-red-waffle-buckle.png`,
      strapBSrc: `${SEL}/rubber-red-waffle-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.11
    },
    {
      id: "rubber-navy-performance",
      label: "Navy Performance Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-navy-performance-buckle.png`,
      strapBSrc: `${SEL}/rubber-navy-performance-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.11
    }
  ],
  Fabric: [
    {
      id: "fabric-nato",
      label: "NATO Fabric",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-bond-nato-buckle.png`,
      strapBSrc: `${SEL}/fabric-bond-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-grey-canvas",
      label: "Grey Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/grey-canvas-buckle.png`,
      strapBSrc: `${SEL}/grey-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.09
    },
    {
      id: "fabric-navy-canvas",
      label: "Navy Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/navy-canvas-buckle.png`,
      strapBSrc: `${SEL}/navy-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.082
    },
    {
      id: "fabric-olive-nato",
      label: "Olive NATO",
      category: "Fabric",
      strapASrc: `${SEL}/olive-nato-buckle.png`,
      strapBSrc: `${SEL}/olive-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.082
    },
    {
      id: "fabric-sand-canvas",
      label: "Sand Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-sand-canvas-buckle.png`,
      strapBSrc: `${SEL}/fabric-sand-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.09
    },
    {
      id: "fabric-khaki-canvas",
      label: "Khaki Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-khaki-canvas-buckle.png`,
      strapBSrc: `${SEL}/fabric-khaki-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.09
    },
    {
      id: "fabric-black-sailcloth",
      label: "Black Sailcloth",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-black-sailcloth-buckle.png`,
      strapBSrc: `${SEL}/fabric-black-sailcloth-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.09
    },
    {
      id: "fabric-navy-sailcloth",
      label: "Navy Sailcloth",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-navy-sailcloth-buckle.png`,
      strapBSrc: `${SEL}/fabric-navy-sailcloth-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.09
    },
    {
      id: "fabric-grey-sailcloth",
      label: "Grey Sailcloth",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-grey-sailcloth-buckle.png`,
      strapBSrc: `${SEL}/fabric-grey-sailcloth-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.09
    },
    {
      id: "fabric-bond-nato",
      label: "Bond NATO",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-bond-nato-buckle.png`,
      strapBSrc: `${SEL}/fabric-bond-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-desert-nato",
      label: "Desert NATO",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-desert-nato-buckle.png`,
      strapBSrc: `${SEL}/fabric-desert-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-olive-seatbelt-nato",
      label: "Olive Seatbelt NATO",
      category: "Fabric",
      strapASrc: `${SEL}/olive-seatbelt-nato-buckle.png`,
      strapBSrc: `${SEL}/olive-seatbelt-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-navy-bond-nato",
      label: "Navy Bond NATO",
      category: "Fabric",
      strapASrc: `${SEL}/navy-bond-nato-buckle.png`,
      strapBSrc: `${SEL}/navy-bond-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-sand-stripe-nato",
      label: "Sand Stripe NATO",
      category: "Fabric",
      strapASrc: `${SEL}/sand-stripe-nato-buckle.png`,
      strapBSrc: `${SEL}/sand-stripe-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-charcoal-seatbelt-nato",
      label: "Charcoal Seatbelt NATO",
      category: "Fabric",
      strapASrc: `${SEL}/charcoal-seatbelt-nato-buckle.png`,
      strapBSrc: `${SEL}/charcoal-seatbelt-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    }
  ],
  Metal: [
    {
      id: "metal-bracelet",
      label: "Steel Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/steel-bracelet-buckle.png`,
      strapBSrc: `${SEL}/steel-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.08,
      autoGapFactor: 1.55,
      joinShape: "curved"
    },
    {
      id: "metal-steel-link",
      label: "Steel Link Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/steel-link-bracelet-buckle.png`,
      strapBSrc: `${SEL}/steel-link-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.078,
      autoGapFactor: 1.6,
      joinShape: "curved"
    },
    {
      id: "metal-black-pvd-bracelet",
      label: "Black PVD Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/black-pvd-bracelet-buckle.png`,
      strapBSrc: `${SEL}/black-pvd-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.078,
      autoGapFactor: 1.6,
      joinShape: "curved"
    },
    {
      id: "metal-gunmetal-milanese",
      label: "Gunmetal Milanese",
      category: "Metal",
      strapASrc: `${SEL}/metal-gunmetal-milanese-buckle.png`,
      strapBSrc: `${SEL}/metal-gunmetal-milanese-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085,
      autoGapFactor: 1.35,
      joinShape: "curved"
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
