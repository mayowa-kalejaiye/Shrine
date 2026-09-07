// Client-side photo prep: downscale + JPEG so pins arrive INTACT under server caps.
// Why: the old code chopped base64 at 150kb mid-stream. The author kept the full
// local copy (looked fine to them) while everyone else got a corrupt stub.
// Never send more than the cap — compress until it fits, else reject.
function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export async function fileToCover(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("type");
  if (file.size > 8 * 1024 * 1024) throw new Error("size");
  const original = await readAsDataURL(file);
  if (original.length <= 150000) return original;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return await fitImage(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Re-compress an existing data URL (e.g. healing a pre-fix pin whose server copy
// got truncated — the author's local copy is intact). Throws on non-images/oversize.
export async function compressDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) throw new Error("type");
  if (dataUrl.length <= 200000) return dataUrl;
  const img = await loadImage(dataUrl);
  return await fitImage(img);
}

async function fitImage(img: HTMLImageElement): Promise<string> {
  for (const [maxDim, quality] of [[1600, 0.82], [1200, 0.75], [900, 0.7]] as const) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const out = c.toDataURL("image/jpeg", quality);
    if (out.length <= 200000) return out;
  }
  throw new Error("size");
}
