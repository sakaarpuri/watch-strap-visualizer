import type { StrapStyle } from "@/lib/compose";

export type StrapCategory =
  | "All categories"
  | "Leather"
  | "Rubber"
  | "Fabric"
  | "Metal"
  | "Women";

export interface StrapShoppingMeta {
  material: "leather" | "rubber" | "fabric" | "metal";
  styleFamily:
    | "classic"
    | "smooth"
    | "grain"
    | "suede"
    | "pebbled"
    | "pull-up"
    | "saffiano"
    | "canvas"
    | "sailcloth"
    | "nato"
    | "rubber"
    | "tropic"
    | "fkm"
    | "performance"
    | "bracelet"
    | "link-bracelet"
    | "mesh";
  colorFamily:
    | "black"
    | "brown"
    | "tan"
    | "beige"
    | "burgundy"
    | "blue"
    | "green"
    | "gray"
    | "silver"
    | "gold"
    | "multicolor"
    | "orange";
  hardwareFinish: "silver" | "black" | "gold";
  keywords: string[];
}

export interface StrapVariant {
  id: string;
  label: string;
  category: StrapCategory;
  strapASrc: string;
  strapBSrc: string;
  tint: StrapStyle;
  shopping: StrapShoppingMeta;
  autoFitWidthFactor?: number;
  autoGapFactor?: number;
  joinShape?: "flat" | "curved";
}

type RawStrapVariant = Omit<StrapVariant, "shopping">;

const SEL = "/strap-selection-kie";

const ORIG_TINT: StrapStyle = { name: "Original", color: "#000000", alpha: 0 };

const inferShoppingMeta = (strap: RawStrapVariant): StrapShoppingMeta => {
  const haystack = `${strap.id} ${strap.label}`.toLowerCase();
  const inferredMaterial: StrapShoppingMeta["material"] = haystack.includes("bracelet") ||
    haystack.includes("mesh") ||
    haystack.includes("milanese") ||
    haystack.includes("metal")
    ? "metal"
    : haystack.includes("rubber") ||
        haystack.includes("tropic") ||
        haystack.includes("fkm") ||
        haystack.includes("performance")
      ? "rubber"
      : haystack.includes("nato") ||
          haystack.includes("canvas") ||
          haystack.includes("sailcloth") ||
          haystack.includes("fabric")
        ? "fabric"
        : "leather";

  const material: StrapShoppingMeta["material"] =
    strap.category === "Leather"
      ? "leather"
      : strap.category === "Rubber"
        ? "rubber"
        : strap.category === "Fabric"
          ? "fabric"
          : strap.category === "Metal"
            ? "metal"
            : inferredMaterial;

  let styleFamily: StrapShoppingMeta["styleFamily"] = "classic";
  if (material === "metal") {
    styleFamily = haystack.includes("milanese") ? "mesh" : haystack.includes("link") ? "link-bracelet" : "bracelet";
  } else if (material === "rubber") {
    styleFamily = haystack.includes("tropic")
      ? "tropic"
      : haystack.includes("fkm")
        ? "fkm"
        : haystack.includes("performance")
          ? "performance"
          : "rubber";
  } else if (material === "fabric") {
    styleFamily = haystack.includes("sailcloth")
      ? "sailcloth"
      : haystack.includes("canvas")
        ? "canvas"
        : "nato";
  } else if (haystack.includes("suede") || haystack.includes("nubuck")) {
    styleFamily = "suede";
  } else if (haystack.includes("pebbled")) {
    styleFamily = "pebbled";
  } else if (haystack.includes("pull-up")) {
    styleFamily = "pull-up";
  } else if (haystack.includes("saffiano")) {
    styleFamily = "saffiano";
  } else if (haystack.includes("grain")) {
    styleFamily = "grain";
  } else if (haystack.includes("smooth")) {
    styleFamily = "smooth";
  }

  const colorFamily: StrapShoppingMeta["colorFamily"] = haystack.includes("black") || haystack.includes("pvd")
    ? "black"
    : haystack.includes("espresso") ||
        haystack.includes("dark-brown") ||
        haystack.includes("chocolate") ||
        haystack.includes("bourbon") ||
        haystack.includes("cognac") ||
        haystack.includes("brown")
      ? "brown"
      : haystack.includes("tan") || haystack.includes("saffron")
        ? "tan"
        : haystack.includes("beige") || haystack.includes("sand")
          ? "beige"
          : haystack.includes("burgundy") || haystack.includes("oxblood") || haystack.includes("aubergine")
            ? "burgundy"
            : haystack.includes("navy") || haystack.includes("bond") || haystack.includes("indigo") || haystack.includes("talavera") || haystack.includes("sapphire")
              ? "blue"
              : haystack.includes("olive") || haystack.includes("forest") || haystack.includes("khaki") || haystack.includes("emerald") || haystack.includes("mustard")
                ? "green"
                : haystack.includes("gray") || haystack.includes("grey") || haystack.includes("slate") || haystack.includes("charcoal") || haystack.includes("gunmetal")
                  ? material === "metal"
                    ? "silver"
                    : "gray"
                  : haystack.includes("gold")
                    ? "gold"
                  : haystack.includes("orange")
                    ? "orange"
                    : haystack.includes("stripe") || haystack.includes("holi") || haystack.includes("oaxaca")
                      ? "multicolor"
                      : material === "metal"
                        ? "silver"
                        : "brown";

  const hardwareFinish: StrapShoppingMeta["hardwareFinish"] = haystack.includes("pvd")
    ? "black"
    : haystack.includes("gold")
      ? "gold"
      : "silver";
  const keywords = [...new Set(haystack.split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !["leather", "fabric", "rubber", "metal", "strap", "watch"].includes(token)))];

  return {
    material,
    styleFamily,
    colorFamily,
    hardwareFinish,
    keywords
  };
};

const withShopping = (strap: RawStrapVariant): StrapVariant => ({
  ...strap,
  shopping: inferShoppingMeta(strap)
});

const RAW_STRAP_LIBRARY: Record<Exclude<StrapCategory, "All categories">, RawStrapVariant[]> = {
  Leather: [
    {
      id: "leather-classic",
      label: "Classic Leather",
      category: "Leather",
      strapASrc: `${SEL}/classic-leather-buckle.png`,
      strapBSrc: `${SEL}/classic-leather-tail.png`,
      tint: ORIG_TINT
    },
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
      id: "leather-espresso-smooth",
      label: "Espresso Smooth Leather",
      category: "Leather",
      strapASrc: `${SEL}/espresso-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/espresso-smooth-leather-tail.png`,
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
      id: "leather-beige-suede",
      label: "Beige Suede Leather",
      category: "Leather",
      strapASrc: `${SEL}/beige-suede-leather-buckle.png`,
      strapBSrc: `${SEL}/beige-suede-leather-tail.png`,
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
      id: "leather-burgundy-pebbled",
      label: "Burgundy Pebbled Leather",
      category: "Leather",
      strapASrc: `${SEL}/burgundy-pebbled-leather-buckle.png`,
      strapBSrc: `${SEL}/burgundy-pebbled-leather-tail.png`,
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
      id: "leather-sand-suede",
      label: "Sand Suede Leather",
      category: "Leather",
      strapASrc: `${SEL}/sand-suede-leather-buckle.png`,
      strapBSrc: `${SEL}/sand-suede-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-tan-suede",
      label: "Tan Suede Leather",
      category: "Leather",
      strapASrc: `${SEL}/tan-suede-leather-buckle.png`,
      strapBSrc: `${SEL}/tan-suede-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-emerald-suede",
      label: "Emerald Suede",
      category: "Leather",
      strapASrc: `${SEL}/emerald-suede-buckle.png`,
      strapBSrc: `${SEL}/emerald-suede-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-sapphire-suede",
      label: "Sapphire Suede",
      category: "Leather",
      strapASrc: `${SEL}/sapphire-suede-buckle.png`,
      strapBSrc: `${SEL}/sapphire-suede-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-oxblood-suede",
      label: "Oxblood Suede",
      category: "Leather",
      strapASrc: `${SEL}/oxblood-suede-buckle.png`,
      strapBSrc: `${SEL}/oxblood-suede-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-aubergine-suede",
      label: "Aubergine Suede",
      category: "Leather",
      strapASrc: `${SEL}/aubergine-suede-buckle.png`,
      strapBSrc: `${SEL}/aubergine-suede-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "leather-mustard-suede",
      label: "Mustard Suede",
      category: "Leather",
      strapASrc: `${SEL}/mustard-suede-buckle.png`,
      strapBSrc: `${SEL}/mustard-suede-tail.png`,
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
      autoFitWidthFactor: 0.3
    },
    {
      id: "rubber-orange-tropic",
      label: "Orange Tropic Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-orange-tropic-buckle.png`,
      strapBSrc: `${SEL}/rubber-orange-tropic-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3
    },
    {
      id: "rubber-sand-fkm",
      label: "Sand FKM Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-sand-fkm-buckle.png`,
      strapBSrc: `${SEL}/rubber-sand-fkm-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.31
    },
    {
      id: "rubber-navy-performance",
      label: "Navy Performance Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/rubber-navy-performance-buckle.png`,
      strapBSrc: `${SEL}/rubber-navy-performance-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3
    },
    {
      id: "rubber-olive-performance",
      label: "Olive Performance Rubber",
      category: "Rubber",
      strapASrc: `${SEL}/olive-performance-rubber-buckle.png`,
      strapBSrc: `${SEL}/olive-performance-rubber-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3
    }
  ],
  Fabric: [
    {
      id: "fabric-grey-canvas",
      label: "Grey Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/grey-canvas-buckle.png`,
      strapBSrc: `${SEL}/grey-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.28
    },
    {
      id: "fabric-navy-canvas",
      label: "Navy Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/navy-canvas-buckle.png`,
      strapBSrc: `${SEL}/navy-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.28
    },
    {
      id: "fabric-sand-canvas",
      label: "Sand Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-sand-canvas-buckle.png`,
      strapBSrc: `${SEL}/fabric-sand-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.28
    },
    {
      id: "fabric-khaki-canvas",
      label: "Khaki Canvas",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-khaki-canvas-buckle.png`,
      strapBSrc: `${SEL}/fabric-khaki-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.28
    },
    {
      id: "fabric-black-sailcloth",
      label: "Black Sailcloth",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-black-sailcloth-buckle.png`,
      strapBSrc: `${SEL}/fabric-black-sailcloth-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.28
    },
    {
      id: "fabric-grey-sailcloth",
      label: "Grey Sailcloth",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-grey-sailcloth-buckle.png`,
      strapBSrc: `${SEL}/fabric-grey-sailcloth-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.28
    },
    {
      id: "fabric-bond-nato",
      label: "Bond NATO",
      category: "Fabric",
      strapASrc: `${SEL}/fabric-bond-nato-buckle.png`,
      strapBSrc: `${SEL}/fabric-bond-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-olive-seatbelt-nato",
      label: "Olive Seatbelt NATO",
      category: "Fabric",
      strapASrc: `${SEL}/clean/olive-seatbelt-nato-buckle.png`,
      strapBSrc: `${SEL}/clean/olive-seatbelt-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-navy-bond-nato",
      label: "Navy Bond NATO",
      category: "Fabric",
      strapASrc: `${SEL}/clean/navy-bond-nato-buckle.png`,
      strapBSrc: `${SEL}/clean/navy-bond-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-sand-stripe-nato",
      label: "Sand Stripe NATO",
      category: "Fabric",
      strapASrc: `${SEL}/clean/sand-stripe-nato-buckle.png`,
      strapBSrc: `${SEL}/clean/sand-stripe-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-charcoal-seatbelt-nato",
      label: "Charcoal Seatbelt NATO",
      category: "Fabric",
      strapASrc: `${SEL}/clean/charcoal-seatbelt-nato-buckle.png`,
      strapBSrc: `${SEL}/clean/charcoal-seatbelt-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-olive-nato",
      label: "Olive NATO",
      category: "Fabric",
      strapASrc: `${SEL}/olive-nato-buckle.png`,
      strapBSrc: `${SEL}/olive-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-jaipur-saffron-nato",
      label: "Jaipur Saffron NATO",
      category: "Fabric",
      strapASrc: `${SEL}/jaipur-saffron-nato-buckle.png`,
      strapBSrc: `${SEL}/jaipur-saffron-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-indigo-block-nato",
      label: "Indigo Block NATO",
      category: "Fabric",
      strapASrc: `${SEL}/indigo-block-nato-buckle.png`,
      strapBSrc: `${SEL}/indigo-block-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-holi-stripe-nato",
      label: "Holi Stripe NATO",
      category: "Fabric",
      strapASrc: `${SEL}/holi-stripe-nato-buckle.png`,
      strapBSrc: `${SEL}/holi-stripe-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-oaxaca-serape-nato",
      label: "Oaxaca Serape NATO",
      category: "Fabric",
      strapASrc: `${SEL}/oaxaca-serape-nato-buckle.png`,
      strapBSrc: `${SEL}/oaxaca-serape-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "fabric-talavera-blue-nato",
      label: "Talavera Blue NATO",
      category: "Fabric",
      strapASrc: `${SEL}/talavera-blue-nato-buckle.png`,
      strapBSrc: `${SEL}/talavera-blue-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    }
  ],
  Metal: [
    {
      id: "metal-steel-bracelet",
      label: "Steel Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/steel-bracelet-buckle.png`,
      strapBSrc: `${SEL}/steel-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3,
      joinShape: "curved"
    },
    {
      id: "metal-steel-link-bracelet",
      label: "Steel Link Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/steel-link-bracelet-buckle.png`,
      strapBSrc: `${SEL}/steel-link-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3,
      joinShape: "curved"
    },
    {
      id: "metal-black-pvd-bracelet",
      label: "Black PVD Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/black-pvd-bracelet-buckle.png`,
      strapBSrc: `${SEL}/black-pvd-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3,
      joinShape: "curved"
    },
    {
      id: "metal-gold-silver-bracelet",
      label: "Gold / Silver Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/gold-silver-bracelet-buckle.png`,
      strapBSrc: `${SEL}/gold-silver-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3,
      joinShape: "curved"
    },
    {
      id: "metal-gold-bracelet",
      label: "Gold Bracelet",
      category: "Metal",
      strapASrc: `${SEL}/gold-bracelet-buckle.png`,
      strapBSrc: `${SEL}/gold-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3,
      joinShape: "curved"
    }
  ],
  Women: [
    {
      id: "women-leather-beige-smooth",
      label: "Women's Beige Smooth Leather",
      category: "Women",
      strapASrc: `${SEL}/beige-smooth-leather-buckle.png`,
      strapBSrc: `${SEL}/beige-smooth-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "women-leather-taupe-nubuck",
      label: "Women's Taupe Nubuck Leather",
      category: "Women",
      strapASrc: `${SEL}/clean/taupe-nubuck-leather-buckle.png`,
      strapBSrc: `${SEL}/clean/taupe-nubuck-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "women-leather-sand-suede",
      label: "Women's Sand Suede Leather",
      category: "Women",
      strapASrc: `${SEL}/sand-suede-leather-buckle.png`,
      strapBSrc: `${SEL}/sand-suede-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "women-leather-aubergine-suede",
      label: "Women's Aubergine Suede",
      category: "Women",
      strapASrc: `${SEL}/aubergine-suede-buckle.png`,
      strapBSrc: `${SEL}/aubergine-suede-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "women-leather-oxblood-pebbled",
      label: "Women's Oxblood Pebbled Leather",
      category: "Women",
      strapASrc: `${SEL}/clean/oxblood-pebbled-leather-buckle.png`,
      strapBSrc: `${SEL}/clean/oxblood-pebbled-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "women-leather-cognac-grain",
      label: "Women's Cognac Grain Leather",
      category: "Women",
      strapASrc: `${SEL}/cognac-grain-leather-buckle.png`,
      strapBSrc: `${SEL}/cognac-grain-leather-tail.png`,
      tint: ORIG_TINT
    },
    {
      id: "women-fabric-navy-canvas",
      label: "Women's Navy Canvas",
      category: "Women",
      strapASrc: `${SEL}/navy-canvas-buckle.png`,
      strapBSrc: `${SEL}/navy-canvas-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.28
    },
    {
      id: "women-fabric-talavera-blue-nato",
      label: "Women's Talavera Blue NATO",
      category: "Women",
      strapASrc: `${SEL}/talavera-blue-nato-buckle.png`,
      strapBSrc: `${SEL}/talavera-blue-nato-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.27
    },
    {
      id: "women-metal-gold-silver-bracelet",
      label: "Women's Gold / Silver Bracelet",
      category: "Women",
      strapASrc: `${SEL}/gold-silver-bracelet-buckle.png`,
      strapBSrc: `${SEL}/gold-silver-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3,
      joinShape: "curved"
    },
    {
      id: "women-metal-gold-bracelet",
      label: "Women's Gold Bracelet",
      category: "Women",
      strapASrc: `${SEL}/gold-bracelet-buckle.png`,
      strapBSrc: `${SEL}/gold-bracelet-tail.png`,
      tint: ORIG_TINT,
      autoFitWidthFactor: 0.3,
      joinShape: "curved"
    }
  ]
};

export const STRAP_LIBRARY: Record<Exclude<StrapCategory, "All categories">, StrapVariant[]> = {
  Leather: RAW_STRAP_LIBRARY.Leather.map(withShopping),
  Rubber: RAW_STRAP_LIBRARY.Rubber.map(withShopping),
  Fabric: RAW_STRAP_LIBRARY.Fabric.map(withShopping),
  Metal: RAW_STRAP_LIBRARY.Metal.map(withShopping),
  Women: RAW_STRAP_LIBRARY.Women.map(withShopping)
};

export const STRAP_CATEGORIES: StrapCategory[] = [
  "All categories",
  "Leather",
  "Rubber",
  "Fabric",
  "Metal",
  "Women"
];

export const getStrapsForCategory = (category: StrapCategory): StrapVariant[] => {
  if (category === "All categories") {
    return [
      ...STRAP_LIBRARY.Leather,
      ...STRAP_LIBRARY.Rubber,
      ...STRAP_LIBRARY.Fabric,
      ...STRAP_LIBRARY.Metal,
      ...STRAP_LIBRARY.Women
    ];
  }
  return STRAP_LIBRARY[category];
};
