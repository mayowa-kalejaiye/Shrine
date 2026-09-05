"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shrine } from "@/lib/shrine-data";
import { ArrowLeft01Icon, MapPinIcon, ViewIcon, Cancel01Icon } from "hugeicons-react";

export default function YouPage(){
  const [my, setMy] = useState<Shrine[]>([]);
  const router = useRouter();
  useEffect(()=>{
    const s=localStorage.getItem("shrine_pins");
    if(s){ try{ const all: Shrine[]=JSON.parse(s); setMy(all.filter(x=> x.handle==="you").sort((a,b)=> a.createdAt-b.createdAt)); }catch{} }
  },[]);
  return (
    <div onClick={(e)=> { if(e.target===e.currentTarget) router.push("/"); }} className="min-h-screen bg-[#08080a] text-white">
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#08080a]/70 border-b border-white/10 h-[64px] flex items-center px-6 max-w-[720px] mx-auto">
        <Link href="/" className="flex items-center gap-2 font-[family-name:var(--font-grotesk)] text-sm lowercase"><ArrowLeft01Icon size={16}/> back to world</Link>
        <span className="ml-auto font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40">your timeline • {my.length} memories</span>
        <button onClick={()=> router.push("/")} className="ml-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center"><Cancel01Icon size={14}/></button>
      </nav>
      <div className="max-w-[720px] mx-auto px-6 py-8">
        <h1 className="font-[family-name:var(--font-serif)] text-[32px] leading-[0.9] lowercase">your timeline</h1>
        <p className="font-[family-name:var(--font-grotesk)] text-sm lowercase tracking-wide text-white/50 mt-2">your memories in order — a line connecting where you were. investment you’d lose by leaving.</p>
        {my.length===0 ? (
          <Card className="mt-8 bg-white/[0.04] border-white/10 rounded-2xl p-8 text-center">
            <p className="font-[family-name:var(--font-serif)] lowercase">no memories yet</p>
            <p className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/40 mt-1">pin your first memory on the world map — it lives forever.</p>
            <Link href="/"><Button className="mt-4 bg-white text-black rounded-full font-[family-name:var(--font-grotesk)] lowercase">pin now</Button></Link>
          </Card>
        ) : (
          <div className="mt-8 relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/10" />
            <div className="space-y-4">
              {my.map((s,i)=>(
                <div key={s.id} className="relative flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-white text-black grid place-items-center font-bold text-xs shrink-0 mt-1 z-10">{i+1}</div>
                  <Card className="flex-1 bg-white/[0.04] border-white/10 rounded-2xl overflow-hidden">
                    <img src={s.image} className="w-full h-[200px] object-cover" alt=""/>
                    <div className="p-4">
                      <Badge className="bg-white text-black rounded-full font-[family-name:var(--font-grotesk)] lowercase text-xs">{s.city} • {s.lat.toFixed(2)}, {s.lng.toFixed(2)}</Badge>
                      <p className="mt-2 font-[family-name:var(--font-serif)] lowercase">“{s.line}”</p>
                      <div className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 flex items-center gap-2"><MapPinIcon size={12}/> {new Date(s.createdAt).toLocaleString()} <span className="ml-auto inline-flex items-center gap-1"><ViewIcon size={12}/> {Math.floor(Math.random()*200)+10} saw</span></div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
