import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getOgShowcaseStraps } from "@/lib/strapSeo";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

const toDataUrl = async (src: string) => {
  const filePath = path.join(process.cwd(), "public", src.replace(/^\//, ""));
  const image = await readFile(filePath);
  return `data:image/png;base64,${image.toString("base64")}`;
};

export default async function StrapsOpenGraphImage() {
  const showcase = getOgShowcaseStraps();
  const showcaseImages = await Promise.all(
    showcase.flatMap((strap) => [strap.strapASrc, strap.strapBSrc].map((src) => toDataUrl(src)))
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(140deg, #fffdf8 0%, #f8efe3 55%, #f4d7af 100%)",
          color: "#201813",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -40,
            bottom: -180,
            width: 580,
            height: 580,
            borderRadius: "9999px",
            background: "rgba(236, 143, 36, 0.2)"
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "72px 78px",
            width: "100%"
          }}
        >
          <div style={{ fontSize: 32, letterSpacing: 1, color: "#6f5a45" }}>Watchstrapper</div>
          <div style={{ marginTop: 28, fontSize: 70, lineHeight: 1.04, fontWeight: 700, width: 730 }}>
            Explore the strap catalogue.
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#5f5143",
              width: 760
            }}
          >
            Browse leather, fabric, rubber, and metal straps with style tags, materials, and fit-ready imagery.
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              gap: 18,
              alignItems: "flex-end"
            }}
          >
            {showcase.map((strap, index) => (
              <div
                key={strap.id}
                style={{
                  width: 118,
                  height: 250,
                  borderRadius: 28,
                  background: "rgba(255,250,243,0.96)",
                  border: "1px solid rgba(181, 148, 109, 0.32)",
                  boxShadow: "0 24px 40px rgba(49, 32, 21, 0.14)",
                  transform: `rotate(${index % 2 === 0 ? -3 : 4}deg)`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "14px 10px"
                }}
              >
                <div
                  style={{
                    height: 98,
                    borderRadius: 20,
                    background: "#f7f2ea",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden"
                  }}
                >
                  <img
                    src={showcaseImages[index * 2]}
                    alt=""
                    style={{ width: "82%", height: "82%", objectFit: "contain" }}
                  />
                </div>
                <div
                  style={{
                    height: 98,
                    borderRadius: 20,
                    background: "#f7f2ea",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden"
                  }}
                >
                  <img
                    src={showcaseImages[index * 2 + 1]}
                    alt=""
                    style={{ width: "82%", height: "82%", objectFit: "contain" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
