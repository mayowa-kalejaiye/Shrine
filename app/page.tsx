"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SEED_SHRINES, Shrine, ShrineComment } from "@/lib/shrine-data";
import { supabase } from "@/lib/supabase";
import DatePicker from "@/components/DatePicker";
import { MapPinIcon, ImageAdd01Icon, ViewIcon, Share01Icon, Download01Icon, PlusSignIcon, Location01Icon, ArrowRight01Icon, ArrowUpRight01Icon, FavouriteIcon, ArrowLeft01Icon } from "hugeicons-react";
import { Toaster, toast } from "sonner";

const ShrineMap = dynamic(()=> import("@/components/ShrineMapGL"), { ssr:false, loading: ()=> <div className="h-[560px] w-full bg-[#0a0a0b] grid place-items-center font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/30 tracking-[0.14em]">loading museum...</div> });

export default function ShrineFable(){
  const [shrines, setShrines] = useState<Shrine[]>(SEED_SHRINES);
  const [open, setOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<{display_name:string, lat:number, lng:number, name:string}[]>([]);
  const [picked, setPicked] = useState<{lat:number,lng:number, label:string} | null>(null);
  const [locating, setLocating] = useState(false);
  const [line, setLine] = useState("");
  const [image, setImage] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [comments, setComments] = useState<ShrineComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [selected, setSelected] = useState<Shrine|null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [felt, setFelt] = useState<Record<string, boolean>>({});
  const [showTimeline, setShowTimeline] = useState(false);
  const [heroOpen, setHeroOpen] = useState(true);
  const [viewPhoto, setViewPhoto] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [handleModal, setHandleModal] = useState(false);
  const [modalHandle, setModalHandle] = useState("");
  const [modalTaken, setModalTaken] = useState(false);
  const [changeHandle, setChangeHandle] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (()=>void)>(null);
  const [feltCount, setFeltCount] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const RESERVED = ["you","me","yours","mine","my","admin","administrator","shrine","support","help","null","undefined","anonymous","anon","anons","deleted","unknown","everyone","here","channel","official","team","moderator","mod","system","bot","owner"];
  const myHandle = ()=> (localStorage.getItem("shrine_handle") || "you").toLowerCase();
  function ensureHandle(action: ()=>void){
    const h = myHandle();
    if(h && h!=="you" && !RESERVED.includes(h)){ action(); return; }
    setPendingAction(()=> action);
    setHandleModal(true);
  }
  async function toggleFelt(){
    if(!selected) return;
    const h = myHandle();
    if(h==="you" || RESERVED.includes(h)){ ensureHandle(()=> toggleFelt()); return; }
    const nowFelt = !felt[selected.id];
    setFelt({...felt, [selected.id]: nowFelt});
    setFeltCount(c=> c + (nowFelt?1:-1));
    if(nowFelt) toast(`it landed with @${selected.handle}`, {
      description: `you felt "${selected.line.slice(0,36)}..." — they’ll know someone, somewhere, felt it too.`,
      duration: 4200,
      icon: <span className="w-7 h-7 rounded-full bg-[#ff3b30]/15 border border-[#ff3b30]/30 grid place-items-center shrink-0"><FavouriteIcon size={13}/></span>,
      style: { background:"#141414", border:"1px solid rgba(255,59,48,0.35)", borderRadius:"16px" },
    });
    if(supabase){
      try{
        if(nowFelt) await supabase.from("felt").insert({ memory_id: selected.id, handle: h });
        else await supabase.from("felt").delete().eq("memory_id", selected.id).eq("handle", h);
      }catch{}
    }
  }
  useEffect(()=>{
    setViewPhoto(false); setShareOpen(false); setEditing(false); setPhotoIdx(0); setShowComments(false); setCommentInput("");
    if(!selected){ setComments([]); setFeltCount(0); return; }
    // felt count + mine — so the other person sees it
    (async ()=>{
      const mine = !!felt[selected.id];
      if(supabase){
        try{
          const { count } = await supabase.from("felt").select("id", {count:"exact", head:true}).eq("memory_id", selected.id);
          setFeltCount(count || 0);
          const h = myHandle();
          if(h!=="you"){
            const { data } = await supabase.from("felt").select("id").eq("memory_id", selected.id).eq("handle", h).limit(1);
            if(data && data.length && !mine){ setFelt(f=> ({...f, [selected.id]: true})); }
          }
          return;
        }catch{}
      }
      setFeltCount(mine?1:0);
    })();
    (async ()=>{
      if(supabase){
        try{
          const { data } = await supabase.from("comments").select("*").eq("memory_id", selected.id).order("created_at", {ascending:false}).limit(50);
          if(data) setComments(data.map((d:any)=> ({ id:d.id, memory_id:d.memory_id, handle:d.handle, text:d.text, createdAt:new Date(d.created_at).getTime() })));
          return;
        }catch{}
      }
      try{ const all: ShrineComment[]=JSON.parse(localStorage.getItem("shrine_comments")||"[]"); setComments(all.filter(c=> c.memory_id===selected.id)); }catch{ setComments([]); }
    })();
  },[selected?.id]);
  const [handle, setHandle] = useState("you");
  const [handleTaken, setHandleTaken] = useState(false);
  const [searchHandle, setSearchHandle] = useState("");
  const [memDate, setMemDate] = useState("");
  const [editing, setEditing] = useState(false);
  const [editLine, setEditLine] = useState("");
  const [editDate, setEditDate] = useState("");
  useEffect(()=>{ const h=localStorage.getItem("shrine_handle"); if(h) { setHandle(h); checkHandle(h); } },[]);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(()=>{ const id=setInterval(()=> setNow(new Date()), 1000); return ()=> clearInterval(id); },[]);
  // load felt
  useEffect(()=>{ const f=localStorage.getItem("shrine_felt"); if(f) try{ setFelt(JSON.parse(f))}catch{} },[]);
  useEffect(()=>{ localStorage.setItem("shrine_felt", JSON.stringify(felt)); },[felt]);

  useEffect(()=>{
    // deep link ?memory=id from shares
    const mid = new URLSearchParams(window.location.search).get("memory");
    const load = async ()=>{
      const s=localStorage.getItem("shrine_pins");
      let base: Shrine[] = SEED_SHRINES;
      if(s){ try{ const p=JSON.parse(s); if(p.length >= SEED_SHRINES.length-20) base = p; }catch{} }
      // supabase persistence — traffic mode, no limit
      if(supabase){
        try{
          const { data } = await supabase.from("memories").select("*").order("created_at", {ascending:false}).limit(2000);
          if(data && data.length){
            const db: Shrine[] = data.map((d:any)=> ({ id:d.id, image:d.image, line:d.line, city:d.city, lat:d.lat, lng:d.lng, handle:d.handle, createdAt:new Date(d.created_at).getTime() }));
            base = [...db, ...base.filter(b=> !db.find(x=> x.id===b.id))];
          }
        }catch{}
      }
      setShrines(base);
      if(mid){ const found = base.find(x=> x.id===mid); if(found) setTimeout(()=> setSelected(found), 800); }
    };
    load();
  },[]);
  useEffect(()=>{ try{ localStorage.setItem("shrine_pins", JSON.stringify(shrines.slice(0,400))); }catch{} },[shrines]);

  const searchTimer = useRef<any>(null);
  async function searchCity(q:string){
    setCityQuery(q);
    if(searchTimer.current) clearTimeout(searchTimer.current);
    if(q.trim().length<2){ setCityResults([]); return; }
    // debounce — fewer requests, no rate-limit
    searchTimer.current = setTimeout(async ()=>{
      try{
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if(!Array.isArray(data)){ setCityResults([]); return; }
        setCityResults(data.map((d:any)=> ({ display_name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon), name: (d.name || d.display_name.split(",")[0]).toLowerCase().slice(0,40) })));
      }catch{ setCityResults([]); }
    }, 350);
  }
  function useCurrentLocation(){
    if(!navigator.geolocation) return alert("geolocation not supported");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const {latitude, longitude} = pos.coords;
      try{
        const r = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
        const j = await r.json();
        const label = (j.address?.city || j.address?.town || j.address?.village || j.display_name.split(",")[0] || "current location").toLowerCase();
        setPicked({lat: latitude, lng: longitude, label});
      }catch{ setPicked({lat: latitude, lng: longitude, label: "current location"}); }
      setLocating(false);
    }, ()=>{ setLocating(false); alert("couldn't get location — allow permission or search"); }, { enableHighAccuracy:true, timeout:8000 });
  }
  function haversine(a:{lat:number,lng:number}, b:{lat:number,lng:number}){
    const R=6371; const dLat=(b.lat-a.lat)*Math.PI/180; const dLng=(b.lng-a.lng)*Math.PI/180;
    const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
    const c= 2*Math.asin(Math.sqrt(s1*s1 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*s2*s2));
    return R*c;
  }
  async function checkHandle(h:string){
    const clean = h.toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20);
    if(!clean){ setHandleTaken(false); return; }
    if(RESERVED.includes(clean)){ setHandleTaken(true); return; }
    if(!supabase){ setHandleTaken(shrines.some(s=> s.handle===clean && clean!=="you")); return; }
    try{
      const { data } = await supabase.from("memories").select("id").eq("handle", clean).limit(1);
      const takenLocal = shrines.some(s=> s.handle===clean && clean!==handle);
      setHandleTaken(!!(data && data.length) || takenLocal);
    }catch{ setHandleTaken(false); }
  }
  async function pin(){
    if(!line.trim() || !image) return;
    if(!picked) return alert("pick a location — search, use current, or tap map");
    const clean = handle.toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20) || "you";
    if(handleTaken && clean!==localStorage.getItem("shrine_handle")) return alert(`@${clean} is taken — pick another`);
    setHandle(clean); localStorage.setItem("shrine_handle", clean);
    const when = memDate ? new Date(memDate + "T12:00:00").getTime() : Date.now();
    const cover = photos[0] || image;
    const s: Shrine = { id: Math.random().toString(36).slice(2), image: cover, images: photos.length? photos : [cover], line: line.toLowerCase(), city: picked.label, lat: picked.lat, lng: picked.lng, handle: clean, createdAt: when };
    // supabase persist — no memory limit, traffic mode
    if(supabase){ try{ await supabase.from("users").upsert({ handle: clean }, { onConflict:"handle" }); await supabase.from("memories").insert({ handle:clean, city:s.city, lat:s.lat, lng:s.lng, line:s.line, image:s.image.slice(0,150000), images: s.images?.map(p=> p.slice(0,150000)) }); }catch{} }
    // nearby trigger — check within 20km
    const nearby = shrines.filter(x=> haversine({lat:picked.lat,lng:picked.lng},{lat:x.lat,lng:x.lng})<20);
    if(nearby.length) toast(`nearby • ${nearby[0].city} • ${nearby.length} memories within 20km`, { description: `"${nearby[0].line.slice(0,48)}..." — someone felt close by` , duration: 5000});
    else toast("pinned to world map", { description: `${picked.label} • your memory lives forever`, duration: 3000});
    // request notification permission for future nearby
    if("Notification" in window && Notification.permission==="default") Notification.requestPermission();
    setShrines(prev=>[s, ...prev]);
    setLine(""); setImage(""); setPhotos([]); setMemDate(""); setPicked(null); setCityQuery(""); setCityResults([]); setChangeHandle(false); setOpen(false);
  }
  async function postComment(){
    if(!selected || !commentInput.trim()) return;
    const h = myHandle();
    if(h==="you" || RESERVED.includes(h)){ ensureHandle(()=> postComment()); return; }
    const clean = h;
    const c: ShrineComment = { id: Math.random().toString(36).slice(2), memory_id: selected.id, handle: clean, text: commentInput.trim().slice(0,280), createdAt: Date.now() };
    setComments(prev=> [c, ...prev]);
    setCommentInput("");
    if(supabase){ try{ await supabase.from("comments").insert({ memory_id: c.memory_id, handle: c.handle, text: c.text }); }catch{} }
    else { try{ const k="shrine_comments"; const all=JSON.parse(localStorage.getItem(k)||"[]"); localStorage.setItem(k, JSON.stringify([c, ...all].slice(0,500))); }catch{} }
  }
  function saveEdit(){
    if(!selected || !editLine.trim()) return;
    const when = editDate ? new Date(editDate + "T12:00:00").getTime() : selected.createdAt;
    const updated = { ...selected, line: editLine.toLowerCase(), createdAt: when };
    setShrines(prev=> prev.map(x=> x.id===selected.id ? updated : x));
    setSelected(updated);
    setEditing(false);
    toast("memory updated", { description: "line + date saved locally — server edit needs login, coming" });
  }
  // anniversary trigger
  useEffect(()=>{
    const ann = shrines.filter(s=> {
      const days = (Date.now()-s.createdAt)/86400000;
      return days>=6.8 && days<=7.2;
    });
    if(ann.length){ setTimeout(()=> toast(`anniversary • 1 week ago in ${ann[0].city}`, { description: `"${ann[0].line.slice(0,48)}..." — still there`, duration:6000}), 2500); }
  },[shrines.length]);
  // collection progress
  const myShrines = shrines.filter(s=> s.handle==="you");
  const citiesVisited = new Set(myShrines.map(s=> s.city)).size;
  const nightPins = myShrines.filter(s=> { const h=new Date(s.createdAt).getHours(); return h<6||h>19; }).length;
  const progressCities = Math.min(100, Math.round(citiesVisited/5*100));
  const progressTotal = Math.min(100, Math.round((citiesVisited*35 + (nightPins>0?25:0) + (myShrines.length>0?40:0))));
  function share(s: Shrine){
    const canvas=canvasRef.current!; const ctx=canvas.getContext("2d")!;
    canvas.width=1080; canvas.height=1350;
    ctx.fillStyle="#0a0a0b"; ctx.fillRect(0,0,1080,1350);
    const img=new Image(); img.crossOrigin="anonymous";
    img.onload=()=>{
      // image 1080x760 with subtle grain
      ctx.drawImage(img,0,0,1080,760);
      ctx.fillStyle="rgba(0,0,0,0.45)"; ctx.fillRect(0,760,1080,590);
      ctx.fillStyle="rgba(255,255,255,0.08)"; ctx.fillRect(0,0,1080,760);
      ctx.fillStyle="white"; ctx.font="700 13px system-ui"; ctx.letterSpacing="2px";
      ctx.fillText("SHRINE — SPECIMEN "+s.id.slice(0,4).toUpperCase(), 40, 810);
      ctx.font="400 28px 'Instrument Serif', serif"; 
      const words=s.line.split(" "); let line=""; let y=860;
      for(let n=0;n<words.length;n++){ const test=line+words[n]+" "; if(ctx.measureText(test).width>1000 && n>0){ ctx.fillText(`“${line.trim()}”`,40,y); line=words[n]+" "; y+=38;} else line=test; } ctx.fillText(`“${line.trim()}”`,40,y);
      ctx.font="500 12px system-ui"; ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.fillText(`${s.city} • @${s.handle} • ${new Date(s.createdAt).toLocaleDateString()} • ${s.lat.toFixed(3)}, ${s.lng.toFixed(3)}`,40, 980);
      ctx.fillStyle="rgba(255,255,255,0.25)"; ctx.font="10px system-ui"; ctx.fillText("a world museum of attachment — shrine.so",40, 1310);
      const url=canvas.toDataURL("image/png");
      const a=document.createElement("a"); a.href=url; a.download=`shrine-${s.city}.png`; a.click();
    };
    img.src=s.image;
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-white selection:bg-white/20">
      <Toaster position="top-center" richColors theme="dark" />
      {/* grain + vignette */}
      <div className="fixed inset-0 -z-10 bg-[#08080a]" />
      <div className="fixed inset-0 -z-10 opacity-[0.035]" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}} />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(255,59,48,0.06),_transparent_60%)]" />

      {/* FULLSCREEN MAP — true fullscreen, nav floats on map */}
      <section className="relative h-screen w-full overflow-hidden bg-black">
        <div className="absolute inset-0">
          <ShrineMap shrines={shrines} selectedId={selected?.id || null} onHover={()=>{}} onSelect={setSelected} onPick={(lat,lng)=> { setPicked({lat,lng,label:`${lat.toFixed(3)}, ${lng.toFixed(3)}`}); }} />
        </div>
        {/* floating nav — shrine + your timeline + pin */}
        <div className="absolute top-3 sm:top-4 left-3 right-3 sm:left-6 sm:right-6 z-20 flex items-center justify-between gap-2 pointer-events-none">
          <Link href="/" className="flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/15 rounded-full px-3.5 py-1.5 pointer-events-auto shrink-0">
            <span className="font-[family-name:var(--font-serif)] text-[19px] leading-none">S</span>
            <span className="font-[family-name:var(--font-serif)] lowercase text-[14px] hidden min-[400px]:inline">shrine</span>
            <span className="hidden lg:inline font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.16em] text-white/40 border-l border-white/10 pl-2 ml-1">{shrines.length} memories</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto min-w-0">
            <button onClick={()=> setShowTimeline(true)} className="inline-flex shrink-0 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide bg-black/60 backdrop-blur-xl border border-white/15 text-white/80 hover:text-white hover:bg-black/80 px-3 sm:px-4 py-2 rounded-full">timeline</button>
            <Button onClick={()=> setOpen(true)} className="bg-[#ff3b30] text-white hover:bg-[#ff3b30]/90 rounded-full h-9 sm:h-10 px-3 sm:px-5 font-[family-name:var(--font-grotesk)] lowercase text-sm font-medium shadow-[0_12px_32px_rgba(255,59,48,0.4)] shrink-0 active:scale-95"><span className="sm:hidden">+ pin</span><span className="hidden sm:inline-flex items-center gap-1">pin your memory <PlusSignIcon size={14}/></span></Button>
          </div>
        </div>
        {/* floating hero — glass, top-left, dismissible on mobile */}
        {heroOpen && (
        <motion.div initial={{opacity:0, y:16}} animate={{opacity:1, y:0}} transition={{duration:0.7, ease:[0.16,1,0.3,1]}} className="absolute top-[64px] sm:top-[72px] left-3 right-3 sm:left-8 sm:right-auto sm:max-w-[520px] z-10 pointer-events-none">
          <h1 className="relative font-[family-name:var(--font-serif)] text-[26px] min-[400px]:text-[30px] sm:text-[48px] leading-[0.9] sm:leading-[0.85] tracking-[-0.04em] lowercase bg-black/60 backdrop-blur-xl border border-white/10 rounded-[16px] sm:rounded-[18px] px-4 sm:px-5 py-3.5 sm:py-4 pointer-events-auto">
            <button aria-label="dismiss" onClick={()=> setHeroOpen(false)} className="sm:hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 grid place-items-center text-white/60 text-xs">✕</button>
            where did this<br/><span className="text-white/40 italic">memory happen?</span>
            <p className="mt-2 sm:mt-3 font-[family-name:var(--font-grotesk)] text-[12px] sm:text-[13px] leading-5 sm:leading-6 lowercase tracking-wide text-white/60 font-normal">tap map to pin. drag, scroll to street, pitch to see 3d.</p>
          </h1>
        </motion.div>
        )}
        {/* bottom bar — alive, clears mobile FABs */}
        <div className="absolute bottom-20 sm:bottom-6 left-3 right-3 sm:left-6 sm:right-auto flex flex-wrap gap-2 z-10 pointer-events-none">
          <span suppressHydrationWarning className="font-[family-name:var(--font-grotesk)] text-[11px] sm:text-xs lowercase tracking-[0.14em] bg-black/70 backdrop-blur-xl border border-white/15 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> live • <span suppressHydrationWarning>{now.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</span><span className="hidden min-[400px]:inline"> • 3d • weather</span>
          </span>
          <span className="hidden sm:inline-flex font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide bg-white text-black px-3 py-2 rounded-full">satellite • streets • weather alive</span>
        </div>
        {/* mobile pin removed — top red pin covers all screens */}

        {/* TIMELINE OVERLAY — same page, blurred map bg — back via button or outside tap, mobile thumb zone */}
        {showTimeline && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=> setShowTimeline(false)} className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[14px] overflow-y-auto overscroll-contain" style={{WebkitOverflowScrolling:"touch" as any}}>
            <div className="min-h-full pb-24 flex flex-col items-center">
              <div className="sticky top-0 z-10 w-full bg-[#08080a]/70 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 h-[64px] flex items-center justify-center">
                <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/50">your timeline • tap outside to return</span>
              </div>
              {/* mobile thumb-zone back — fixed, always reachable */}
              <button onClick={()=> setShowTimeline(false)} className="sm:hidden fixed bottom-6 inset-x-6 z-10 bg-white text-black rounded-full h-12 font-[family-name:var(--font-grotesk)] text-sm lowercase font-medium shadow-[0_12px_32px_rgba(0,0,0,0.5)] active:scale-[0.98]">← back to map</button>
              <div onClick={e=> e.stopPropagation()} className="w-full max-w-[720px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {myShrines.length===0 ? (
                  <Card className="bg-white/[0.04] border-white/10 rounded-2xl p-8 text-center backdrop-blur">
                    <p className="font-[family-name:var(--font-serif)] lowercase">no memories yet</p>
                    <p className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/40 mt-1">pin your first memory — it lives forever on the map.</p>
                    <Button onClick={()=> { setShowTimeline(false); setOpen(true); }} className="mt-4 bg-white text-black rounded-full font-[family-name:var(--font-grotesk)] lowercase">pin now</Button>
                  </Card>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/10" />
                    <div className="space-y-4">
                      {myShrines.sort((a,b)=> a.createdAt-b.createdAt).map((s,i)=>(
                        <div key={s.id} className="relative flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-white text-black grid place-items-center font-bold text-xs shrink-0 mt-1 z-10">{i+1}</div>
                          <Card className="flex-1 bg-[#0f0f0f]/80 backdrop-blur border-white/10 rounded-2xl overflow-hidden">
                            <img src={s.image} className="w-full h-[200px] object-cover" alt=""/>
                            <div className="p-4">
                              <Badge className="bg-white text-black rounded-full font-[family-name:var(--font-grotesk)] lowercase text-xs">{s.city} • {s.lat.toFixed(2)}, {s.lng.toFixed(2)}</Badge>
                              <p className="mt-2 font-[family-name:var(--font-serif)] lowercase">“{s.line}”</p>
                              <div className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 flex items-center gap-2"><MapPinIcon size={12}/> {new Date(s.createdAt).toLocaleString()} <button onClick={()=> { setShowTimeline(false); setSelected(s); }} className="ml-auto text-white hover:underline">view on map →</button></div>
                            </div>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* BOTTOM SHEET — memory detail, half screen max, map stays visible */}
        {selected && (()=> {
          const personMems = shrines.filter(s=> s.handle===selected.handle).sort((a,b)=> a.createdAt-b.createdAt);
          const idx = personMems.findIndex(s=> s.id===selected.id);
          const next = personMems[idx+1] || personMems[0];
          const prev = personMems[idx-1] || personMems[personMems.length-1];
          const shareUrl = typeof window!=="undefined" ? `${window.location.origin}/?memory=${selected.id}` : `https://shrine.so/?memory=${selected.id}`;
          const shareText = encodeURIComponent(`"${selected.line}" — ${selected.city} • shrine — where did this memory happen? ${shareUrl}`);
          const closeBy = shrines.filter(s=> s.id!==selected.id).sort((a,b)=>{
            const dist = (x: Shrine)=> Math.hypot(x.lat-selected.lat, x.lng-selected.lng);
            return dist(a)-dist(b);
          }).slice(0,6);
          return (
          <motion.div initial={{y:320}} animate={{y:0}} exit={{y:320}} transition={{type:"spring", damping:30, stiffness:320}} className="absolute bottom-0 inset-x-0 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[400px] max-h-[58vh] bg-[#0f0f0f] border-t sm:border border-white/10 rounded-t-[24px] sm:rounded-[24px] shadow-[0_-24px_80px_rgba(0,0,0,0.6)] z-20 overflow-hidden flex flex-col">
            <div
              ref={sheetRef}
              className="flex flex-col min-h-0"
              onPointerDown={e=> {
                const el = sheetRef.current; if(!el) return;
                (el as any)._dragY = e.clientY; (el as any)._dragging = true;
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={e=> {
                const el = sheetRef.current as any; if(!el || !el._dragging) return;
                const dy = Math.max(0, e.clientY - el._dragY);
                el.style.transition = "none";
                el.style.transform = `translateY(${dy}px)`;
              }}
              onPointerUp={e=> {
                const el = sheetRef.current as any; if(!el || !el._dragging) return;
                el._dragging = false;
                const dy = Math.max(0, e.clientY - el._dragY);
                el.style.transition = "transform 0.25s ease";
                if(dy>90){ el.style.transform = ""; setSelected(null); }
                else el.style.transform = "translateY(0px)";
              }}
            >
            <div className="pt-2.5 pb-2 bg-[#0f0f0f]/95 backdrop-blur-xl flex flex-col items-center shrink-0 cursor-grab active:cursor-grabbing" style={{touchAction:"none"}}>
              <span className="w-10 h-1 rounded-full bg-white/25" />
            </div>
            <div className="overflow-y-auto overscroll-contain min-h-0">
            <div className="relative">
              <div className="flex overflow-x-auto snap-x snap-mandatory" style={{scrollbarWidth:"none", WebkitOverflowScrolling:"touch" as any}} onScroll={e=> { const el=e.currentTarget; const i=Math.round(el.scrollLeft/el.clientWidth); if(i!==photoIdx) setPhotoIdx(i); }}>
                {(selected.images && selected.images.length ? selected.images : [selected.image]).slice(0,3).map((src,i)=>(
                  <button key={i} onClick={()=> { setPhotoIdx(i); setViewPhoto(true); }} className="shrink-0 w-full snap-center block">
                    <img src={src} className="w-full h-[190px] sm:h-[220px] object-cover" alt=""/>
                  </button>
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-transparent to-[#0f0f0f]/30 pointer-events-none" />
              {/* prev / next on photo top, blurred, no border */}
              {personMems.length>1 && (
                <>
                  <button aria-label="previous memory" onClick={()=> setSelected(prev)} className="absolute top-2.5 left-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-xl grid place-items-center text-white hover:bg-black/60 active:scale-95">‹</button>
                  <button aria-label="next memory" onClick={()=> setSelected(next)} className="absolute top-2.5 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-xl grid place-items-center text-white hover:bg-black/60 active:scale-95">›</button>
                </>
              )}
              <button aria-label="close" onClick={()=> { setSelected(null); setEditing(false); setShareOpen(false); }} className="absolute top-2.5 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-xl grid place-items-center text-white/80 hover:text-white text-xs">✕</button>
              <span className="absolute bottom-2.5 left-3 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide bg-black/50 backdrop-blur-xl px-2.5 py-1 rounded-full pointer-events-none">{selected.city} • @{selected.handle}</span>
              <span className="absolute bottom-2.5 right-3 flex items-center gap-1.5 pointer-events-none">
                {(selected.images && selected.images.length>1) && selected.images.slice(0,3).map((_,i)=>(
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${i===photoIdx?"bg-white":"bg-white/35"}`} />
                ))}
                {personMems.length>1 && <span className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase bg-black/50 backdrop-blur-xl px-2 py-1 rounded-full text-white/60">{idx+1}/{personMems.length}</span>}
              </span>
            </div>
            <div className="p-4 sm:p-5">
              {!editing ? (
                <>
                  <p className="font-[family-name:var(--font-serif)] text-[18px] sm:text-[20px] leading-7 lowercase">“{selected.line}”</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide text-white/40">
                    <span>{new Date(selected.createdAt).toLocaleDateString()}</span><span>•</span><span>{personMems.length} by @{selected.handle}</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <button onClick={toggleFelt} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase border transition active:scale-95 ${felt[selected.id]?"bg-[#ff3b30]/15 border-[#ff3b30]/30 text-[#ff3b30]":"bg-white/[0.06] border-white/10 text-white/70 hover:text-white"}`}><FavouriteIcon size={13}/> {felt[selected.id]?"felt ✓":"i felt this"}{feltCount>0 && <span className="opacity-70">• {feltCount}</span>}</button>
                    <button onClick={()=> setShareOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white text-black font-[family-name:var(--font-grotesk)] text-xs lowercase font-medium active:scale-95"><Share01Icon size={13}/> share</button>
                    {selected.handle===handle && selected.handle!=="you" && (
                      <button onClick={()=> { setEditing(true); setEditLine(selected.line); setEditDate(new Date(selected.createdAt).toISOString().slice(0,10)); }} className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 hover:text-white underline underline-offset-2">edit</button>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <Input value={editLine} onChange={e=> setEditLine(e.target.value)} maxLength={80} className="bg-black/40 border-white/10 rounded-xl font-[family-name:var(--font-grotesk)] lowercase h-11" />
                  <DatePicker value={editDate} onChange={setEditDate} placeholder="pick a date" />
                  <div className="flex gap-2">
                    <Button onClick={saveEdit} disabled={!editLine.trim()} className="flex-1 bg-white text-black rounded-full font-[family-name:var(--font-grotesk)] lowercase h-9">save</Button>
                    <Button onClick={()=> setEditing(false)} variant="outline" className="flex-1 rounded-full border-white/15 font-[family-name:var(--font-grotesk)] lowercase h-9">cancel</Button>
                  </div>
                </div>
              )}

              {/* comments — thread under the memory */}
              <div className="mt-5">
                <button onClick={()=> setShowComments(v=> !v)} className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.14em] text-white/30 hover:text-white/60">
                  comments • {comments.length} {showComments ? "↑" : "↓"}
                </button>
                {showComments && (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex gap-2">
                      <Input value={commentInput} onChange={e=> setCommentInput(e.target.value)} onKeyDown={e=> { if(e.key==="Enter") postComment(); }} placeholder={`reply as @${handle || "you"}...`} maxLength={280} className="flex-1 bg-black/40 border-white/10 rounded-full font-[family-name:var(--font-grotesk)] lowercase h-9 px-4 text-sm" />
                      <Button onClick={postComment} disabled={!commentInput.trim()} className="rounded-full bg-white text-black hover:bg-white/90 h-9 px-4 font-[family-name:var(--font-grotesk)] lowercase text-xs shrink-0 disabled:opacity-40">send</Button>
                    </div>
                    {comments.length===0
                      ? <p className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/25">no comments yet — say what this stirs in you.</p>
                      : comments.slice(0,8).map(c=>(
                        <div key={c.id} className="rounded-xl bg-white/[0.04] border border-white/5 px-3 py-2">
                          <div className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase text-white/40">@{c.handle} • {new Date(c.createdAt).toLocaleDateString()}</div>
                          <div className="font-[family-name:var(--font-grotesk)] text-sm lowercase leading-5 text-white/85 mt-0.5">{c.text}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* close by — horizontal snap row fits the half sheet */}
              <div className="mt-5">
                <h4 className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.14em] text-white/30">close by memories</h4>
                <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-5 sm:px-5" style={{scrollSnapType:"x mandatory", WebkitOverflowScrolling:"touch" as any}}>
                  {closeBy.map(s=>(
                    <button key={s.id} onClick={()=> setSelected(s)} className="shrink-0 w-[148px] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/5 hover:border-white/15 text-left transition active:scale-[0.98]" style={{scrollSnapAlign:"start"}}>
                      <img src={s.image} loading="lazy" className="w-full h-[88px] object-cover" alt=""/>
                      <div className="p-2">
                        <div className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase text-white/40 truncate">{s.city} • {Math.round(Math.hypot(s.lat-selected.lat, s.lng-selected.lng)*111)}km</div>
                        <div className="font-[family-name:var(--font-serif)] text-xs leading-4 lowercase line-clamp-2 mt-0.5">“{s.line.slice(0,42)}…”</div>
                      </div>
                    </button>
                  ))}
                  {!closeBy.length && <p className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/25">no close by memories yet.</p>}
                </div>
              </div>
            </div>
            </div>
            </div>
          </motion.div>
          );
        })()}
        {/* photo viewer — tap picture to see it big, blurred bg */}
        {selected && viewPhoto && (
          <div onClick={()=> setViewPhoto(false)} className="absolute inset-0 z-30 bg-black/70 backdrop-blur-xl grid place-items-center p-6">
            <img src={(selected.images && selected.images[photoIdx]) || selected.image} onClick={e=> e.stopPropagation()} className="max-h-[76vh] max-w-full rounded-2xl object-contain shadow-[0_32px_80px_rgba(0,0,0,0.7)]" alt=""/>
            <span className="absolute bottom-8 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide text-white/50">tap anywhere to return</span>
          </div>
        )}
        {/* share popup — one button, three ways */}
        {selected && shareOpen && (
          <div onClick={()=> setShareOpen(false)} className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md grid place-items-center p-6">
            <div onClick={e=> e.stopPropagation()} className="w-full max-w-[320px] bg-[#141414] border border-white/10 rounded-[20px] p-5">
              <div className="font-[family-name:var(--font-serif)] lowercase text-[16px]">share this memory</div>
              <p className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 mt-1 truncate">“{selected.line.slice(0,40)}…”</p>
              <div className="mt-4 space-y-2">
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`"${selected.line}" — ${selected.city} • shrine — where did this memory happen? ${typeof window!=="undefined" ? `${window.location.origin}/?memory=${selected.id}` : ""}`)}`} target="_blank" className="flex items-center gap-3 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] px-4 py-3 font-[family-name:var(--font-grotesk)] text-sm lowercase"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z"/></svg>post to x</a>
                <a href={`https://wa.me/?text=${encodeURIComponent(`"${selected.line}" — ${selected.city} • shrine — where did this memory happen? ${typeof window!=="undefined" ? `${window.location.origin}/?memory=${selected.id}` : ""}`)}`} target="_blank" className="flex items-center gap-3 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] px-4 py-3 font-[family-name:var(--font-grotesk)] text-sm lowercase"><svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>send via whatsapp</a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window!=="undefined" ? `${window.location.origin}/?memory=${selected.id}` : "")}`} target="_blank" className="flex items-center gap-3 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] px-4 py-3 font-[family-name:var(--font-grotesk)] text-sm lowercase"><svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>share to facebook</a>
              </div>
              <button onClick={()=> setShareOpen(false)} className="mt-3 w-full rounded-full bg-white/10 hover:bg-white/15 py-2.5 font-[family-name:var(--font-grotesk)] text-xs lowercase">cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* collection trigger — side tab */}
      <button onClick={()=> document.getElementById("collection-drawer")?.classList.toggle("-translate-x-full")} className="fixed left-0 top-1/2 -translate-y-1/2 z-10 hidden lg:flex items-center gap-2 bg-black/70 backdrop-blur-xl border border-white/10 border-l-0 rounded-r-full pl-3 pr-4 py-3 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white hover:bg-black/80 transition">
        <span className="min-w-7 h-7 px-1.5 rounded-full bg-white text-black grid place-items-center font-bold text-xs tabular-nums">{shrines.length>999 ? `${(shrines.length/1000).toFixed(1)}k` : shrines.length}</span> collection
      </button>
      <button onClick={()=> document.getElementById("collection-drawer")?.classList.toggle("-translate-x-full")} className="fixed bottom-4 left-4 z-10 lg:hidden bg-black/70 backdrop-blur-xl border border-white/15 rounded-full px-4 py-2.5 font-[family-name:var(--font-grotesk)] text-xs lowercase flex items-center gap-2 active:scale-95 max-w-[calc(100vw-8rem)]">
        <span className="min-w-6 h-6 px-1 rounded-full bg-white text-black grid place-items-center font-bold text-xs tabular-nums shrink-0">{shrines.length>999 ? `${(shrines.length/1000).toFixed(1)}k` : shrines.length}</span> collection
      </button>

      {/* LEFT DRAWER — collection, top bar at navbar level */}
      <div id="collection-drawer" className="fixed top-0 left-0 h-screen w-[92%] sm:w-[420px] bg-[#0f0f0f] border-r border-white/10 shadow-[24px_0_80px_rgba(0,0,0,0.6)] z-[60] -translate-x-full transition-transform duration-300 overflow-auto">
        <div className="sticky top-0 z-50 bg-[#0f0f0f]/95 backdrop-blur-xl border-b border-white/10 px-4 h-[64px] flex items-center justify-between shrink-0">
          <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40">collection — {shrines.length} memories</span>
          <button onClick={()=> document.getElementById("collection-drawer")?.classList.add("-translate-x-full")} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center shrink-0">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-[family-name:var(--font-grotesk)]">@</span>
            <Input value={searchHandle} onChange={e=> setSearchHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} placeholder="search someone — favourite person?" className="bg-black/40 border-white/10 rounded-full font-[family-name:var(--font-grotesk)] lowercase h-9 pl-7 text-sm" maxLength={20}/>
          </div>
          {searchHandle && (()=> {
            const hits = shrines.filter(s=> s.handle.includes(searchHandle));
            const person = hits[0]?.handle;
            return (
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                {hits.length
                  ? <button onClick={()=> { const s=hits.sort((a,b)=>a.createdAt-b.createdAt)[0]; setSelected(s); document.getElementById("collection-drawer")?.classList.add("-translate-x-full"); }} className="w-full text-left font-[family-name:var(--font-grotesk)] text-sm lowercase">@{person} • {hits.length} memories → view</button>
                  : <span className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/40">no @{searchHandle} yet</span>}
              </div>
            );
          })()}
        </div>
        {/* collection progress — retention */}
        <div className="mx-4 mt-4 rounded-2xl bg-white/[0.04] border border-white/10 p-4">
          <div className="flex items-center justify-between">
            <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40">your coverage</span>
            <button onClick={()=> { document.getElementById("collection-drawer")?.classList.add("-translate-x-full"); setShowTimeline(true); }} className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white hover:underline">view timeline →</button>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="flex justify-between font-[family-name:var(--font-grotesk)] text-xs lowercase"><span className="text-white/60">cities {citiesVisited}/5</span><span className="text-white/30">{progressCities}%</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-white transition-all" style={{width: `${progressCities}%`}} /></div>
            </div>
            <div>
              <div className="flex justify-between font-[family-name:var(--font-grotesk)] text-xs lowercase"><span className="text-white/60">your memories {myShrines.length} • night {nightPins}</span><span className="text-white/30">{progressTotal}%</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#ff3b30] transition-all" style={{width: `${progressTotal}%`}} /></div>
            </div>
            <p className="font-[family-name:var(--font-grotesk)] text-xs lowercase leading-4 text-white/30">pin in 5 cities, pin at night, pin where it's raining — museum coverage. triggers keep you coming back.</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.14em] text-white/25">memories — showing {Math.min(200, shrines.length)} of {shrines.length}</div>
          {shrines.slice(0,200).map((s,i)=>(
            <Card key={s.id} className="bg-white/[0.04] border-white/10 rounded-2xl overflow-hidden group hover:bg-white/[0.06] hover:border-white/15 transition">
              <div className="relative h-[170px] overflow-hidden bg-black">
                <img src={s.image} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-500" alt=""/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <Badge className="absolute top-2 left-2 bg-black/60 backdrop-blur border-white/15 text-white rounded-full font-[family-name:var(--font-grotesk)] lowercase text-[11px]">#{String(i+1).padStart(2,"0")} • {s.city}</Badge>
                <button aria-label="share" onClick={()=> share(s)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white text-black grid place-items-center hover:bg-white/90 active:scale-95"><Download01Icon size={12}/></button>
                <span className="absolute bottom-2 left-2 font-[family-name:var(--font-grotesk)] text-[11px] lowercase text-white/80">@{s.handle}</span>
              </div>
              <div className="p-3">
                <p className="font-[family-name:var(--font-serif)] text-sm leading-5 lowercase line-clamp-2">“{s.line}”</p>
                <div className="mt-2 flex items-center gap-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/30">
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  <button onClick={()=> { setSelected(s); document.getElementById("collection-drawer")?.classList.add("-translate-x-full"); }} className="ml-auto inline-flex items-center gap-1 text-white border border-white/10 rounded-full px-2.5 py-1 hover:bg-white hover:text-black transition">view <ArrowRight01Icon size={12}/></button>
                </div>
              </div>
            </Card>
          ))}
          <Card className="bg-[#ff3b30] border-0 rounded-2xl p-6 text-white">
            <h3 className="font-[family-name:var(--font-serif)] text-xl lowercase">your turn.</h3>
            <p className="font-[family-name:var(--font-grotesk)] text-sm lowercase opacity-80 mt-1">one photo, one line — pin as many memories as you want.</p>
            <Button onClick={()=> { document.getElementById("collection-drawer")?.classList.add("-translate-x-full"); setOpen(true); }} className="mt-3 bg-white text-black rounded-full w-full font-[family-name:var(--font-grotesk)] lowercase">pin your memory</Button>
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141414] border-white/10 rounded-[24px] p-0 overflow-hidden max-w-[520px] text-white max-h-[90vh] overflow-auto">
          <DialogHeader className="p-6 pb-0 text-left">
            <DialogTitle className="font-[family-name:var(--font-serif)] lowercase text-xl">pin your memory</DialogTitle>
            <DialogDescription className="font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-white/50">one photo, one line, one coordinate. where did this memory happen?</DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-4">
            {(handle && handle!=="you" && !changeHandle) ? (
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 h-11">
                <span className="font-[family-name:var(--font-grotesk)] text-sm lowercase">@{handle}</span>
                <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-emerald-400">• yours</span>
                <button type="button" onClick={()=> setChangeHandle(true)} className="ml-auto font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 hover:text-white underline underline-offset-2">change</button>
              </div>
            ) : (
            <div>
              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40 mb-2">your handle — unique, searchable</div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-[family-name:var(--font-grotesk)]">@</span>
                  <Input value={handle} onChange={e=> { const v=e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20); setHandle(v); checkHandle(v); }} placeholder="mayowa" className="bg-black/40 border-white/10 rounded-xl font-[family-name:var(--font-grotesk)] lowercase h-11 pl-7" maxLength={20}/>
                </div>
              </div>
              {handleTaken
                ? <p className="mt-1 font-[family-name:var(--font-grotesk)] text-xs lowercase text-[#ff3b30]">@{handle} is taken or reserved — pick another</p>
                : handle && handle!=="you" ? <p className="mt-1 font-[family-name:var(--font-grotesk)] text-xs lowercase text-emerald-400">@{handle} is yours</p>
              : <p className="mt-1 font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/25">claim it once — all your memories connect by it</p>}
            </div>
            )}
            <div>
              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40 mb-2">photos — up to 3, first is cover</div>
              <div className="grid grid-cols-3 gap-2">
                {[0,1,2].map(i=>(
                  photos[i] ? (
                    <div key={i} className="relative h-[110px] rounded-2xl overflow-hidden border border-white/15">
                      <img src={photos[i]} className="w-full h-full object-cover" alt=""/>
                      {i===0 && <span className="absolute bottom-1.5 left-1.5 font-[family-name:var(--font-grotesk)] text-[10px] lowercase bg-black/60 backdrop-blur px-2 py-0.5 rounded-full">cover</span>}
                      <button type="button" onClick={()=> { setPhotos(photos.filter((_,j)=> j!==i)); setImage(""); }} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur grid place-items-center text-xs">✕</button>
                    </div>
                  ) : (
                    <button key={i} type="button" disabled={photos.length>=3} onClick={()=> fileRef.current?.click()} className="h-[110px] rounded-2xl border-2 border-dashed border-white/15 bg-black/30 grid place-items-center hover:border-white/25 transition disabled:opacity-30 font-[family-name:var(--font-grotesk)] text-white/40">
                      <span className="flex flex-col items-center gap-1 text-xs lowercase"><ImageAdd01Icon size={20}/> {i===0 ? "cover" : `photo ${i+1}`}</span>
                    </button>
                  )
                ))}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; if(photos.length>=3) return; const r=new FileReader(); r.onload=()=> { const url=String(r.result); setPhotos(p=> [...p, url].slice(0,3)); setImage(url); }; r.readAsDataURL(f); (e.target as any).value=""; }} />
            </div>
            <div>
              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40 mb-2">one line — why you can’t throw it away</div>
              <Input value={line} onChange={e=> setLine(e.target.value)} placeholder="dad's nokia — still has his sms drafts" className="bg-black/40 border-white/10 rounded-xl font-[family-name:var(--font-grotesk)] lowercase h-11" maxLength={80}/>
              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/25 mt-1">{line.length}/80</div>
            </div>
            <div>
              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40 mb-2">when did it happen? — optional</div>
              <DatePicker value={memDate} onChange={setMemDate} placeholder="pick a date — defaults to today" />
            </div>
            <div>
              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40 mb-2">location — search any place or tap map</div>
              <div className="flex flex-col min-[420px]:flex-row gap-2">
                <div className="flex-1 relative min-w-0">
                  <Input value={cityQuery} onChange={e=> searchCity(e.target.value)} onKeyDown={e=> { if(e.key==="Escape"){ setCityQuery(""); setCityResults([]); } }} placeholder="search any city, address, village..." className="bg-black/40 border-white/10 rounded-xl font-[family-name:var(--font-grotesk)] lowercase h-11 pr-9" />
                  {cityQuery && (
                    <button aria-label="clear search" onClick={()=> { setCityQuery(""); setCityResults([]); }} className="absolute left-auto right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white/60 text-xs shrink-0">✕</button>
                  )}
                  {cityResults.length>0 && (
                    <div onTouchMove={e=> e.stopPropagation()} style={{WebkitOverflowScrolling:"touch", overscrollBehavior:"contain", touchAction:"pan-y"}} className="absolute top-[46px] inset-x-0 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden z-50 max-h-[220px] overflow-y-auto overscroll-contain">
                      {cityResults.map(r=>(
                        <button key={r.display_name} onClick={()=> { setPicked({lat:r.lat, lng:r.lng, label:r.name}); setCityQuery(r.display_name); setCityResults([]); }} className="w-full text-left px-3 py-2.5 hover:bg-white/10 active:bg-white/15 font-[family-name:var(--font-grotesk)] text-xs lowercase leading-4 border-b border-white/5 last:border-0">
                          <span className="text-white">{r.name}</span> <span className="text-white/40">— {r.display_name.slice(0,60)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="button" onClick={useCurrentLocation} disabled={locating} className="shrink-0 rounded-xl bg-white text-black hover:bg-white/90 h-11 px-4 font-[family-name:var(--font-grotesk)] lowercase text-xs w-full min-[420px]:w-auto">
                  {locating?"locating...":<> <Location01Icon size={14}/> use current</>}
                </Button>
              </div>
              {picked && <div className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-2 rounded-xl flex items-center gap-2"><MapPinIcon size={12}/> picked: {picked.label} • {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}</div>}
              {!picked && <p className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/25">tip: tap anywhere on the dark map to pin exactly at street level.</p>}
            </div>
            <Button onClick={pin} disabled={(photos.length===0 && !image) || !line.trim() || !picked} className="w-full bg-white text-black hover:bg-white/90 rounded-full h-11 font-[family-name:var(--font-grotesk)] lowercase font-medium disabled:opacity-40">pin to world map <MapPinIcon size={16}/></Button>
            <p className="text-center font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/25">free forever • unlimited pins • {picked? `pinned at ${picked.lat.toFixed(2)}, ${picked.lng.toFixed(2)}` : "pick anywhere on earth"}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* handle gate modal — claim @ to comment / feel */}
      {handleModal && (
        <div onClick={()=> { setHandleModal(false); setPendingAction(null); }} className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md grid place-items-center p-6">
          <div onClick={e=> e.stopPropagation()} className="w-full max-w-[360px] bg-[#141414] border border-white/10 rounded-[20px] p-6">
            <div className="font-[family-name:var(--font-serif)] lowercase text-xl">claim your @</div>
            <p className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/50 mt-1">you need a name before you join in — no @you, @me scums allowed.</p>
            <div className="mt-4 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 font-[family-name:var(--font-grotesk)]">@</span>
              <Input value={modalHandle} onChange={e=> { const v=e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20); setModalHandle(v); (async ()=>{ if(!v){ setModalTaken(false); return; } if(RESERVED.includes(v)){ setModalTaken(true); return; } if(supabase){ try{ const { data } = await supabase.from("memories").select("id").eq("handle", v).limit(1); setModalTaken(!!(data && data.length)); return; }catch{} } setModalTaken(shrines.some(s=> s.handle===v)); })(); }} onKeyDown={e=> { if(e.key==="Enter" && modalHandle && !modalTaken){ (async ()=>{ if(supabase){ try{ await supabase.from("users").upsert({ handle: modalHandle }, { onConflict:"handle" }); }catch{} } setHandle(modalHandle); localStorage.setItem("shrine_handle", modalHandle); setHandleModal(false); pendingAction?.(); setPendingAction(null); })(); } }} placeholder="mayowa" className="bg-black/40 border-white/10 rounded-xl font-[family-name:var(--font-grotesk)] lowercase h-11 pl-8" maxLength={20}/>
            </div>
            {modalTaken
              ? <p className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-[#ff3b30]">@{modalHandle} is taken or reserved</p>
              : modalHandle ? <p className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-emerald-400">@{modalHandle} is free</p> : null}
            <Button disabled={!modalHandle || modalTaken} onClick={()=> { (async ()=>{ if(supabase){ try{ await supabase.from("users").upsert({ handle: modalHandle }, { onConflict:"handle" }); }catch{} } setHandle(modalHandle); localStorage.setItem("shrine_handle", modalHandle); setHandleModal(false); pendingAction?.(); setPendingAction(null); })(); }} className="mt-4 w-full bg-white text-black hover:bg-white/90 rounded-full h-11 font-[family-name:var(--font-grotesk)] lowercase font-medium disabled:opacity-40">claim @{modalHandle || "..."}</Button>
            <button onClick={()=> { setHandleModal(false); setPendingAction(null); }} className="mt-2.5 w-full font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 hover:text-white/70">cancel</button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden"/>
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 flex flex-col sm:flex-row gap-3 justify-between">
          <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide text-white/25">© 2026 shrine — world museum of attachment • fable-grade • mapbox dark-v11 • instrument serif/sans</span>
          <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide text-white/25">{shrines.length} memories • vector • immersive • free</span>
        </div>
      </footer>
    </div>
  );
}
