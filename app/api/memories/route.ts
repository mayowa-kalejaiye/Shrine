import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { RESERVED, cleanHandle } from "@/lib/handles";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// POST memory pin — 8 pins / 10 min / IP. Photo payloads capped (base64 bloat guard).
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`pin:${ip}`, 8, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many pins — slow down" },
      { status: 429, headers: rateLimitHeaders(rl.remaining, 8, rl.resetMs) }
    );
  }
  if (!URL || !ANON) return NextResponse.json({ error: "server misconfigured" }, { status: 500 });

  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const handle = cleanHandle(b.handle);
  if (!handle || RESERVED.includes(handle) || handle === "you")
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  if (typeof b.line !== "string" || !b.line.trim() || b.line.length > 80)
    return NextResponse.json({ error: "invalid line" }, { status: 400 });
  if (typeof b.city !== "string" || !b.city.trim())
    return NextResponse.json({ error: "invalid city" }, { status: 400 });
  if (typeof b.lat !== "number" || typeof b.lng !== "number" || Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180)
    return NextResponse.json({ error: "invalid coords" }, { status: 400 });

  // base64 guard: photos ~150kb each, 1 optional video ~8mb — enforced server-side
  const imgs: string[] = Array.isArray(b.images) ? b.images.slice(0, 3) : [];
  for (const p of imgs) {
    if (typeof p !== "string") return NextResponse.json({ error: "invalid photo" }, { status: 400 });
    const isVideo = p.startsWith("data:video/");
    if (!p.startsWith("data:image/") && !isVideo)
      return NextResponse.json({ error: "invalid photo" }, { status: 400 });
    if (p.length > (isVideo ? 12_000_000 : 200_000))
      return NextResponse.json({ error: "file too big" }, { status: 400 });
  }
  if (imgs.filter(p => p.startsWith("data:video/")).length > 1)
    return NextResponse.json({ error: "one video max" }, { status: 400 });
  const cover = typeof b.image === "string" ? b.image.slice(0, 200_000) : imgs[0];
  if (!cover) return NextResponse.json({ error: "photo required" }, { status: 400 });

  const sb = createClient(URL, ANON);
  await sb.from("users").upsert({ handle }, { onConflict: "handle" });
  const { data, error } = await sb
    .from("memories")
    .insert({ handle, city: b.city.slice(0, 80), lat: b.lat, lng: b.lng, line: b.line.toLowerCase().slice(0, 80), image: cover, images: imgs })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "pin failed" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
