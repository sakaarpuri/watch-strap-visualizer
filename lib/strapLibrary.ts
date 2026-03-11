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

const SEL = "/strap-selection-kie";

const ORIG_TINT: StrapStyle = { name: "Original", color: "#000000", alpha: 0 };

export const STRAP_LIBRARY: Record<Exclude<StrapCategory, "All categories">, StrapVariant[]> = {
  Leather: [
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
      id: "leather-cognac-smooth",
      label: "Cognac Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/cognac-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/cognac-smooth-leather-tail.png`,
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
      id: "leather-beige-smooth",
      label: "Beige Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/beige-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/beige-smooth-leather-tail.png`,
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
      strapASrc: `${SEL}/clean/bourbon-pullup-leather-buckle.png`,
      strapBSrc: `${SEL}/clean/bourbon-pullup-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-taupe-nubuck",
      label: "Taupe Nubuck Leather",
      category: "Leather",
      strapASrc: `${SEL}/clean/taupe-nubuck-leather-buckle.png`,
      strapBSrc: `${SEL}/clean/taupe-nubuck-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-oxblood-pebbled",
      label: "Oxblood Pebbled Leather",
      category: "Leather",
      strapASrc: `${SEL}/clean/oxblood-pebbled-leather-buckle.png`,
      strapBSrc: `${SEL}/clean/oxblood-pebbled-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-forest-calf",
      label: "Forest Calf Leather",
      category: "Leather",
      strapASrc: `${SEL}/clean/forest-calf-leather-buckle.png`,
      strapBSrc: `${SEL}/clean/forest-calf-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-slate-saffiano",
      label: "Slate Saffiano Leather",
      category: "Leather",
      strapASrc: `${SEL}/clean/slate-saffiano-leather-buckle.png`,
      strapBSrc: `${SEL}/clean/slate-saffiano-leather-tail.png`,
      tint: ORIG_TINT
    }
  ],
  Rubber: [
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
      id: "rubber-sand-fkm",
      label: "Sand FKM Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-sand-fkm-buckle.png`,
      strapBSrc: `${SEL}/rubber-sand-fkm-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.115
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
      id: "fabric-olive-seatbelt-nato",
      label: "Olive Seatbelt NATO",
      category: "Fabric",
      strapASrc: `${SEL}/clean/olive-seatbelt-nato-buckle.png`,
      strapBSrc: `${SEL}/clean/olive-seatbelt-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-navy-bond-nato",
      label: "Navy Bond NATO",
      category: "Fabric",
      strapASrc: `${SEL}/clean/navy-bond-nato-buckle.png`,
      strapBSrc: `${SEL}/clean/navy-bond-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-sand-stripe-nato",
      label: "Sand Stripe NATO",
      category: "Fabric",
      strapASrc: `${SEL}/clean/sand-stripe-nato-buckle.png`,
      strapBSrc: `${SEL}/clean/sand-stripe-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    },
    {
      id: "fabric-charcoal-seatbelt-nato",
      label: "Charcoal Seatbelt NATO",
      category: "Fabric",
      strapASrc: `${SEL}/clean/charcoal-seatbelt-nato-buckle.png`,
      strapBSrc: `${SEL}/clean/charcoal-seatbelt-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.085
    }
  ],
  Metal: []
};

export const STRAP_CATEGORIES: StrapCategory[] = [
  "All categories",
  "Leather",
  "Rubber",
  "Fabric"
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
