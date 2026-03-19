import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function StrapsOpenGraphImage() {
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
              gap: 22,
              alignItems: "flex-end"
            }}
          >
            {[
              { color: "#2c476d", height: 236 },
              { color: "#6b342b", height: 268 },
              { color: "#74787e", height: 252 },
              { color: "#4d6a3e", height: 228 }
            ].map((item) => (
              <div
                key={`${item.color}-${item.height}`}
                style={{
                  width: 90,
                  height: item.height,
                  borderRadius: 28,
                  background: item.color,
                  boxShadow: "0 24px 40px rgba(49, 32, 21, 0.14)"
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
