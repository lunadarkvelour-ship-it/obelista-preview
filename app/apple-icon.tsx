import { ImageResponse } from "next/og";

// iOS не берёт SVG под ярлык на домашнем экране — нужен растр. Рисуем его из той
// же геометрии, что и app/icon.svg, чтобы фавикон и ярлык не разъезжались.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const GLYPH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="180" height="180">
  <rect width="512" height="512" fill="#151517"/>
  <circle cx="256" cy="256" r="148" fill="none" stroke="#FAFAFA" stroke-width="34"/>
  <path d="M125 256 H290" fill="none" stroke="#C422CA" stroke-width="34"/>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#151517" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width="180" height="180" src={`data:image/svg+xml;base64,${Buffer.from(GLYPH).toString("base64")}`} alt="" />
      </div>
    ),
    size
  );
}
