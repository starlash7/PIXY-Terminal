import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const attachmentDir = path.join(process.cwd(), "..", ".context", "attachments");
  const candidates = [
    { fileName: "eadacb9ff56ce317c81a1340cde0d089.jpg", contentType: "image/jpeg" },
    { fileName: "ascii-dither-export (1).jpg", contentType: "image/jpeg" },
    { fileName: "ascii-dither-export.jpg", contentType: "image/jpeg" },
    { fileName: "image-v3.png", contentType: "image/png" },
  ];

  for (const candidate of candidates) {
    try {
      const buffer = await readFile(path.join(attachmentDir, candidate.fileName));

      return new Response(buffer, {
        headers: {
          "Content-Type": candidate.contentType,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      // Try the next fallback image.
    }
  }

  {
    const fallbackSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" fill="none">
        <rect width="640" height="640" rx="48" fill="#11151b"/>
        <rect x="40" y="40" width="560" height="560" rx="40" fill="#0d1117" stroke="#28313a"/>
        <circle cx="320" cy="244" r="104" fill="#17212b"/>
        <circle cx="284" cy="220" r="18" fill="#9fffd0"/>
        <circle cx="356" cy="220" r="18" fill="#9fffd0"/>
        <path d="M268 292c24 24 80 24 104 0" stroke="#9fffd0" stroke-width="18" stroke-linecap="round"/>
        <path d="M222 412c30-46 82-70 98-70s68 24 98 70" stroke="#49e3a5" stroke-width="18" stroke-linecap="round"/>
        <text x="320" y="540" text-anchor="middle" fill="#9aa7b4" font-size="34" font-family="monospace">PIXY PLACEHOLDER</text>
      </svg>
    `.trim();

    return new Response(fallbackSvg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  }
}
