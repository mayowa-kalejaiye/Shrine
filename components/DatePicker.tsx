"use client";
import { useEffect, useRef, useState } from "react";

function toISO(d: Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function parseISO(s: string){ const [y,m,dd]=s.split("-").map(Number); return new Date(y, (m||1)-1, dd||1); }

export default function DatePicker({ value, onChange, placeholder }: { value: string; onChange: (v:string)=>void; placeholder?: string }){
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(()=> value ? parseISO(value) : new Date());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const close = (e: PointerEvent)=> { if(wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent)=> { if(e.key==="Escape") setOpen(false); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return ()=> { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  },[]);
  useEffect(()=>{ if(value) setView(parseISO(value)); },[value]);

  const todayISO = toISO(new Date());
  const y = view.getFullYear(), m = view.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const cells: (number|null)[] = [...Array(firstDow).fill(null), ...Array.from({length: daysInMonth}, (_,i)=> i+1)];
  const monthName = view.toLocaleString("en", { month:"long" });

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={()=> setOpen(o=> !o)}
        className="w-full h-11 px-3.5 rounded-xl bg-black/40 border border-white/10 font-[family-name:var(--font-grotesk)] lowercase text-sm text-left flex items-center justify-between hover:border-white/25 transition"
      >
        <span className={value ? "text-white" : "text-white/30"}>
          {value ? new Date(value+"T12:00:00").toLocaleDateString("en", {day:"numeric", month:"short", year:"numeric"}).toLowerCase() : (placeholder || "pick a date — optional")}
        </span>
        <span className="text-white/40 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute top-[48px] inset-x-0 sm:left-0 sm:right-auto sm:w-[300px] bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 z-50 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between gap-1">
            <div className="flex gap-1">
              <button type="button" title="prev year" onClick={()=> setView(new Date(y-1, m, 1))} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center text-xs">«</button>
              <button type="button" title="prev month" onClick={()=> setView(new Date(y, m-1, 1))} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center text-sm">‹</button>
            </div>
            <button type="button" title="jump to year" onClick={()=> setView(new Date(new Date().getFullYear()-5, m, 1))} className="font-[family-name:var(--font-serif)] lowercase text-[15px] hover:text-white/70">
              {monthName} {y}
            </button>
            <div className="flex gap-1">
              <button type="button" title="next month" onClick={()=> { const n=new Date(y, m+1, 1); if(n<=new Date()) setView(n); }} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center text-sm">›</button>
              <button type="button" title="next year" onClick={()=> { const n=new Date(y+1, m, 1); if(n<=new Date()) setView(n); }} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center text-xs">»</button>
            </div>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[1,5,10].map(n=>(
              <button key={n} type="button" onClick={()=> setView(new Date(y-n, m, 1))} className="flex-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] py-1 font-[family-name:var(--font-grotesk)] text-[11px] lowercase text-white/60">−{n}y</button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center font-[family-name:var(--font-grotesk)] text-[10px] lowercase tracking-widest text-white/30">
            {["s","m","t","w","t","f","s"].map((d,i)=> <span key={i}>{d}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d,i)=> d===null
              ? <span key={i} />
              : (()=> {
                const iso = toISO(new Date(y, m, d));
                const isSel = value===iso, isToday = todayISO===iso;
                const future = iso>todayISO;
                return (
                  <button
                    key={i} type="button" disabled={future}
                    onClick={()=> { onChange(iso); setOpen(false); }}
                    className={`h-8 rounded-full font-[family-name:var(--font-grotesk)] text-xs transition active:scale-95 ${isSel ? "bg-[#ff3b30] text-white font-bold" : isToday ? "border border-white/30 text-white" : "text-white/70 hover:bg-white/10"} ${future ? "opacity-20" : ""}`}
                  >{d}</button>
                );
              })()
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={()=> { onChange(todayISO); setOpen(false); }} className="flex-1 rounded-full bg-white/10 hover:bg-white/15 py-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase">today</button>
            {value && <button type="button" onClick={()=> { onChange(""); setOpen(false); }} className="flex-1 rounded-full bg-white/10 hover:bg-white/15 py-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/60">clear</button>}
          </div>
        </div>
      )}
    </div>
  );
}
