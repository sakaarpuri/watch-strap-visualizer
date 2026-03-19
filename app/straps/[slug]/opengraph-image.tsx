import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getStrapBySlug } from "@/lib/strapLibrary";

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

const humanize = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default async function StrapOpenGraphImage({ params }: { params: { slug: string } }) {
  const strap = getStrapBySlug(params.slug);

  if (!strap) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fffdf8",
            color: "#201813",
            fontFamily: "Arial, sans-serif",
            fontSize: 56,
            fontWeight: 700
          }}
        >
          Strap not found
        </div>
      ),
      size
    );
  }

  const [strapADataUrl, strapBDataUrl] = await Promise.all([toDataUrl(strap.strapASrc), toDataUrl(strap.strapBSrc)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(140deg, #fffdf8 0%, #f8efe3 58%, #f4d7af 100%)",
          color: "#201813",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            bottom: -180,
            width: 520,
            height: 520,
            borderRadius: "9999px",
            background: "rgba(236, 143, 36, 0.18)"
          }}
        />
        <div
          style={{
            display: "flex",
            width: "100%",
            padding: "70px 74px",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: 650 }}>
            <div style={{ fontSize: 30, letterSpacing: 1, color: "#6f5a45" }}>Watchstrapper</div>
            <div style={{ marginTop: 24, fontSize: 68, lineHeight: 1.02, fontWeight: 700 }}>{strap.label}</div>
            <div style={{ marginTop: 18, fontSize: 28, lineHeight: 1.35, color: "#5f5143" }}>
              {humanize(strap.shopping.material)} strap · {humanize(strap.shopping.styleFamily)} finish ·{" "}
              {humanize(strap.shopping.hardwareFinish)} hardware
            </div>
            <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {strap.styleTags.slice(0, 3).map((tag) => (
                <div
                  key={tag}
                  style={{
                    border: "1px solid rgba(176, 142, 102, 0.45)",
                    borderRadius: 9999,
                    padding: "10px 18px",
                    background: "rgba(255, 250, 243, 0.94)",
                    fontSize: 20,
                    color: "#5f5143",
                    textTransform: "uppercase",
                    letterSpacing: 1.4
                  }}
                >
                  {tag}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
            <div
              style={{
                width: 118,
                height: 370,
                borderRadius: 30,
                background: "#f7f2ea",
                border: "1px solid rgba(176, 142, 102, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}
            >
              <img
                src={strapADataUrl}
                alt=""
                style={{ width: "84%", height: "84%", objectFit: "contain" }}
              />
            </div>
            <div
              style={{
                width: 118,
                height: 370,
                borderRadius: 30,
                background: "#f7f2ea",
                border: "1px solid rgba(176, 142, 102, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}
            >
              <img
                src={strapBDataUrl}
                alt=""
                style={{ width: "84%", height: "84%", objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
