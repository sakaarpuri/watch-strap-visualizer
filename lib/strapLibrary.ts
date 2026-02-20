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

const ORIG_TINT: StrapStyle = { name: "Original", color: "#000000", alpha: 0 };

export const STRAP_LIBRARY: Record<Exclude<StrapCategory, "All categories">, StrapVariant[]> = {
  Leather: [
    { id: "leather-classic", label: "Classic Leather", category: "Leather", strapASrc: BASE_A, strapBSrc: BASE_B, tint: ORIG_TINT }
  ],
  Rubber: [
    { id: "rubber-sport", label: "Sport Rubber", category: "Rubber", strapASrc: BASE_A, strapBSrc: BASE_B, tint: ORIG_TINT }
  ],
  Fabric: [
    { id: "fabric-nato", label: "NATO Fabric", category: "Fabric", strapASrc: BASE_A, strapBSrc: BASE_B, tint: ORIG_TINT }
  ],
  Metal: [
    { id: "metal-bracelet", label: "Steel Bracelet", category: "Metal", strapASrc: METAL_A, strapBSrc: METAL_B, tint: ORIG_TINT }
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
