import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { RESERVED, cleanHandle } from "@/lib/handles";
import { notifySubscribers } from "@/lib/notify";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// POST { memory_id, handle } / DELETE { memory_id, handle } — 60 felt actions / 5 min / IP.
export async function POST(req: Request) {
  return felt(req, true);
}

export async function DELETE(req: Request) {
  return felt(req, false);
}

async function felt(req: Request, add: boolean) {
  const ip = clientIp(req);
  const rl = rateLimit(`felt:${ip}`, 60, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many felts — slow down" },
      { status: 429, headers: rateLimitHeaders(rl.remaining, 60, rl.resetMs) }
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

  const sb = createClient(URL, ANON);
  if (add) {
    const { error } = await sb.from("felt").insert({ memory_id: b.memory_id, handle });
    if (error && error.code !== "23505") return NextResponse.json({ error: "felt failed" }, { status: 500 });
    // reply loop: tell the author someone felt them (awaited — serverless freezes after response)
    // NOTE: `new URL()` unusable here — the Supabase `URL` const shadows the global.
    await notifySubscribers({ memoryId: b.memory_id, actorHandle: handle, kind: "felt", snippet: "", origin: req.headers.get("origin") || "" });
  } else {
    await sb.from("felt").delete().eq("memory_id", b.memory_id).eq("handle", handle);
  }
  return NextResponse.json({ ok: true });
}
