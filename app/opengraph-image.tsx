import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Watchstrapper share preview";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

const cream = "#fff9f2";
const line = "#eadcc8";
const ink = "#3b3128";
const muted = "#7a6a57";

const toDataUrl = async (src: string) => {
  const filePath = path.join(process.cwd(), "public", src.replace(/^\//, ""));
  const image = await readFile(filePath);
  const extension = path.extname(src).toLowerCase();
  const mimeType =
    extension === ".webp"
      ? "image/webp"
      : extension === ".jpg" || extension === ".jpeg"
        ? "image/jpeg"
        : "image/png";
  return `data:${mimeType};base64,${image.toString("base64")}`;
};

export default async function OpenGraphImage() {
  const cataloguePhoto = await toDataUrl("/catalogue-mockup-sample.png");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: cream,
          color: ink,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 78% 22%, rgba(255,184,84,0.28), transparent 24%), radial-gradient(circle at 18% 82%, rgba(52,84,132,0.10), transparent 28%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 46,
            right: 46,
            bottom: 42,
            display: "flex",
            border: `1px solid ${line}`,
            borderRadius: 32,
            background: "rgba(255,255,255,0.78)",
            boxShadow: "0 18px 42px rgba(80, 58, 30, 0.08)"
          }}
        >
          <div
            style={{
              width: "48%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "54px 52px"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: muted,
                  marginBottom: 24
                }}
              >
                Watchstrapper
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 62,
                  lineHeight: 1.04,
                  fontWeight: 700,
                  maxWidth: 500
                }}
              >
                <span>See any strap</span>
                <span>on your watch.</span>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  lineHeight: 1.4,
                  color: muted,
                  marginTop: 24,
                  maxWidth: 470
                }}
              >
                Upload a watch photo, preview pairings, and compare fit before you buy.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontSize: 22,
                color: muted
              }}
            >
              <div
                style={{
                  display: "flex",
                  padding: "12px 18px",
                  borderRadius: 999,
                  border: `1px solid ${line}`,
                  background: "rgba(255,255,255,0.86)"
                }}
              >
                watchstrapper.com
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 42px 40px 8px"
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                overflow: "hidden",
                borderRadius: 28,
                border: `1px solid ${line}`,
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 16px 32px rgba(58, 39, 18, 0.10)"
              }}
            >
              <img
                src={cataloguePhoto}
                alt="Sample watch on a real strap"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
