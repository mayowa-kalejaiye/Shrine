import { NextRequest, NextResponse } from "next/server";

// Proxy for Nominatim (OSM usage policy requires a User-Agent — browsers can't set one, so we do it server-side)
const HEADERS = {
  "User-Agent": "shrine.so/1.0 (memories map)",
  "Accept-Language": "en",
  "Referer": "https://shrine.so/",
};

const cache = new Map<string, { at: number; data: any }>();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const lat = req.nextUrl.searchParams.get("lat") || "";
  const lon = req.nextUrl.searchParams.get("lon") || "";
  if (!q && !(lat && lon)) return NextResponse.json([], { status: 400 });

  const key = q ? `q:${q.toLowerCase()}` : `r:${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 1000 * 60 * 10) return NextResponse.json(hit.data);

  try {
    const url = q
      ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`
      : `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const r = await fetch(url, { headers: HEADERS });
    if (r.ok) {
      const data = await r.json();
      if ((Array.isArray(data) && data.length) || (!Array.isArray(data) && (data as any).display_name)) {
        cache.set(key, { at: Date.now(), data });
        return NextResponse.json(data);
      }
    }
  } catch {}
  // fallback: Photon (no key, generous limits) — same shape as nominatim
  try {
    if (!q) return NextResponse.json({ error: "geocoder busy, try again" }, { status: 502 });
    const pr = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`, { headers: { "User-Agent": "shrine.so/1.0" } });
    if (!pr.ok) return NextResponse.json({ error: "geocoder busy, try again" }, { status: 502 });
    const pj = await pr.json();
    const data = (pj.features || []).map((f: any) => {
      const p = f.properties || {};
      const name = p.name || p.city || p.locality || q;
      const place = [p.city || p.locality, p.state, p.country].filter(Boolean).join(", ");
      return {
        display_name: place ? `${name}, ${place}` : name,
        lat: String(f.geometry.coordinates[1]),
        lon: String(f.geometry.coordinates[0]),
        name,
      };
    });
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "geocoder failed" }, { status: 502 });
  }
}
