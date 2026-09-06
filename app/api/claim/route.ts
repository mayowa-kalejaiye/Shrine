import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { RESERVED, cleanHandle } from "@/lib/handles";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// POST { handle } — claims a handle (rate-limited).
// Checks BOTH users + memories tables (client only checked memories).
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`claim:${ip}`, 10, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many claims — try again later" },
      { status: 429, headers: rateLimitHeaders(rl.remaining, 10, rl.resetMs) }
    );
  }
  if (!URL || !ANON) return NextResponse.json({ error: "server misconfigured" }, { status: 500 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const handle = cleanHandle(body.handle);
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });
  if (RESERVED.includes(handle)) return NextResponse.json({ error: "reserved" }, { status: 409 });

  const sb = createClient(URL, ANON);
  // users table first (client never checked this — the main loophole)
  const { data: u } = await sb.from("users").select("id").eq("handle", handle).limit(1);
  if (u && u.length) return NextResponse.json({ error: "taken" }, { status: 409 });
  const { data: m } = await sb.from("memories").select("id").eq("handle", handle).limit(1);
  if (m && m.length) return NextResponse.json({ error: "taken" }, { status: 409 });

  const { error } = await sb.from("users").upsert({ handle }, { onConflict: "handle" });
  if (error) {
    // race: someone claimed between check + insert
    if (error.code === "23505") return NextResponse.json({ error: "taken" }, { status: 409 });
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, handle });
}
