import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { RESERVED, cleanHandle } from "@/lib/handles";
import { notifySubscribers } from "@/lib/notify";
import { handleLockedByOther } from "@/lib/auth-session";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// POST comment — 12 / 5 min / IP.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`comment:${ip}`, 12, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many comments — slow down" },
      { status: 429, headers: rateLimitHeaders(rl.remaining, 12, rl.resetMs) }
    );
  }
  if (!URL || !ANON) return NextResponse.json({ error: "server misconfigured" }, { status: 500 });

  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const handle = cleanHandle(b.handle);
  if (!handle || RESERVED.includes(handle) || handle === "you")
    return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  if (typeof b.memory_id !== "string" || !b.memory_id)
    return NextResponse.json({ error: "invalid memory" }, { status: 400 });
  if (typeof b.text !== "string" || !b.text.trim() || b.text.trim().length > 280)
    return NextResponse.json({ error: "invalid text" }, { status: 400 });
  if (await handleLockedByOther(handle))
    return NextResponse.json({ error: "that @ is locked to another account — sign in as them or pick another" }, { status: 403 });

  const sb = createClient(URL, ANON);
  const { data, error } = await sb
    .from("comments")
    .insert({ memory_id: b.memory_id, handle, text: b.text.trim().slice(0, 280) })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "comment failed" }, { status: 500 });
  // reply loop: tell the author someone replied (awaited — serverless freezes after response)
  await notifySubscribers({ memoryId: b.memory_id, actorHandle: handle, kind: "comment", snippet: b.text.trim(), origin: req.headers.get("origin") || "" });
  return NextResponse.json({ ok: true, id: data.id });
}
