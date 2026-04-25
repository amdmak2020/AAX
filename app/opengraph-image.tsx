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
            gap: 28
          }}
        >
          <div
            style={{
              width: 110,
              height: 110,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <svg fill="none" viewBox="0 0 64 64" width="110" height="110">
              <defs>
                <linearGradient id="aaxOgGradient" x1="10" x2="56" y1="54" y2="12" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#A03BFF" />
                  <stop offset="0.55" stopColor="#5A7BFF" />
                  <stop offset="1" stopColor="#21C8FF" />
                </linearGradient>
              </defs>
              <path d="M11.8 53c-1.8 0-3.3-1.2-3.8-3-.4-1.4-.1-2.8.7-4L28.6 13.5c1.5-2.5 3.4-3.9 5.6-3.9 2.3 0 4.2 1.4 5.7 4.1L58.6 46c.7 1.2 1 2.6.6 3.9-.5 1.8-2 3.1-3.8 3.1-1 0-2-.4-2.8-1l-7-3.3c-1.4-.7-2.4-1.7-3-3l-6.9-12.5c-.5-.9-1.2-1.4-2-1.4-.8 0-1.5.5-2 1.4l-3.1 5.8 4.3 7.7c.5 1 .4 2.2-.2 3.1-.7 1-1.8 1.6-3 1.6H11.8Z" fill="url(#aaxOgGradient)" />
              <path d="M24.3 41.1c4.7 0 8.6-3.4 9.7-8 1.1 4.6 5 8 9.7 8-4.7 0-8.6 3.4-9.7 8-1.1-4.6-5-8-9.7-8Z" fill="#55D9FF" />
              <rect x="43.2" y="35.8" width="2.8" height="2.8" rx="0.4" fill="#B8F4FF" />
              <rect x="46.9" y="39.5" width="2.8" height="2.8" rx="0.4" fill="#B8F4FF" />
              <rect x="43.2" y="43.2" width="2.8" height="2.8" rx="0.4" fill="#B8F4FF" />
              <circle cx="53.2" cy="49.7" r="1.4" fill="#B8F4FF" />
              <path d="M53.2 49.8 57 53.5" stroke="#B8F4FF" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 24, letterSpacing: 7, textTransform: "uppercase", color: "#9BA1B2" }}>AAX</div>
            <div style={{ fontSize: 40, fontWeight: 800 }}>AutoAgentX</div>
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
