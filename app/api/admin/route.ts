import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// SERVER-ONLY keys — never prefix with NEXT_PUBLIC_.
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

function denied() {
  if (!ADMIN_SECRET) {
    return NextResponse.json(
      { error: "ADMIN_SECRET not set — add it to Vercel env vars, redeploy, then retry" },
      { status: 503 }
    );
  }
  return null;
}

function authed(body: any): boolean {
  return typeof body?.secret === "string" && body.secret.length > 0 && body.secret === ADMIN_SECRET;
}

function svc() {
  // service role bypasses RLS (needed: reports have no select policy, memories have no update/delete).
  // falls back to anon if unset — reads will fail closed, writes will fail on RLS.
  return createClient(URL, SERVICE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
}

// POST { secret, action: 'list' }
// POST { secret, action: 'hide'|'unhide', memory_id }
// POST { secret, action: 'delete-memory', memory_id }
// POST { secret, action: 'delete-comment', comment_id }
export async function POST(req: Request) {
  const d = denied();
  if (d) return d;
  if (!URL) return NextResponse.json({ error: "server misconfigured" }, { status: 500 });

  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  if (!authed(b)) return NextResponse.json({ error: "wrong secret" }, { status: 401 });

  const sb = svc();
  const usingServiceRole = !!SERVICE;

  if (b.action === "list") {
    const { data: reports, error } = await sb.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: usingServiceRole ? "list failed" : "list failed — set SUPABASE_SERVICE_ROLE_KEY (anon key can't read reports by design)", usingServiceRole }, { status: 500 });
    const ids = [...new Set((reports || []).map((r: any) => r.memory_id))].slice(0, 60);
    let mems: any[] = [];
    if (ids.length) {
      const { data } = await sb.from("memories").select("id,handle,city,line,hidden,created_at").in("id", ids);
      mems = data || [];
    }
    return NextResponse.json({ ok: true, reports: reports || [], memories: mems, usingServiceRole });
  }

  if (b.action === "hide" || b.action === "unhide") {
    if (typeof b.memory_id !== "string" || !b.memory_id) return NextResponse.json({ error: "memory_id required" }, { status: 400 });
    const { error } = await sb.from("memories").update({ hidden: b.action === "hide" }).eq("id", b.memory_id);
    if (error) return NextResponse.json({ error: usingServiceRole ? "update failed" : "update failed — set SUPABASE_SERVICE_ROLE_KEY", usingServiceRole }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "delete-memory") {
    if (typeof b.memory_id !== "string" || !b.memory_id) return NextResponse.json({ error: "memory_id required" }, { status: 400 });
    // wipe reports first so the queue stays clean, then felt rows, then the memory
    await sb.from("reports").delete().eq("memory_id", b.memory_id);
    await sb.from("felt").delete().eq("memory_id", b.memory_id);
    await sb.from("comments").delete().eq("memory_id", b.memory_id);
    const { error } = await sb.from("memories").delete().eq("id", b.memory_id);
    if (error) return NextResponse.json({ error: usingServiceRole ? "delete failed" : "delete failed — set SUPABASE_SERVICE_ROLE_KEY", usingServiceRole }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "delete-comment") {
    if (typeof b.comment_id !== "string" || !b.comment_id) return NextResponse.json({ error: "comment_id required" }, { status: 400 });
    const { error } = await sb.from("comments").delete().eq("id", b.comment_id);
    if (error) return NextResponse.json({ error: usingServiceRole ? "delete failed" : "delete failed — set SUPABASE_SERVICE_ROLE_KEY", usingServiceRole }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
