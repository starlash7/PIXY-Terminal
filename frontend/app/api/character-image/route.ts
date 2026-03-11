import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const imagePath = path.join(
    process.cwd(),
    "..",
    ".context",
    "attachments",
    "image-v3.png",
  );
  const buffer = await readFile(imagePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
