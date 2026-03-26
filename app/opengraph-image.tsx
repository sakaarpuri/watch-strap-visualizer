import { ImageResponse } from "next/og";

export const runtime = "edge";
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
const navy = "#243b63";
const sand = "#d7b287";
const silver = "#cdd3db";

export default function OpenGraphImage() {
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
            background: "rgba(255,255,255,0.72)",
            boxShadow: "0 18px 42px rgba(80, 58, 30, 0.08)"
          }}
        >
          <div
            style={{
              width: "52%",
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
                  fontSize: 66,
                  lineHeight: 1.04,
                  fontWeight: 700,
                  maxWidth: 520
                }}
              >
                <span>Try straps</span>
                <span>on your watch</span>
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
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 360,
                height: 360,
                borderRadius: "50%",
                border: `16px solid ${silver}`,
                background: "#ffffff",
                boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.8)"
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 468,
                height: 40,
                display: "flex",
                justifyContent: "space-between",
                transform: "translateY(-188px)"
              }}
            >
              <div style={{ width: 86, height: 20, borderRadius: 999, background: silver }} />
              <div style={{ width: 86, height: 20, borderRadius: 999, background: silver }} />
            </div>
            <div
              style={{
                position: "absolute",
                width: 468,
                height: 40,
                display: "flex",
                justifyContent: "space-between",
                transform: "translateY(188px)"
              }}
            >
              <div style={{ width: 86, height: 20, borderRadius: 999, background: silver }} />
              <div style={{ width: 86, height: 20, borderRadius: 999, background: silver }} />
            </div>
            <div
              style={{
                position: "absolute",
                width: 90,
                height: 232,
                borderRadius: 18,
                background: `linear-gradient(180deg, ${navy}, #35527c)`,
                transform: "translateY(-296px)"
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 90,
                height: 250,
                borderRadius: 18,
                background: `linear-gradient(180deg, ${sand}, #b78b5c)`,
                transform: "translateY(314px)"
              }}
            />
          </div>
        </div>
      </div>
    ),
    size
  );
}
