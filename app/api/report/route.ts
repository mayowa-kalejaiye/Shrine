import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { cleanHandle } from "@/lib/handles";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const REASONS = ["spam/ad", "hate/harassment", "gore/sexual", "fake/test", "other"];
const AUTO_HIDE_THRESHOLD = 3;

// POST { memory_id, reason, reporter? } — 5 reports / hour / IP.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`report:${ip}`, 5, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many reports — try again later" },
      { status: 429, headers: rateLimitHeaders(rl.remaining, 5, rl.resetMs) }
    );
  }

  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  if (typeof b.memory_id !== "string" || !b.memory_id)
    return NextResponse.json({ error: "invalid memory" }, { status: 400 });
  if (typeof b.reason !== "string" || !REASONS.includes(b.reason))
    return NextResponse.json({ error: "invalid reason" }, { status: 400 });
  const reporter = cleanHandle(b.reporter) || "anon";

  if (!URL || !ANON) return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  const sb = createClient(URL, ANON);
  const { error } = await sb.from("reports").insert({ memory_id: b.memory_id, reason: b.reason, reporter });
  if (error) return NextResponse.json({ error: "report failed" }, { status: 500 });

  // auto-hide at threshold — needs service role (bypasses RLS). without it, admin hides manually.
  let autoHidden = false;
  if (SERVICE) {
    const admin = createClient(URL, SERVICE);
    const { count } = await admin.from("reports").select("id", { count: "exact", head: true }).eq("memory_id", b.memory_id);
    if ((count || 0) >= AUTO_HIDE_THRESHOLD) {
      await admin.from("memories").update({ hidden: true }).eq("id", b.memory_id);
      autoHidden = true;
    }
  }
  return NextResponse.json({ ok: true, autoHidden });
}

export { REASONS };
