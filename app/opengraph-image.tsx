import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AutoAgentX AI video editor";
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
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#090C12",
          color: "#fffaf0",
          padding: "54px 64px",
          flexDirection: "column",
          justifyContent: "space-between"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20
          }}
        >
          <div
            style={{
              width: 94,
              height: 94,
              borderRadius: 24,
              background: "linear-gradient(135deg, #A03BFF, #5A7BFF 55%, #55F7FF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#090C12",
              fontSize: 34,
              fontWeight: 800
            }}
          >
            AAX
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#9BA1B2" }}>AutoAgentX</div>
            <div style={{ fontSize: 34, fontWeight: 800 }}>AI Editor Studio</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 920 }}>
          <div style={{ fontSize: 76, lineHeight: 1.02, fontWeight: 900 }}>Turn boring clips into high-retention shorts</div>
          <div style={{ marginTop: 22, fontSize: 30, lineHeight: 1.35, color: "#B7BECC" }}>
            Stronger hooks, cleaner subtitles, and faster short-form editing for TikTok, Reels, and YouTube Shorts.
          </div>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {["AI video editor", "subtitle editor", "short-form retention"].map((item) => (
            <div
              key={item}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
                padding: "12px 18px",
                fontSize: 22,
                color: "#D9DDE6"
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
