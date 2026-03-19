import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getOgShowcaseStraps, SITE_URL } from "@/lib/strapSeo";

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

export default async function OpenGraphImage() {
  const showcase = getOgShowcaseStraps().slice(0, 3);
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
            "linear-gradient(140deg, #fffdf8 0%, #fbf4ea 52%, #f6dfc1 100%)",
          color: "#201813",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -80,
            bottom: -140,
            width: 520,
            height: 520,
            borderRadius: "9999px",
            background: "rgba(244, 142, 28, 0.22)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 70,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div
            style={{
              fontSize: 34,
              letterSpacing: 1,
              color: "#6f5a45"
            }}
          >
            Watchstrapper
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 72,
              lineHeight: 1.02,
              fontWeight: 700,
              width: 760
            }}
          >
            See any strap on your watch before you buy.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 28,
              lineHeight: 1.35,
              color: "#5f5143",
              width: 760
            }}
          >
            Upload your watch photo, preview different strap styles, and compare the fit before you commit.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 76,
            top: 78,
            display: "flex",
            gap: 18,
            alignItems: "flex-end"
          }}
        >
          {showcase.map((strap, index) => (
            <div
              key={strap.id}
              style={{
                width: 126,
                height: 380,
                borderRadius: 30,
                background: "rgba(255,250,243,0.96)",
                border: "1px solid rgba(181, 148, 109, 0.32)",
                boxShadow: "0 28px 44px rgba(49, 32, 21, 0.14)",
                transform: `rotate(${index === 1 ? -7 : index === 2 ? 6 : -3}deg)`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "18px 12px"
              }}
            >
              <div
                style={{
                  height: 150,
                  borderRadius: 22,
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
                  style={{ width: "84%", height: "84%", objectFit: "contain" }}
                />
              </div>
              <div
                style={{
                  height: 150,
                  borderRadius: 22,
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
                  style={{ width: "84%", height: "84%", objectFit: "contain" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
