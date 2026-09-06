"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Toaster, toast } from "sonner";

type Report = { id: string; memory_id: string; reason: string; reporter: string; created_at: string };
type Mem = { id: string; handle: string; city: string; line: string; hidden: boolean; created_at: string };

// Kill switch — not linked anywhere in the app. Open /admin directly.
// Needs ADMIN_SECRET (+ SUPABASE_SERVICE_ROLE_KEY for full power) in Vercel env.
export default function Admin() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem("shrine_admin") || "");
  const [reports, setReports] = useState<Report[]>([]);
  const [mems, setMems] = useState<Record<string, Mem>>({});
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
  }

  async function act(action: string, memory_id: string) {
    const j = await call(action, { memory_id });
    if (!j) return;
    toast(action === "delete-memory" ? "deleted" : action === "hide" ? "hidden — gone from map" : "unhidden");
    load();
  }

  const byMem = new Map<string, Report[]>();
  for (const r of reports) {
    const a = byMem.get(r.memory_id) || [];
    a.push(r);
    byMem.set(r.memory_id, a);
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-white p-6">
      <Toaster position="top-center" richColors theme="dark" />
      <div className="max-w-[720px] mx-auto">
        <h1 className="font-serif text-2xl lowercase">shrine admin</h1>
        <p className="text-sm text-white/40 lowercase mt-1">report queue + kill switch. keep this url private.</p>
        <div className="mt-4 flex gap-2">
          <Input value={secret} onChange={e => setSecret(e.target.value)} onKeyDown={e => { if (e.key === "Enter") load(); }} type="password" placeholder="admin secret" className="flex-1 bg-black/40 border-white/10 rounded-xl h-11" />
          <Button onClick={load} className="bg-white text-black rounded-full h-11 px-6 lowercase">unlock</Button>
        </div>
        {noService && loaded && (
          <p className="mt-3 text-xs lowercase text-amber-300/90">reads only — set SUPABASE_SERVICE_ROLE_KEY in vercel to enable hide/delete.</p>
        )}
        {loaded && reports.length === 0 && (
          <p className="mt-6 text-sm lowercase text-white/40">queue empty. no reports.</p>
        )}
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
      </div>
    </div>
  );
}
