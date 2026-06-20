// Copyright © 2026 Workforce. All rights reserved.
// Generates the Workforce PWA icon at any size — served as PNG via ImageResponse

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// The Workforce logo SVG — W strokes + orange location pin + clock face
function buildSvg(px: number): string {
  const s = px * 0.82;
  return `<svg width="${s}" height="${s}" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 13L15 44L25 26" stroke="white" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M31 26L41 44L51 13" stroke="white" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M28 6C22 6 17 11 17 17C17 25 28 36 28 36C28 36 39 25 39 17C39 11 34 6 28 6Z" fill="#FF6A00"/>
  <circle cx="28" cy="17" r="6" fill="white"/>
  <line x1="28" y1="17" x2="28" y2="12.5" stroke="#FF6A00" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="28" y1="17" x2="32" y2="19" stroke="#FF6A00" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { size: string } }
) {
  const size = Math.min(Math.max(parseInt(params.size) || 192, 16), 1024);
  const svgB64 = Buffer.from(buildSvg(size)).toString("base64");
  const src = `data:image/svg+xml;base64,${svgB64}`;
  const iconSize = Math.round(size * 0.82);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "linear-gradient(145deg, #1E3A8A 0%, #3730A3 45%, #5B21B6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={iconSize} height={iconSize} alt="" />
      </div>
    ),
    { width: size, height: size }
  );
}
