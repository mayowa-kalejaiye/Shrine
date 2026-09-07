import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanHandle } from "@/lib/handles";
import { sendAlertEmail, alertsConfigured } from "@/lib/notify";

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

  if (b.action === "notify-repair") {
    // email the author their pin needs repair — only works if they opted into alerts
    // (that's the only email we hold). otherwise the admin messages them manually.
    const handle = cleanHandle(b.handle);
    if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });
    if (!alertsConfigured()) return NextResponse.json({ error: "email sender missing" }, { status: 503 });
    const { data: subs } = await sb.from("alerts").select("email").eq("handle", handle);
    const emails = [...new Set((((subs || []) as any[]).map((s) => s.email).filter(Boolean)))];
    if (!emails.length) return NextResponse.json({ ok: true, sent: 0 });
    const sent = await sendAlertEmail(
      emails.join(","),
      "one of your shrine photos needs repair",
      `one of your pins is showing a broken photo to everyone else (your phone still has the good copy).\n\nopen the pin and tap "repair photos" — one tap, keeps all felts and comments.`
    );
    return NextResponse.json({ ok: true, sent: sent ? emails.length : 0 });
  }

  if (b.action === "scan-photos") {    // pre-fix truncation cut covers at exactly 150k (client) / 200k (server) chars.
    // intact compressed photos land anywhere below — exact hits are near-certain truncations.
    const { data, error } = await sb.from("memories").select("id,handle,line,created_at,image").order("created_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: usingServiceRole ? "scan failed" : "scan failed — set SUPABASE_SERVICE_ROLE_KEY", usingServiceRole }, { status: 500 });
    const suspects = (((data || []) as any[])
      .filter((r) => {
        const n = String(r.image || "").length;
        return n === 150000 || n === 200000;
      })
      .map((r) => ({ id: r.id, handle: r.handle, line: String(r.line || "").slice(0, 60), created_at: r.created_at })));
    return NextResponse.json({ ok: true, suspects, scanned: (data || []).length });
  }

  if (b.action === "stats") {    // Extensive tracking from existing tables — no new infra. Anon key reads what's
    // RLS-open (memories/comments/felt/users); reports/alerts need the service key.
    const day = 86400000;
    const since = new Date(Date.now() - 14 * day).toISOString();
    const counts: Record<string, number | null> = {};
    for (const t of ["memories", "comments", "felt", "users", "reports", "alerts"]) {
      const r = await sb.from(t).select("*", { count: "exact", head: true });
      counts[t] = r.error ? null : (r.count ?? 0);
    }
    const hid = await sb.from("memories").select("*", { count: "exact", head: true }).eq("hidden", true);
    // 14-day activity series
    const series: { day: string; memories: number; comments: number; felt: number; reports: number }[] = [];
    const buckets = new Map<string, { day: string; memories: number; comments: number; felt: number; reports: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * day).toISOString().slice(0, 10);
      const o = { day: d, memories: 0, comments: 0, felt: 0, reports: 0 };
      buckets.set(d, o);
      series.push(o);
    }
    const bump = (rows: any[] | null | undefined, key: "memories" | "comments" | "felt" | "reports") => {
      for (const r of rows || []) {
        const o = buckets.get(String(r.created_at).slice(0, 10));
        if (o) o[key]++;
      }
    };
    const sm = await sb.from("memories").select("created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
    bump(sm.data, "memories");
    const sc = await sb.from("comments").select("created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
    bump(sc.data, "comments");
    const sf = await sb.from("felt").select("created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
    bump(sf.data, "felt");
    const sr = await sb.from("reports").select("created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
    bump(sr.data, "reports");
    // top handles by recent pins
    const pins = await sb.from("memories").select("handle").order("created_at", { ascending: false }).limit(3000);
    const per = new Map<string, number>();
    for (const p of ((pins.data || []) as any[])) per.set(p.handle, (per.get(p.handle) || 0) + 1);
    const topHandles = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([handle, n]) => ({ handle, pins: n }));
    // recent activity
    const rm = await sb.from("memories").select("id,handle,city,line,hidden,created_at").order("created_at", { ascending: false }).limit(8);
    const rc = await sb.from("comments").select("id,memory_id,handle,text,created_at").order("created_at", { ascending: false }).limit(8);
    // open reports = reported memories neither hidden nor deleted
    const reps = await sb.from("reports").select("memory_id").order("created_at", { ascending: false }).limit(200);
    const repIds = [...new Set((((reps.data || []) as any[]).map((r) => r.memory_id)))];
    let openReports: number | null = reps.error ? null : 0;
    if (!reps.error && repIds.length) {
      const { data: hm } = await sb.from("memories").select("id,hidden").in("id", repIds.slice(0, 60));
      const state = new Map(((hm || []) as any[]).map((x) => [x.id, x.hidden]));
      openReports = repIds.filter((id) => state.has(id) && !state.get(id)).length;
    }
    return NextResponse.json({
      ok: true,
      counts,
      hidden: hid.error ? null : (hid.count ?? 0),
      openReports,
      series,
      topHandles,
      recentMemories: rm.data || [],
      recentComments: rc.data || [],
      usingServiceRole,
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
