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
import { fileToCover, compressDataUrl } from "@/lib/image";
import { createClient as createBrowser } from "@/lib/supabase-client";
import DatePicker from "@/components/DatePicker";
import { MapPinIcon, ImageAdd01Icon, ViewIcon, Share01Icon, Download01Icon, PlusSignIcon, Location01Icon, ArrowRight01Icon, ArrowUpRight01Icon, FavouriteIcon, ArrowLeft01Icon } from "hugeicons-react";
import { Toaster, toast } from "sonner";

const ShrineMap = dynamic(()=> import("@/components/ShrineMapGL"), { ssr:false, loading: ()=> <div className="h-[560px] w-full bg-[#0a0a0b] grid place-items-center font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/30 tracking-[0.14em]">loading museum...</div> });

// launch flag: set NEXT_PUBLIC_USE_SEED=false in Vercel to drop all simulated
// pins (friends batch + real pins stay — they live in supabase + localStorage).
const SEEDS: Shrine[] = process.env.NEXT_PUBLIC_USE_SEED === "false" ? [] : SEED_SHRINES;

// media cap: photos stay small for fast loads (videos are off — picker rejects them)
const capMedia = (u: string) => u.slice(0, 150000);

export default function ShrineFable(){
  const [shrines, setShrines] = useState<Shrine[]>(SEEDS);
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportReason, setReportReason] = useState("spam/ad");
  async function sendReport(){
    if(!selected || reportSent) return;
    try{
      const res = await fetch("/api/report", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ memory_id: selected.id, reason: reportReason, reporter: myHandle() }) });
      if(res.status===429){ toast("too many reports — try again later"); return; }
      if(!res.ok){ toast("report failed — try again"); return; }
      setReportSent(true);
      toast("reported — thanks", { description: "our team will take a look." });
    }catch{ toast("report failed — try again"); }
  }
  const [traceHandle, setTraceHandle] = useState<string|null>(null);
  // shuffle — meet a stranger instead of scrolling. jumps to a random person's memory.
  function shuffleToRandom(){
    const people = [...new Set(shrines.map(s=> s.handle))].filter(h=> h && h!=="you");
    if(!people.length){ toast("no strangers yet — pin the first memory"); return; }
    const others = selected && people.length > 1 ? people.filter(h=> h!==selected.handle) : people;
    const pick = others[Math.floor(Math.random()*others.length)];
    const mems = shrines.filter(s=> s.handle===pick);
    const first = mems[Math.floor(Math.random()*mems.length)];
    document.getElementById("collection-drawer")?.classList.add("-translate-x-full");
    setShowTimeline(false);
    setSelected(first);
    toast(`@${pick} • ${first.city}`, { description: `"${first.line.slice(0,52)}..."`, duration: 3500 });
  }
  // collection refresh — re-pull live pins (throttled client-side: 1 per 15s)
  const [refreshing, setRefreshing] = useState(false);
  const lastRefresh = useRef(0);
  async function refreshCollection(){
    if(refreshing) return;
    if(Date.now() - lastRefresh.current < 15000){ toast("fresh enough", { description: "collection refreshes every 15s" }); return; }
    lastRefresh.current = Date.now();
    if(!supabase){ toast("you're offline", { description: "showing saved pins" }); return; }
    setRefreshing(true);
    try{
      const { data, error } = await supabase.from("memories").select("*").eq("hidden", false).order("created_at", {ascending:false}).limit(2000);
      if(error) throw error;
      if(data){
        const db: Shrine[] = data.map((d:any)=> ({ id:d.id, image:d.image, images:d.images?.length?d.images:[d.image], line:d.line, city:d.city, lat:d.lat, lng:d.lng, handle:d.handle, createdAt:new Date(d.created_at).getTime() }));
        setShrines(prev=>{
          const ids = new Set(prev.map(p=> p.id));
          const fresh = db.filter(x=> !ids.has(x.id));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
        toast("collection refreshed", { description: `${data.length} live memories` });
      }
    }catch{ toast("refresh failed — try again"); }
    finally{ setRefreshing(false); }
  }
  const [userEmail, setUserEmail] = useState<string|null>(null);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  // if this browser forgot your @ (fresh device, cleared storage), ask the server:
  // a signed-in account restores its locked handle automatically.
  async function restoreHandle(){
    try{
      if(localStorage.getItem("shrine_handle")) return;
      const res = await fetch("/api/claim", { method: "GET" });
      if(!res.ok) return;
      const j = await res.json();
      if(j.handle){ setHandle(j.handle); localStorage.setItem("shrine_handle", j.handle); }
    }catch{}
  }
  useEffect(()=>{
    const browser = createBrowser();
    browser.auth.getUser().then(({ data })=> { setUserEmail(data.user?.email ?? null); if(data.user) restoreHandle(); });
    const { data: sub } = browser.auth.onAuthStateChange((_e, session)=> { setUserEmail(session?.user?.email ?? null); if(session?.user) restoreHandle(); });
    return ()=> { sub.subscription.unsubscribe(); };
  },[]);
  const [handleModal, setHandleModal] = useState(false);
  const [modalHandle, setModalHandle] = useState("");
  const [changingHandle, setChangingHandle] = useState(false);
  useEffect(()=>{ if(!handleModal){ setChangingHandle(false); setModalHandle(""); setModalTaken(false); } },[handleModal]);
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
  // surface OAuth / magic-link failures (?auth_error=...) instead of failing silently
  useEffect(()=>{
    const err = new URLSearchParams(window.location.search).get("auth_error");
    if(err){
      toast("sign-in failed", { description: err.slice(0,180) });
      window.history.replaceState({}, "", window.location.pathname);
    }
  },[]);
  // authoritative claim via rate-limited API (checks users + memories, reserves server-side)
  async function claimHandle(h: string): Promise<boolean>{
    const clean = h.toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20);
    if(!clean || RESERVED.includes(clean)) return false;
    try{
      const res = await fetch("/api/claim", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ handle: clean }) });
      if(res.status===401){ toast("sign in to claim", { description: "one account per @ — google or magic link below" }); return false; }
      if(res.status===409){
        const j = await res.json().catch(()=> null);
        const msg = String(j?.error || "taken");
        if(msg !== "taken" && msg !== "reserved") { toast(msg); return false; }
        setModalTaken(true); toast(`@${clean} is taken`, { description: "pick another handle" }); return false;
      }
      if(res.status===429){ toast("too many claims — try again later"); return false; }
      if(!res.ok) return false;
    }catch{
      // offline: fall back to local-only claim
    }
    setHandle(clean); localStorage.setItem("shrine_handle", clean);
    return true;
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
    try{
      const res = await fetch("/api/felt", { method: nowFelt ? "POST" : "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ memory_id: selected.id, handle: h }) });
      if(res.status===429) toast("too many felts — slow down", { description: "saved on your phone for now" });
      else if(res.status===403) toast(`@${h} is locked`, { description: "that @ belongs to a signed-in account" });
    }catch{}
  }
  useEffect(()=>{
    setViewPhoto(false); setShareOpen(false); setReportOpen(false); setReportSent(false); setEditing(false); setPhotoIdx(0); setShowComments(false); setCommentInput("");
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
  // reply-loop alerts: email me when someone feels/comments on my handle.
  // (declared after `handle` — the status check reads it.)
  const [alertsOn, setAlertsOn] = useState(false);
  useEffect(()=>{
    if(!handleModal || !userEmail || !handle || handle==="you") return;
    fetch(`/api/alerts?handle=${encodeURIComponent(handle)}`).then(r=> r.json()).then(j=> setAlertsOn(!!j.subscribed)).catch(()=>{});
  },[handleModal, userEmail, handle]);
  async function toggleAlerts(){
    if(!userEmail || !handle || handle==="you"){ toast("sign in + claim a handle first"); return; }
    try{
      const res = await fetch("/api/alerts", { method: alertsOn ? "DELETE" : "POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ handle }) });
      if(res.status===401){ toast("sign in first"); return; }
      if(res.status===503){ toast("alerts aren't available yet", { description: "check back soon" }); return; }
      if(!res.ok){ toast("try again"); return; }
      setAlertsOn(!alertsOn);
      toast(!alertsOn ? `alerts on for @${handle}` : `alerts off for @${handle}`);
    }catch{ toast("try again"); }
  }
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
      let base: Shrine[] = SEEDS;
      if(s){ try{ const p=JSON.parse(s); if(SEEDS.length===0 || p.length >= SEEDS.length-20) base = p.length ? p : SEEDS; }catch{} }
      // supabase persistence — traffic mode, no limit. hidden pins never reach the client map.
      if(supabase){
        try{
          const { data } = await supabase.from("memories").select("*").eq("hidden", false).order("created_at", {ascending:false}).limit(2000);
          if(data && data.length){
            const db: Shrine[] = data.map((d:any)=> ({ id:d.id, image:d.image, images:d.images?.length?d.images:[d.image], line:d.line, city:d.city, lat:d.lat, lng:d.lng, handle:d.handle, createdAt:new Date(d.created_at).getTime() }));
            base = [...db, ...base.filter(b=> !db.find(x=> x.id===b.id))];
          } else if(SEEDS.length===0 && !s){
            base = [];
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
  const [pinLocModal, setPinLocModal] = useState<null | { blocked: boolean }>(null);
  const isIOS = ()=> typeof navigator!=="undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || ((navigator as any).platform==="MacIntel" && navigator.maxTouchPoints>1));
  function requestPinLocation(){
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
      setPinLocModal(null);
    }, (err)=>{ setLocating(false); if(err.code===1 || isIOS()) setPinLocModal({ blocked: true }); else alert("couldn't get location — allow permission or search above"); }, { enableHighAccuracy:true, timeout:9000 });
  }
  function useCurrentLocation(){
    if(!navigator.geolocation) return alert("geolocation not supported");
    // iphones block silently until allowed — explain first, then ask from the tap
    if(isIOS()) setPinLocModal({ blocked: false });
    else requestPinLocation();
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
      // check BOTH tables — memories (pins) AND users (claims with no pins yet)
      const [{ data: mem }, { data: usr }] = await Promise.all([
        supabase.from("memories").select("id").eq("handle", clean).limit(1),
        supabase.from("users").select("id").eq("handle", clean).limit(1),
      ]);
      const takenLocal = shrines.some(s=> s.handle===clean && clean!==handle);
      setHandleTaken(!!(mem && mem.length) || !!(usr && usr.length) || takenLocal);
    }catch{ setHandleTaken(false); }
  }
  const [pinning, setPinning] = useState(false);
  async function pin(){
    if(pinning) return;
    if(!line.trim() || !image) return;
    if(!picked) return alert("pick a location — search, use current, or tap map");
    const clean = handle.toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20) || "you";
    if(handleTaken && clean!==localStorage.getItem("shrine_handle")) return alert(`@${clean} is taken — pick another`);
    setHandle(clean); localStorage.setItem("shrine_handle", clean);
    const when = memDate ? new Date(memDate + "T12:00:00").getTime() : Date.now();
    const cover = photos[0] || image;
    const s: Shrine = { id: Math.random().toString(36).slice(2), image: cover, images: photos.length? photos : [cover], line: line.toLowerCase(), city: picked.label, lat: picked.lat, lng: picked.lng, handle: clean, createdAt: when };
    // persist via rate-limited API (8 pins / 10 min / IP) — falls back to local-only on failure
    setPinning(true);
    try{
      const res = await fetch("/api/memories", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ handle: clean, city: s.city, lat: s.lat, lng: s.lng, line: s.line, image: capMedia(cover), images: (s.images||[]).map(capMedia) }) });
      if(res.status===429) toast("pin saved on your phone", { description: "you're pinning too fast — wait a bit" });
      else if(res.status===403) toast(`@${clean} is locked`, { description: "that @ belongs to a signed-in account" });
    }catch{} finally{ setPinning(false); }
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
    try{
      const res = await fetch("/api/comments", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ memory_id: c.memory_id, handle: c.handle, text: c.text }) });
      if(res.status===429) toast("comment saved on your phone", { description: "you're replying too fast — wait a bit" });
      else if(res.status===403) toast(`@${clean} is locked`, { description: "that @ belongs to a signed-in account" });
    }catch{
      try{ const k="shrine_comments"; const all=JSON.parse(localStorage.getItem(k)||"[]"); localStorage.setItem(k, JSON.stringify([c, ...all].slice(0,500))); }catch{}
    }
  }
  async function deleteMemory(){
    if(!selected || selected.handle!==handle || handle==="you") return;
    if(!confirm(`delete "${selected.line.slice(0,40)}..." forever? this can't be undone.`)) return;
    const id = selected.id;
    const removeEverywhere = ()=>{
      setShrines(prev=> prev.filter(x=> x.id!==id));
      // scrub every local cache now — pins, its comments, its felt flag
      try{
        const raw = localStorage.getItem("shrine_pins");
        if(raw){
          const all = JSON.parse(raw);
          localStorage.setItem("shrine_pins", JSON.stringify(all.filter((x:any)=> x.id!==id)));
        }
        const rc = localStorage.getItem("shrine_comments");
        if(rc){
          const allc = JSON.parse(rc);
          localStorage.setItem("shrine_comments", JSON.stringify(allc.filter((c:any)=> c.memory_id!==id)));
        }
        const rf = localStorage.getItem("shrine_felt");
        if(rf){
          const allf = JSON.parse(rf);
          delete allf[id];
          localStorage.setItem("shrine_felt", JSON.stringify(allf));
        }
      }catch{}
      setSelected(null);
    };
    try{
      const res = await fetch("/api/memories", { method:"DELETE", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ memory_id: id, handle }) });
      if(res.status===403){ toast("not yours to delete"); return; }
      if(res.status===503){ toast("delete unavailable right now"); return; }
      if(res.status===429){ toast("too many deletes — slow down"); return; }
      if(res.status===404){ removeEverywhere(); toast("memory deleted", { description: "gone from the map forever" }); return; }
      if(!res.ok){ toast("couldn't delete — try again"); return; }
      removeEverywhere();
      toast("memory deleted", { description: "gone from the map forever" });
    }catch{ toast("couldn't delete — try again"); }
  }
  // repair button only surfaces when this pin's server copy is actually truncated
  // (server cover shorter than the intact local copy) — no clutter otherwise.
  const [needsRepair, setNeedsRepair] = useState(false);
  useEffect(()=>{
    setNeedsRepair(false);
    if(!selected || !supabase || selected.handle!==handle || handle==="you") return;
    let cancelled = false;
    (async ()=>{
      try{
        const { data } = await supabase.from("memories").select("image").eq("id", selected.id).single();
        const serverLen = String((data as any)?.image || "").length;
        const localLen = String(selected.image || "").length;
        if(!cancelled && serverLen > 0 && localLen - serverLen > 1000) setNeedsRepair(true);
      }catch{}
    })();
    return ()=> { cancelled = true; };
  },[selected?.id, handle]);
  async function repairPhotos(){    if(!selected || selected.handle!==handle || handle==="you") return;
    const local = (selected.images?.length ? selected.images : [selected.image]).slice(0,3);
    toast("repairing photos...");
    try{
      const fixed: string[] = [];
      for (const u of local) fixed.push(await compressDataUrl(u));
      const res = await fetch("/api/memories", { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ memory_id: selected.id, handle, line: selected.line, images: fixed, image: fixed[0] }) });
      if(res.status===403){ toast("not yours to repair"); return; }
      if(!res.ok){ toast("couldn't repair — try again"); return; }
      const updated = { ...selected, image: fixed[0], images: fixed };
      setShrines(prev=> prev.map(x=> x.id===selected.id ? updated : x));
      setSelected(updated);
      toast("photos repaired", { description: "everyone can see them now" });
    }catch{ toast("couldn't repair — try again"); }
  }
  function saveEdit(){
    if(!selected || !editLine.trim()) return;
    // keep the original timestamp unless the date actually changed — no phantom moves
    const origDay = new Date(selected.createdAt).toISOString().slice(0,10);
    const when = editDate && editDate!==origDay ? new Date(editDate + "T12:00:00").getTime() : selected.createdAt;
    const updated = { ...selected, line: editLine.toLowerCase(), createdAt: when };
    const applyLocal = ()=> { setShrines(prev=> prev.map(x=> x.id===selected.id ? updated : x)); setSelected(updated); setEditing(false); };
    (async ()=>{
      try{
        const res = await fetch("/api/memories", { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ memory_id: selected.id, handle, line: updated.line, created_at: when }) });
        if(res.status===403){ toast("not yours to edit"); return; }
        if(res.status===503){ applyLocal(); toast("memory updated", { description: "saved on your phone" }); return; }
        if(!res.ok){ applyLocal(); toast("memory updated", { description: "saved on your phone — sync failed" }); return; }
        applyLocal();
        toast("memory updated");
      }catch{ applyLocal(); toast("memory updated", { description: "saved on your phone — sync failed" }); }
    })();
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
  // your stuff = pins under YOUR claimed handle, not the "you" placeholder
  const me = handle && handle!=="you" ? handle : "you";
  const myShrines = shrines.filter(s=> s.handle===me);
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
      <section className="relative h-[100dvh] w-full overflow-hidden bg-black">
        <div className="absolute inset-0">
          <ShrineMap shrines={shrines} selectedId={selected?.id || null} traceHandle={traceHandle} onHover={()=>{}} onSelect={setSelected} onPick={(lat,lng)=> { setPicked({lat,lng,label:`${lat.toFixed(3)}, ${lng.toFixed(3)}`}); }} />
        {/* trace banner — everywhere they've been */}
        {traceHandle && (
          <div className="absolute top-[64px] sm:top-[72px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-xl border border-white/15 rounded-full pl-4 pr-2 py-1.5 pointer-events-auto">
            <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide">tracing @{traceHandle} • {shrines.filter(s=> s.handle===traceHandle).length} places</span>
            <button onClick={()=> setTraceHandle(null)} className="w-7 h-7 rounded-full bg-white text-black grid place-items-center text-xs hover:bg-white/90">✕</button>
          </div>
        )}
        </div>
        {/* floating nav — shrine + your timeline + pin */}
        <div className="absolute top-3 sm:top-4 left-3 right-3 sm:left-6 sm:right-6 z-20 flex items-center justify-between gap-2 pointer-events-none">
          <Link href="/" className="flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/15 rounded-full px-3.5 py-1.5 pointer-events-auto shrink-0">
            <span className="font-[family-name:var(--font-serif)] text-[19px] leading-none">S</span>
            <span className="font-[family-name:var(--font-serif)] lowercase text-[14px] hidden min-[400px]:inline">shrine</span>
            <span className="hidden lg:inline font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.16em] text-white/40 border-l border-white/10 pl-2 ml-1">{shrines.length} memories</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto min-w-0">
            <button onClick={()=> { setModalHandle(""); setModalTaken(false); setPendingAction(null); setHandleModal(true); }} title={userEmail ? `${handle} • ${userEmail}` : "sign in / claim handle"} className="inline-flex shrink min-w-0 max-w-[118px] min-[400px]:max-w-[170px] sm:max-w-none items-center gap-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide bg-black/60 backdrop-blur-xl border border-white/15 text-white/80 hover:text-white hover:bg-black/80 px-2.5 min-[400px]:px-3 sm:px-4 py-2 rounded-full">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${userEmail ? "bg-emerald-400" : "bg-white/30"}`} /><span className="truncate">{handle && handle!=="you" ? `@${handle}` : "sign in"}</span>
            </button>
            <button onClick={()=> setShowTimeline(true)} className="inline-flex shrink-0 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide bg-black/60 backdrop-blur-xl border border-white/15 text-white/80 hover:text-white hover:bg-black/80 px-2.5 min-[400px]:px-3 sm:px-4 py-2 rounded-full">timeline</button>
            <button onClick={shuffleToRandom} title="meet a stranger — jump to a random person" className="hidden min-[400px]:inline-flex shrink-0 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide bg-black/60 backdrop-blur-xl border border-white/15 text-white/80 hover:text-white hover:bg-black/80 px-3 sm:px-4 py-2 rounded-full active:scale-95">shuffle</button>
            <Button onClick={()=> setOpen(true)} className="bg-[#ff3b30] text-white hover:bg-[#ff3b30]/90 rounded-full h-9 sm:h-10 px-3 sm:px-5 font-[family-name:var(--font-grotesk)] lowercase text-sm font-medium shadow-[0_12px_32px_rgba(255,59,48,0.4)] shrink-0 active:scale-95"><span className="sm:hidden">+ pin</span><span className="hidden sm:inline-flex items-center gap-1">pin your memory <PlusSignIcon size={14}/></span></Button>
          </div>
        </div>
        {/* floating hero — glass, top-left, dismissible on mobile */}
        {heroOpen && (
        <motion.div initial={{opacity:0, y:16}} animate={{opacity:1, y:0}} transition={{duration:0.7, ease:[0.16,1,0.3,1]}} className="absolute top-[64px] sm:top-[72px] left-3 right-3 sm:left-8 sm:right-auto sm:max-w-[520px] z-10 pointer-events-none">
          <h1 className="relative font-[family-name:var(--font-serif)] text-[26px] min-[400px]:text-[30px] sm:text-[48px] leading-[0.9] sm:leading-[0.85] tracking-[-0.04em] lowercase bg-black/60 backdrop-blur-xl border border-white/10 rounded-[16px] sm:rounded-[18px] px-4 sm:px-5 py-3.5 sm:py-4 pointer-events-auto">
            <button aria-label="dismiss" onClick={()=> setHeroOpen(false)} className="sm:hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 grid place-items-center text-white/60 text-xs">✕</button>
            where did this<br/><span className="text-white/40 italic">memory happen?</span>
            <p className="mt-2 sm:mt-3 font-[family-name:var(--font-grotesk)] text-[12px] sm:text-[13px] leading-5 sm:leading-6 lowercase tracking-wide text-white/60 font-normal">one photo, one line — keep the moments you'd hate to lose.</p>
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
                            {s.image.startsWith("data:video/") ? <video src={s.image} className="w-full h-[200px] object-cover" muted playsInline preload="metadata" /> : <img src={s.image} className="w-full h-[200px] object-cover" alt=""/>}
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
          <motion.div initial={{y:320}} animate={{y:0}} exit={{y:320}} transition={{type:"spring", damping:30, stiffness:320}} className="absolute bottom-0 inset-x-0 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[400px] max-h-[58dvh] bg-[#0f0f0f] border-t sm:border border-white/10 rounded-t-[24px] sm:rounded-[24px] shadow-[0_-24px_80px_rgba(0,0,0,0.6)] z-20 overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]">
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
                    {src.startsWith("data:video/") ? (
                      <video src={src} className="w-full h-[190px] sm:h-[220px] object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={src} className="w-full h-[190px] sm:h-[220px] object-cover" alt=""/>
                    )}
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
              {/* close = drag the sheet down (no button needed) */}
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
                    <span>{new Date(selected.createdAt).toLocaleDateString()}</span><span>•</span><span>{personMems.length} by @{selected.handle}</span><span>•</span><button onClick={()=> { setTraceHandle(selected.handle); setSelected(null); }} className="text-white hover:underline underline-offset-2">trace all →</button><span>•</span><button onClick={shuffleToRandom} className="text-white hover:underline underline-offset-2">shuffle →</button>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <button onClick={toggleFelt} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase border transition active:scale-95 ${felt[selected.id]?"bg-[#ff3b30]/15 border-[#ff3b30]/30 text-[#ff3b30]":"bg-white/[0.06] border-white/10 text-white/70 hover:text-white"}`}><FavouriteIcon size={13}/> {felt[selected.id]?"felt ✓":"i felt this"}{feltCount>0 && <span className="opacity-70">• {feltCount}</span>}</button>
                    <button onClick={()=> setShareOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white text-black font-[family-name:var(--font-grotesk)] text-xs lowercase font-medium active:scale-95"><Share01Icon size={13}/> share</button>
                    {selected.handle===handle && selected.handle!=="you" && (
                      <>
                        <button onClick={()=> { setEditing(true); setEditLine(selected.line); setEditDate(new Date(selected.createdAt).toISOString().slice(0,10)); }} className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 hover:text-white underline underline-offset-2">edit</button>
                        {needsRepair && <button onClick={repairPhotos} className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-amber-300/70 hover:text-amber-300 underline underline-offset-2">repair photos</button>}
                        <button onClick={deleteMemory} className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-[#ff3b30]/60 hover:text-[#ff3b30] underline underline-offset-2">delete</button>
                      </>
                    )}
                  </div>
                  {/* report — day-one moderation: 3+ reports auto-hides, /admin is the kill switch */}
                  <div className="mt-2">
                    {!reportOpen ? (
                      <button onClick={()=> setReportOpen(true)} className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-wide text-white/25 hover:text-white/60">report this memory</button>
                    ) : reportSent ? (
                      <p className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase text-emerald-400/80">reported — thanks for keeping the map clean</p>
                    ) : (
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
                        <div className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.14em] text-white/40">why?</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {["spam/ad","hate/harassment","gore/sexual","fake/test","other"].map(r=>(
                            <button key={r} onClick={()=> setReportReason(r)} className={`rounded-full px-3 py-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase border transition active:scale-95 ${reportReason===r?"bg-white text-black border-white":"bg-transparent border-white/15 text-white/60 hover:text-white"}`}>{r}</button>
                          ))}
                        </div>
                        <div className="mt-2.5 flex gap-2">
                          <button onClick={sendReport} className="flex-1 rounded-full bg-white text-black h-9 font-[family-name:var(--font-grotesk)] lowercase text-xs font-medium active:scale-[0.98]">send report</button>
                          <button onClick={()=> setReportOpen(false)} className="flex-1 rounded-full border border-white/15 h-9 font-[family-name:var(--font-grotesk)] lowercase text-xs text-white/60">cancel</button>
                        </div>
                      </div>
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
                      {s.image.startsWith("data:video/") ? <video src={s.image} className="w-full h-[88px] object-cover" muted playsInline preload="metadata" /> : <img src={s.image} loading="lazy" className="w-full h-[88px] object-cover" alt=""/>}
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
        {/* photo viewer — tap picture to see it big, blurred bg. arrows when 2-3 photos */}
        {selected && viewPhoto && (
          <div onClick={()=> setViewPhoto(false)} className="absolute inset-0 z-30 bg-black/70 backdrop-blur-xl grid place-items-center p-6">
            {((selected.images && selected.images[photoIdx]) || selected.image).startsWith("data:video/") ? (
              <video src={(selected.images && selected.images[photoIdx]) || selected.image} controls playsInline onClick={e=> e.stopPropagation()} className="max-h-[76vh] max-w-full rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]" />
            ) : (
              <img src={(selected.images && selected.images[photoIdx]) || selected.image} onClick={e=> e.stopPropagation()} className="max-h-[76vh] max-w-full rounded-2xl object-contain shadow-[0_32px_80px_rgba(0,0,0,0.7)]" alt=""/>
            )}
            {(selected.images && selected.images.length > 1) && (
              <>
                <button aria-label="previous photo" onClick={e=> { e.stopPropagation(); setPhotoIdx((photoIdx - 1 + selected.images!.length) % selected.images!.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-xl grid place-items-center text-white text-lg hover:bg-black/70 active:scale-95">‹</button>
                <button aria-label="next photo" onClick={e=> { e.stopPropagation(); setPhotoIdx((photoIdx + 1) % selected.images!.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-xl grid place-items-center text-white text-lg hover:bg-black/70 active:scale-95">›</button>
                <span className="absolute bottom-16 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide text-white/50">{photoIdx + 1}/{selected.images.length}</span>
              </>
            )}
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
      <div id="collection-drawer" className="fixed top-0 left-0 h-[100dvh] w-[92%] sm:w-[420px] bg-[#0f0f0f] border-r border-white/10 shadow-[24px_0_80px_rgba(0,0,0,0.6)] z-[60] -translate-x-full transition-transform duration-300 overflow-auto pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 z-50 bg-[#0f0f0f]/95 backdrop-blur-xl border-b border-white/10 px-4 h-[64px] flex items-center justify-between shrink-0">
          <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40">collection — {shrines.length} memories</span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={refreshCollection} disabled={refreshing} title="refresh live pins" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center disabled:opacity-40 active:rotate-180 transition-transform">{refreshing ? "…" : "↻"}</button>
            <button onClick={()=> document.getElementById("collection-drawer")?.classList.add("-translate-x-full")} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center shrink-0">✕</button>
          </div>
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
                {s.image.startsWith("data:video/") ? <video src={s.image} className="w-full h-full object-cover" muted playsInline preload="metadata" /> : <img src={s.image} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-500" alt=""/>}
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
                      {photos[i].startsWith("data:video/") ? (
                        <video src={photos[i]} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                      ) : (
                        <img src={photos[i]} className="w-full h-full object-cover" alt=""/>
                      )}
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
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; if(photos.length>=3) return; (async ()=>{ try{ const url = await fileToCover(f); setPhotos(p=> [...p, url].slice(0,3)); setImage(url); }catch(err){ const k = err instanceof Error ? err.message : ""; toast(k==="size" ? "photo too big" : "photos only", { description: k==="size" ? "even compressed — pick a smaller one" : "video pins are off — pick a photo" }); } })(); (e.target as any).value=""; }} />
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
              {!picked && <p className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/25">tip: search above, use current, or tap the map to pin at street level.</p>}
              {pinLocModal && (
                <div className="mt-2 rounded-2xl bg-[#1a1a1a] border border-white/10 p-4">
                  <div className="font-[family-name:var(--font-serif)] lowercase text-[15px]">find me for this pin</div>
                  {pinLocModal.blocked ? (
                    isIOS() ? (
                      <p className="mt-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase leading-5 text-white/60">
                        iphone blocked location. open settings → privacy & security → location services → on, allow safari → come back and retry. or just search above — same result.
                      </p>
                    ) : (
                      <p className="mt-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase leading-5 text-white/60">
                        location is blocked for this site. tap the lock icon in the address bar → site settings → allow location, then retry. or just search above — same result.
                      </p>
                    )
                  ) : (
                    <p className="mt-1.5 font-[family-name:var(--font-grotesk)] text-xs lowercase leading-5 text-white/60">
                      your iphone will ask for location next — tap allow. or skip and search above.
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button onClick={requestPinLocation} disabled={locating} className="flex-1 bg-white text-black hover:bg-white/90 rounded-full h-9 font-[family-name:var(--font-grotesk)] lowercase text-xs disabled:opacity-50">{locating ? "locating..." : "try locating me"}</Button>
                    <Button onClick={()=> setPinLocModal(null)} variant="outline" className="flex-1 rounded-full border-white/15 font-[family-name:var(--font-grotesk)] lowercase text-xs h-9">search instead</Button>
                  </div>
                </div>
              )}
            </div>
            <Button onClick={pin} disabled={(photos.length===0 && !image) || !line.trim() || !picked || pinning} className="w-full bg-white text-black hover:bg-white/90 rounded-full h-11 font-[family-name:var(--font-grotesk)] lowercase font-medium disabled:opacity-40">{pinning ? "pinning..." : <>pin to world map <MapPinIcon size={16}/></>}</Button>
            <p className="text-center font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/25">free forever • unlimited pins • {picked? `pinned at ${picked.lat.toFixed(2)}, ${picked.lng.toFixed(2)}` : "pick anywhere on earth"}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* handle gate modal — claim @ to comment / feel */}
      {handleModal && (
        <div onClick={()=> { setHandleModal(false); setPendingAction(null); }} className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md grid place-items-center p-6">
          <div onClick={e=> e.stopPropagation()} className="w-full max-w-[360px] bg-[#141414] border border-white/10 rounded-[20px] p-6">
            <div className="font-[family-name:var(--font-serif)] lowercase text-xl">{handle && handle!=="you" ? "your @" : "claim your @"}</div>
            <p className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/50 mt-1">{handle && handle!=="you" ? "locked to your account — one @ per account." : "you need a name before you join in — no @you, @me scums allowed."}</p>
            {(handle && handle!=="you" && !changingHandle) ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 h-11">
                <span className="font-[family-name:var(--font-grotesk)] text-sm lowercase">@{handle}</span>
                <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-emerald-400">• locked</span>
                <button onClick={()=> { setChangingHandle(true); setModalHandle(""); setModalTaken(false); }} className="ml-auto font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 hover:text-white underline underline-offset-2">change</button>
              </div>
            ) : (
            <>
            <div className="mt-4 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 font-[family-name:var(--font-grotesk)]">@</span>
              <Input value={modalHandle} onChange={e=> { const v=e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20); setModalHandle(v); (async ()=>{ if(!v){ setModalTaken(false); return; } if(RESERVED.includes(v)){ setModalTaken(true); return; } if(supabase){ try{ const [{ data: mem }, { data: usr }] = await Promise.all([supabase.from("memories").select("id").eq("handle", v).limit(1), supabase.from("users").select("id").eq("handle", v).limit(1)]); setModalTaken(!!(mem && mem.length) || !!(usr && usr.length)); return; }catch{} } setModalTaken(shrines.some(s=> s.handle===v)); })(); }} onKeyDown={e=> { if(e.key==="Enter" && modalHandle && !modalTaken){ (async ()=>{ if(await claimHandle(modalHandle)){ setHandleModal(false); pendingAction?.(); setPendingAction(null); } })(); } }} placeholder="mayowa" className="bg-black/40 border-white/10 rounded-xl font-[family-name:var(--font-grotesk)] lowercase h-11 pl-8" maxLength={20}/>
            </div>
            {modalTaken
              ? <p className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-[#ff3b30]">@{modalHandle} is taken or reserved</p>
              : modalHandle ? <p className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-emerald-400">@{modalHandle} is free</p> : null}
            <Button disabled={!modalHandle || modalTaken} onClick={()=> { (async ()=>{ if(await claimHandle(modalHandle)){ setHandleModal(false); pendingAction?.(); setPendingAction(null); } })(); }} className="mt-4 w-full bg-white text-black hover:bg-white/90 rounded-full h-11 font-[family-name:var(--font-grotesk)] lowercase font-medium disabled:opacity-40">claim @{modalHandle || "..."}</Button>
            </>
            )}
            <div className="mt-4 flex items-center gap-3">
              <span className="flex-1 h-px bg-white/10" />
              <span className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.14em] text-white/30">lock it to you</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>
            {userEmail ? (
              <>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 h-11">
                  <span className="font-[family-name:var(--font-grotesk)] text-sm lowercase truncate">{userEmail}</span>
                  <button onClick={async ()=> { await createBrowser().auth.signOut(); setUserEmail(null); }} className="ml-auto font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/50 hover:text-white underline underline-offset-2 shrink-0">sign out</button>
                </div>
                {handle && handle!=="you" && (
                  <button onClick={toggleAlerts} className="mt-2 w-full flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 h-11 text-left active:scale-[0.99]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${alertsOn ? "bg-emerald-400" : "bg-white/25"}`} />
                    <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/70">email me when someone feels/comments on @{handle}</span>
                    <span className="ml-auto font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40 shrink-0">{alertsOn ? "on" : "off"}</span>
                  </button>
                )}
              </>
            ) : (
              <div className="mt-3 space-y-2">
                <Button onClick={async ()=> { await createBrowser().auth.signInWithOAuth({ provider:"google", options:{ redirectTo: `${window.location.origin}/auth/callback` } }); }} className="w-full rounded-xl bg-white text-black hover:bg-white/90 h-11 font-[family-name:var(--font-grotesk)] lowercase text-sm font-medium">
                  <svg width="15" height="15" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  continue with google
                </Button>
                {magicSent ? (
                  <p className="text-center font-[family-name:var(--font-grotesk)] text-xs lowercase text-emerald-400">check {magicEmail} — tap the link to sign in</p>
                ) : (
                  <div className="flex gap-2">
                    <Input value={magicEmail} onChange={e=> setMagicEmail(e.target.value)} onKeyDown={e=> { if(e.key==="Enter" && magicEmail.includes("@")){ createBrowser().auth.signInWithOtp({ email: magicEmail, options:{ emailRedirectTo: `${window.location.origin}/auth/callback` } }).then(()=> setMagicSent(true)); } }} type="email" placeholder="you@email.com" className="flex-1 bg-black/40 border-white/10 rounded-xl font-[family-name:var(--font-grotesk)] lowercase h-11" />
                    <Button disabled={!magicEmail.includes("@")} onClick={()=> { createBrowser().auth.signInWithOtp({ email: magicEmail, options:{ emailRedirectTo: `${window.location.origin}/auth/callback` } }).then(()=> setMagicSent(true)); }} className="rounded-xl bg-white text-black hover:bg-white/90 h-11 px-4 font-[family-name:var(--font-grotesk)] lowercase text-xs font-medium shrink-0 disabled:opacity-40">magic link</Button>
                  </div>
                )}
              </div>
            )}
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
