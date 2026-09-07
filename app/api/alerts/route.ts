import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { cleanHandle } from "@/lib/handles";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function sessionEmail(): Promise<string | null> {
  try {
    const sup = await createServer();
    const { data } = await sup.auth.getUser();
    return data.user?.email || null;
  } catch {
    return null;
  }
}

function svc() {
  return createClient(URL, SERVICE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
}

// GET ?handle= → { subscribed } — only answers about YOUR OWN session email.
export async function GET(req: Request) {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ subscribed: false });
  // NOTE: can't use `new URL()` here — the Supabase `URL` const above shadows the global.
  const m = req.url.split("?handle=")[1]?.split("&")[0] || "";
  const handle = cleanHandle(decodeURIComponent(m));
  if (!handle) return NextResponse.json({ subscribed: false });
  if (!URL) return NextResponse.json({ subscribed: false });
  const { data } = await svc().from("alerts").select("handle").eq("handle", handle).eq("email", email).limit(1);
  return NextResponse.json({ subscribed: !!(data && data.length) });
}

// POST { handle } — subscribe YOUR session email to alerts for a handle.
// The email always comes from the verified session, never the body: nobody can
// subscribe someone else's address and spam them through our sender.
export async function POST(req: Request) {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const handle = cleanHandle(b.handle);
  if (!handle) return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  if (!URL || !SERVICE) return NextResponse.json({ error: "alerts not configured" }, { status: 503 });
  const { error } = await svc().from("alerts").upsert({ handle, email }, { onConflict: "handle,email" });
  if (error) return NextResponse.json({ error: "subscribe failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE { handle } — unsubscribe your session email.
export async function DELETE(req: Request) {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const handle = cleanHandle(b.handle);
  if (!handle) return NextResponse.json({ error: "invalid handle" }, { status: 400 });
  if (!URL || !SERVICE) return NextResponse.json({ error: "alerts not configured" }, { status: 503 });
  await svc().from("alerts").delete().eq("handle", handle).eq("email", email);
  return NextResponse.json({ ok: true });
}
