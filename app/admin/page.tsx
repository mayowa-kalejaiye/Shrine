"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Toaster, toast } from "sonner";

type Report = { id: string; memory_id: string; reason: string; reporter: string; created_at: string };
type Mem = { id: string; handle: string; city: string; line: string; hidden: boolean; created_at: string };
type Stats = {
  counts: Record<string, number | null>;
  hidden: number | null;
  openReports: number | null;
  series: { day: string; memories: number; comments: number; felt: number; reports: number }[];
  topHandles: { handle: string; pins: number }[];
  recentMemories: Mem[];
  recentComments: { id: string; memory_id: string; handle: string; text: string; created_at: string }[];
};

// Kill switch + tracking — not linked anywhere in the app. Open /admin directly.
// Needs ADMIN_SECRET (+ SUPABASE_SERVICE_ROLE_KEY for full power) in Vercel env.
export default function Admin() {
  // sessionStorage only exists in the browser — read after mount so /admin prerenders cleanly
  const [secret, setSecret] = useState("");
  useEffect(() => { try { setSecret(sessionStorage.getItem("shrine_admin") || ""); } catch {} }, []);
  const [tab, setTab] = useState<"queue" | "stats">("queue");
  const [reports, setReports] = useState<Report[]>([]);
  const [mems, setMems] = useState<Record<string, Mem>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [scan, setScan] = useState<{ suspects: { id: string; handle: string; line: string; created_at: string }[]; scanned: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [noService, setNoService] = useState(false);

  async function call(action: string, extra: any = {}) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, action, ...extra }),
    });
    const j = await res.json();
    if (!res.ok) { toast(j.error || "failed"); return null; }
    return j;
  }

  async function load() {
    const j = await call("list");
    if (!j) return;
    sessionStorage.setItem("shrine_admin", secret);
    setReports(j.reports);
    const m: Record<string, Mem> = {};
    for (const x of j.memories) m[x.id] = x;
    setMems(m);
    setNoService(!j.usingServiceRole);
    setLoaded(true);
    const s = await call("stats");
    if (s) setStats(s);
  }

  async function act(action: string, memory_id: string) {
    const j = await call(action, { memory_id });
    if (!j) return;
    toast(action === "delete-memory" ? "deleted" : action === "hide" ? "hidden — gone from map" : "unhidden");
    load();
  }

  async function delComment(comment_id: string) {
    const j = await call("delete-comment", { comment_id });
    if (!j) return;
    toast("comment deleted");
    load();
  }

  async function scanPhotos() {
    setScanning(true);
    const j = await call("scan-photos");
    setScanning(false);
    if (!j) return;
    setScan(j);
    toast(j.suspects.length ? `${j.suspects.length} suspect pin(s)` : "all clear", { description: `scanned ${j.scanned}` });
  }

  async function notifyRepair(handle: string) {
    const j = await call("notify-repair", { handle });
    if (!j) return;
    if (!j.sent) toast(`no email for @${handle}`, { description: "they never opted into alerts — message them manually" });
    else toast(`emailed @${handle}`, { description: "told them to open the pin → repair photos" });
  }

  const byMem = new Map<string, Report[]>();
  for (const r of reports) {
    const a = byMem.get(r.memory_id) || [];
    a.push(r);
    byMem.set(r.memory_id, a);
  }

  const maxDay = Math.max(1, ...(stats?.series.flatMap((d) => [d.memories, d.comments, d.felt, d.reports]) || [1]));
  const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));

  return (
    <div className="min-h-screen bg-[#08080a] text-white p-6">
      <Toaster position="top-center" richColors theme="dark" />
      <div className="max-w-[760px] mx-auto">
        <h1 className="font-serif text-2xl lowercase">shrine admin</h1>
        <p className="text-sm text-white/40 lowercase mt-1">{loaded ? "tracking + report queue + kill switch. keep this url private." : "restricted area."}</p>
        <div className="mt-4 flex gap-2">
          <Input value={secret} onChange={e => setSecret(e.target.value)} onKeyDown={e => { if (e.key === "Enter") load(); }} type="password" placeholder="admin secret" className="flex-1 bg-black/40 border-white/10 rounded-xl h-11" />
          <Button onClick={load} className="bg-white text-black rounded-full h-11 px-6 lowercase">unlock</Button>
        </div>
        {noService && loaded && (
          <p className="mt-3 text-xs lowercase text-amber-300/90">partial reads — set SUPABASE_SERVICE_ROLE_KEY in vercel for reports, alerts + hide/delete. "—" = not visible with anon key.</p>
        )}
        {loaded && (
          <div className="mt-4 flex gap-2">
            {(["queue", "stats"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-xs lowercase font-medium ${tab === t ? "bg-white text-black" : "bg-white/10 text-white/60 hover:text-white"}`}>
                {t === "queue" ? `queue (${byMem.size})` : "tracking"}
              </button>
            ))}
            <button onClick={load} className="ml-auto rounded-full px-4 py-2 text-xs lowercase text-white/40 hover:text-white">refresh ↻</button>
          </div>
        )}

        {loaded && tab === "stats" && stats && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 min-[500px]:grid-cols-4 gap-2">
              {[
                ["pins", stats.counts.memories],
                ["comments", stats.counts.comments],
                ["felts", stats.counts.felt],
                ["handles", stats.counts.users],
                ["reports", stats.counts.reports],
                ["open reports", stats.openReports],
                ["hidden", stats.hidden],
                ["alert subs", stats.counts.alerts],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                  <div className="text-xl font-bold tabular-nums">{num(v as number | null)}</div>
                  <div className="text-[11px] lowercase text-white/40">{label}</div>
                </div>
              ))}
            </div>
            <Card className="bg-white/[0.04] border-white/10 rounded-2xl p-4">
              <div className="text-xs lowercase tracking-[0.14em] text-white/40">last 14 days</div>
              <div className="mt-1 flex gap-3 text-[11px] lowercase text-white/50">
                <span><span className="inline-block w-2 h-2 rounded-full bg-white mr-1" />pins</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />comments</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-[#ff3b30] mr-1" />felts</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />reports</span>
              </div>
              <div className="mt-3 flex items-end gap-1.5 h-[110px]">
                {stats.series.map(d => (
                  <div key={d.day} title={`${d.day}: ${d.memories}p ${d.comments}c ${d.felt}f ${d.reports}r`} className="flex-1 flex items-end justify-center gap-[2px] h-full">
                    {[
                      [d.memories, "bg-white"],
                      [d.comments, "bg-emerald-400"],
                      [d.felt, "bg-[#ff3b30]"],
                      [d.reports, "bg-amber-400"],
                    ].map(([v, c], i) => (
                      <div key={i} className={`w-full max-w-[7px] rounded-sm ${c} ${(v as number) === 0 ? "opacity-15" : "opacity-90"}`} style={{ height: `${Math.max(3, ((v as number) / maxDay) * 100)}%` }} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1.5 text-[9px] lowercase text-white/25">
                {stats.series.map(d => <div key={d.day} className="flex-1 text-center">{d.day.slice(5)}</div>)}
              </div>
            </Card>
            <div className="grid min-[500px]:grid-cols-2 gap-4">
              <Card className="bg-white/[0.04] border-white/10 rounded-2xl p-4">
                <div className="text-xs lowercase tracking-[0.14em] text-white/40">top handles by pins</div>
                <div className="mt-2 space-y-1.5">
                  {stats.topHandles.length === 0 && <p className="text-xs lowercase text-white/30">no pins yet.</p>}
                  {stats.topHandles.map((t, i) => (
                    <div key={t.handle} className="flex items-center gap-2 text-sm lowercase">
                      <span className="text-white/30 tabular-nums text-xs w-4">{i + 1}</span>
                      <span>@{t.handle}</span>
                      <span className="ml-auto text-white/40 tabular-nums text-xs">{t.pins}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="bg-white/[0.04] border-white/10 rounded-2xl p-4">
                <div className="text-xs lowercase tracking-[0.14em] text-white/40">latest pins</div>
                <div className="mt-2 space-y-1.5">
                  {stats.recentMemories.length === 0 && <p className="text-xs lowercase text-white/30">nothing yet.</p>}
                  {stats.recentMemories.map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-sm lowercase">
                      <span className="truncate">“{m.line.slice(0, 34)}…” <span className="text-white/40">@{m.handle}</span></span>
                      {m.hidden
                        ? <button onClick={() => act("unhide", m.id)} className="ml-auto text-xs text-white/50 hover:text-white underline shrink-0">unhide</button>
                        : <button onClick={() => act("hide", m.id)} className="ml-auto text-xs text-amber-300/80 hover:text-amber-300 underline shrink-0">hide</button>}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card className="bg-white/[0.04] border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <div className="text-xs lowercase tracking-[0.14em] text-white/40">photo repair — truncated covers</div>
                <button onClick={scanPhotos} disabled={scanning} className="ml-auto rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs lowercase disabled:opacity-40">{scanning ? "scanning..." : "scan"}</button>
              </div>
              {scan && (
                <div className="mt-2 space-y-1.5">
                  {scan.suspects.length === 0 && <p className="text-xs lowercase text-white/30">all clear across last {scan.scanned} pins.</p>}
                  {scan.suspects.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-sm lowercase">
                      <span className="truncate">“{s.line.slice(0, 40)}…” <span className="text-white/40">@{s.handle}</span></span>
                      <button onClick={() => notifyRepair(s.handle)} className="ml-auto text-xs text-white bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 shrink-0">notify</button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card className="bg-white/[0.04] border-white/10 rounded-2xl p-4">
              <div className="text-xs lowercase tracking-[0.14em] text-white/40">latest comments</div>
              <div className="mt-2 space-y-1.5">
                {stats.recentComments.length === 0 && <p className="text-xs lowercase text-white/30">nothing yet.</p>}
                {stats.recentComments.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-sm lowercase">
                    <span className="truncate">“{c.text.slice(0, 50)}” <span className="text-white/40">@{c.handle}</span></span>
                    <button onClick={() => { if (confirm("delete this comment?")) delComment(c.id); }} className="ml-auto text-xs text-white/40 hover:text-red-300 underline shrink-0">delete</button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {loaded && tab === "queue" && reports.length === 0 && (
          <p className="mt-6 text-sm lowercase text-white/40">queue empty. no reports.</p>
        )}
        {loaded && tab === "queue" && (
          <div className="mt-4 space-y-3">
            {[...byMem.entries()].map(([mid, rs]) => {
              const m = mems[mid];
              return (
                <Card key={mid} className="bg-white/[0.04] border-white/10 rounded-2xl p-4">
                  <div className="text-sm lowercase">
                    {m ? <>“{m.line}” <span className="text-white/40">— {m.city} • @{m.handle}</span></> : <span className="text-white/40">{mid} (already deleted)</span>}
                    {m?.hidden && <span className="ml-2 text-xs bg-red-500/20 border border-red-500/30 text-red-300 px-2 py-0.5 rounded-full">hidden</span>}
                  </div>
                  <div className="mt-1 text-xs lowercase text-white/40">{rs.length} report{rs.length > 1 ? "s" : ""}: {rs.map(r => r.reason).join(", ")}</div>
                  {m && (
                    <div className="mt-3 flex gap-2">
                      {m.hidden
                        ? <Button onClick={() => act("unhide", mid)} className="rounded-full bg-white text-black h-9 px-4 text-xs lowercase">unhide</Button>
                        : <Button onClick={() => act("hide", mid)} className="rounded-full bg-amber-400 text-black h-9 px-4 text-xs lowercase">hide now</Button>}
                      <Button onClick={() => { if (confirm(`permanently delete "${m.line.slice(0, 40)}..."?`)) act("delete-memory", mid); }} className="rounded-full bg-red-600 text-white h-9 px-4 text-xs lowercase">delete</Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
