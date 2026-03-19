import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
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
            right: 110,
            top: 100,
            display: "flex",
            gap: 24,
            alignItems: "center"
          }}
        >
          {["#2e4c77", "#7f2d2d", "#425e37"].map((color, index) => (
            <div
              key={color}
              style={{
                width: 86,
                height: 310,
                borderRadius: 28,
                background: color,
                boxShadow: "0 28px 44px rgba(49, 32, 21, 0.16)",
                transform: `rotate(${index === 1 ? -8 : index === 2 ? 7 : -2}deg)`
              }}
            />
          ))}
        </div>
      </div>
    ),
    size
  );
}
