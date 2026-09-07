import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { RESERVED, cleanHandle } from "@/lib/handles";
import { sessionUser } from "@/lib/auth-session";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function db() {
  // service role needed for linking/updating existing rows (anon has insert-only RLS)
  return createClient(URL, SERVICE || ANON);
}

// POST { handle } — claims a handle for YOUR signed-in account. 1 account per @,
// 1 @ per account, enforced here (rate-limited).
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

  const me = await sessionUser();
  if (!me) return NextResponse.json({ error: "sign in to claim — one account per @" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const handle = cleanHandle(body.handle);
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });
  if (RESERVED.includes(handle)) return NextResponse.json({ error: "reserved" }, { status: 409 });

  const sb = db();
  // one @ per account: already holding a different handle?
  const { data: mine } = await sb.from("users").select("handle").eq("auth_user_id", me.id).limit(1);
  const owned = (mine as any[] | null)?.[0]?.handle as string | undefined;
  if (owned && owned !== handle) {
    return NextResponse.json({ error: `your account already holds @${owned} — one @ per account` }, { status: 409 });
  }
  if (owned === handle) return NextResponse.json({ ok: true, handle });

  const { data: row } = await sb.from("users").select("auth_user_id").eq("handle", handle).limit(1).maybeSingle() as any;
  if (row?.auth_user_id && row.auth_user_id !== me.id) {
    return NextResponse.json({ error: "taken" }, { status: 409 });
  }
  const { data: pins } = await sb.from("memories").select("id").eq("handle", handle).limit(1);
  if (pins && pins.length && !row) {
    // pins exist but no users row (legacy) — can't verify owner, stay conservative
    return NextResponse.json({ error: "taken" }, { status: 409 });
  }
  // fresh handle, or legacy unlinked row (pins or not): first verified claim links it
  if (row) {
    const { error } = await sb.from("users").update({ auth_user_id: me.id }).eq("handle", handle);
    if (error) return NextResponse.json({ error: "claim failed" }, { status: 500 });
    return NextResponse.json({ ok: true, handle });
  }
  const { error } = await sb.from("users").upsert({ handle, auth_user_id: me.id }, { onConflict: "handle" });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "taken" }, { status: 409 });
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, handle });
}
