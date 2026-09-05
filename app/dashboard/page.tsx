"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FAKE_FEED, INTRUSIVE_PROMPTS, TAG_CONFIG, Thought, analyzeThought } from "@/lib/void-data";
import {
  Brain01Icon,
  ViewIcon,
  Clock01Icon,
  FireIcon,
  SparklesIcon,
  LockKeyIcon,
  ArrowRight01Icon,
  Idea01Icon,
  ChartUpIcon,
  FlashIcon,
  Delete02Icon,
  Tick02Icon,
  Alert02Icon,
  PlusSignIcon,
  MoreHorizontalIcon,
  Share01Icon,
  FavouriteIcon,
  Comment01Icon,
  ArrowLeft01Icon,
  Download01Icon,
  Message01Icon,
  User02Icon,
} from "hugeicons-react";

export default function Dashboard() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [input, setInput] = useState("");
  const [prompt, setPrompt] = useState(INTRUSIVE_PROMPTS[0]);
  const [filter, setFilter] = useState<"posts"|"preserved"|"live">("posts");
  const [isPro, setIsPro] = useState(false);
  const [streak, setStreak] = useState(4);
  const [entropy, setEntropy] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("anon@void.so");
  const [chatFor, setChatFor] = useState<string|null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState<Record<string, {from:"me"|"them", text:string}[]>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // streak + entropy logic
  useEffect(() => {
    const stored = localStorage.getItem("void_thoughts");
    if (stored) setThoughts(JSON.parse(stored));
    else setThoughts([
      { id:"m1", text:"i keep thinking everyone will realize i'm faking competence. every slack message feels like a test.", tag:"paranoia", intensity:82, createdAt:Date.now()-1000*60*60*5, expiresAt:Date.now()+1000*60*60*67, matches: 892, isPreserved:false },
      { id:"m2", text:"i want to quit my job and make weird internet art that no one asked for.", tag:"desire", intensity:71, createdAt:Date.now()-1000*60*60*28, expiresAt:Date.now()+1000*60*60*44, matches: 445, isPreserved:true },
      { id:"m3", text:"i scream in my car every morning before work and then act normal.", tag:"shame", intensity:88, createdAt:Date.now()-1000*60*60*12, expiresAt:Date.now()+1000*60*60*60, matches: 321, isPreserved:false },
    ]);
    setPrompt(INTRUSIVE_PROMPTS[Math.floor(Math.random()*INTRUSIVE_PROMPTS.length)]);
    setIsPro(localStorage.getItem("void_pro")==="1");
    const u = localStorage.getItem("void_user");
    if(u) try{ setUserEmail(JSON.parse(u).email || "anon@void.so")}catch{}
    const s = parseInt(localStorage.getItem("void_streak")||"4");
    setStreak(s);
    const last = localStorage.getItem("void_last_dump");
    if(last){
      const days = Math.floor((Date.now()-parseInt(last))/86400000);
      if(days>=1 && days<3) setEntropy(20);
      if(days>=2) setEntropy(40);
      if(days>=3) setEntropy(60);
    }
  }, []);

  useEffect(()=> { if(thoughts.length) localStorage.setItem("void_thoughts", JSON.stringify(thoughts)); }, [thoughts]);

  function dump() {
    if(!input.trim()) return;
    if(!isPro && thoughts.length >= 6) { setShowPaywall(true); return; }
    const {tag,intensity}=analyzeThought(input);
    const t: Thought = { id: Math.random().toString(36).slice(2), text: input.trim().toLowerCase(), tag, intensity, createdAt: Date.now(), expiresAt: Date.now()+72*3600*1000, matches: Math.floor(Math.random()*800)+120, isPreserved: isPro ? true : false };
    // if pro, auto-preserve (flip decay: default preserved)
    setThoughts(prev=>[t, ...prev]);
    setInput("");
    const nextStreak = streak+1;
    setStreak(nextStreak);
    localStorage.setItem("void_streak", String(nextStreak));
    localStorage.setItem("void_last_dump", String(Date.now()));
    setEntropy(0);
    setPrompt(INTRUSIVE_PROMPTS[Math.floor(Math.random()*INTRUSIVE_PROMPTS.length)]);
    setComposeOpen(false);
  }

  function preserve(id:string){
    if(!isPro){ setShowPaywall(true); return; }
    setThoughts(prev=> prev.map(t=> t.id===id ? {...t, isPreserved:true} : t));
  }

  // therapist roast — based on tags
  function getRoast(){
    const counts:Record<string,number>={};
    thoughts.forEach(t=> counts[t.tag]=(counts[t.tag]||0)+1);
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "paranoia";
    if(top==="shame") return "you use jokes to dodge shame. 4 of your last 6 thoughts were punchlines about pain. what are you not saying without the laugh?";
    if(top==="paranoia") return "you think 71% of the room is watching. spoiler: they’re thinking about themselves. who taught you to scan for judgment?";
    if(top==="desire") return "you want to be seen so badly it hurts. what would you do if no one could clap?";
    if(top==="rage") return "you’re angry at the wrong person. the draft you won’t send says more than the one you will.";
    return "you’re grieving something you never named. the void is listening. try naming it in one sentence.";
  }

  // export year in psyche — canvas share image
  function exportPsyche(){
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    if(!ctx) return;
    canvas.width=1080; canvas.height=1350;
    // bg
    ctx.fillStyle="#0a0a0b"; ctx.fillRect(0,0,1080,1350);
    // gradient
    const g=ctx.createLinearGradient(0,0,1080,400);
    g.addColorStop(0,"#ff3b30"); g.addColorStop(1,"#8b5cf6");
    ctx.fillStyle=g; ctx.fillRect(0,0,1080,400);
    ctx.fillStyle="white";
    ctx.font="800 72px system-ui"; ctx.fillText("VOID", 60, 120);
    ctx.font="400 20px system-ui"; ctx.fillText(`${displayName} • ${new Date().getFullYear()} in psyche`,60,160);
    ctx.font="600 18px system-ui"; ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.fillText(`streak ${streak} • ${thoughts.length} thoughts • ${preserved.length} preserved • entropy ${entropy}%`,60,200);
    // bars
    let y=320;
    Object.entries(TAG_CONFIG).forEach(([k,cfg])=>{
      const v=Math.floor(Math.random()*40)+10;
      ctx.fillStyle="rgba(255,255,255,0.1)"; ctx.fillRect(60,y,960,18);
      ctx.fillStyle="white"; ctx.fillRect(60,y, (v/100)*960,18);
      ctx.fillStyle="rgba(255,255,255,0.7)"; ctx.font="12px system-ui"; ctx.fillText(cfg.label,60,y-8);
      ctx.fillText(v+"%", 1000,y+14);
      y+=60;
    });
    ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="italic 18px serif"; 
    const roast=getRoast();
    wrapText(ctx, roast, 60, y+40, 960, 26);
    // download
    const url=canvas.toDataURL("image/png");
    const a=document.createElement("a"); a.href=url; a.download=`void-${displayName}-psyche.png`; a.click();
  }
  function wrapText(ctx:any, text:string, x:number, y:number, maxWidth:number, lineHeight:number){
    const words=text.split(" "); let line=""; for(let n=0;n<words.length;n++){ const test=line+words[n]+" "; const w=ctx.measureText(test).width; if(w>maxWidth && n>0){ ctx.fillText(line,x,y); line=words[n]+" "; y+=lineHeight; } else line=test; } ctx.fillText(line,x,y);
  }

  const handle = "@" + userEmail.split("@")[0].toLowerCase();
  const displayName = handle.slice(1).replace(/[._-]/g," ") || "anon";
  const posts = [...thoughts].sort((a,b)=>{
    // shame surfaces when entropy high — most shame first
    if(entropy>20){
      if(a.tag==="shame" && b.tag!=="shame") return -1;
      if(b.tag==="shame" && a.tag!=="shame") return 1;
    }
    return b.createdAt - a.createdAt;
  });
  const preserved = thoughts.filter(t=> t.isPreserved);
  const decay = (t:Thought)=> Math.max(0, 100 - ((Date.now()-t.createdAt)/(72*3600*1000))*100);
  const avatarRot = entropy>0 ? `grayscale(${Math.min(80, entropy)}%) contrast(1.2) brightness(${100-entropy/2}%)` : "none";
  const bannerEntropy = entropy>0 ? `blur(${entropy/20}px) brightness(${100-entropy/3}%)` : "none";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/[0.08]">
        <div className="mx-auto max-w-[1320px] flex">
          <div className="hidden lg:flex w-[320px] shrink-0 flex-col sticky top-0 h-screen border-r border-white/[0.06] p-4 pr-6">
            <Link href="/" className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-xl bg-white text-black grid place-items-center font-black text-sm">V</div>
              <span className="font-semibold tracking-tight text-[18px]">VOID</span>
            </Link>
            <nav className="mt-6 space-y-1.5 font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-[18px] leading-none">
              <Link href="/dashboard" className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white text-black font-medium"><Brain01Icon size={22}/> vault</Link>
              <Link href="/" className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-white/10 text-white/70"><ViewIcon size={22}/> live feed</Link>
              <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-white/30"><ChartUpIcon size={22}/> psyche — pro</div>
              <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-white/30"><Clock01Icon size={22}/> rituals — pro</div>
            </nav>
            <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
              <Button onClick={()=> setComposeOpen(true)} className="mt-6 w-full bg-[#ff3b30] hover:bg-[#ff3b30]/90 text-white rounded-full h-[52px] text-[16px] font-[family-name:var(--font-grotesk)] lowercase tracking-wide font-semibold">dump thought <PlusSignIcon size={18}/></Button>
              <DialogContent className="bg-[#141414] border-white/10 rounded-[20px] p-0 overflow-hidden max-w-[600px] text-white">
                <DialogHeader className="p-5 pb-0">
                  <DialogTitle className="font-[family-name:var(--font-serif)] lowercase text-lg">dump your thought</DialogTitle>
                  <DialogDescription className="font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-white/50">“{prompt}” — anonymous, encrypted{isPro ? ", auto-preserved" : ", dissolves in 72h"}.</DialogDescription>
                </DialogHeader>
                <div className="p-5 pt-3">
                  <Textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="what you can't say out loud..." className="min-h-[120px] bg-black/40 border-white/10 text-white placeholder:text-white/30 rounded-xl font-[family-name:var(--font-grotesk)] lowercase" maxLength={280}/>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/30">{input.length}/280 • {isPro?"∞ preserved • streak insurance":"72h decay • streak at risk"}</span>
                    <Button onClick={dump} disabled={!input.trim()} className="bg-white text-black hover:bg-white/90 rounded-full font-[family-name:var(--font-grotesk)] lowercase">dissolve <ArrowRight01Icon size={14}/></Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <div className="mt-auto p-3 flex items-center gap-3 rounded-xl hover:bg-white/5 cursor-pointer">
              <img src={`https://i.pravatar.cc/100?u=${userEmail}`} className="w-9 h-9 rounded-full" alt="" style={{filter: avatarRot}}/>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate lowercase font-[family-name:var(--font-grotesk)]">{displayName}</div>
                <div className="text-xs text-white/40 truncate font-[family-name:var(--font-grotesk)]">{handle} • entropy {entropy}%</div>
              </div>
              <MoreHorizontalIcon size={16} className="text-white/30"/>
            </div>
          </div>

          <div className="flex-1 min-w-0 max-w-[600px] border-r border-white/[0.06]">
            <div className="lg:hidden flex items-center gap-3 px-4 h-[53px] border-b border-white/[0.06] sticky top-0 bg-black/80 backdrop-blur z-10">
              <Link href="/"><ArrowLeft01Icon size={18}/></Link>
              <div>
                <div className="font-semibold leading-none lowercase font-[family-name:var(--font-serif)]">{displayName}</div>
                <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40">{posts.length} thoughts • entropy {entropy}%</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {!isPro ? <Badge className="bg-[#ff3b30] text-white border-0 rounded-full font-[family-name:var(--font-grotesk)] lowercase text-[11px]">$1 • ₦500</Badge> : <Badge className="bg-emerald-500 text-white border-0 rounded-full">keeper • insurance</Badge>}
              </div>
            </div>

            <div className="h-[150px] sm:h-[200px] w-full bg-gradient-to-br from-[#ff3b30] via-[#8b5cf6] to-[#0a0a0b] relative overflow-hidden" style={{filter: bannerEntropy}}>
              <div className="absolute inset-0 opacity-20" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`}}/>
              <div className="absolute bottom-3 right-3 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide bg-black/50 backdrop-blur px-2.5 py-1 rounded-full border border-white/10">{entropy>0?`entropy +${entropy}% • dump to heal`:"auto-dissolves in 72h • keep streak"}</div>
              {entropy>20 && <div className="absolute inset-0 bg-black/40 grid place-items-center"><span className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.2em] bg-[#ff3b30] text-white px-3 py-1 rounded-full">vault rotting — dump to restore</span></div>}
            </div>

            <div className="px-4 pb-3 relative">
              <div className="-mt-[44px] flex justify-between items-end relative z-10">
                <div className="relative">
                  <img src={`https://i.pravatar.cc/200?u=${userEmail}`} className="w-[88px] h-[88px] rounded-full border-4 border-black object-cover relative z-20 bg-black" alt="" style={{filter: avatarRot}}/>
                  {entropy>20 && <span className="absolute -bottom-1 -right-1 bg-[#ff3b30] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-black">+{entropy}%</span>}
                </div>
                <Button variant="outline" className="hidden sm:inline-flex rounded-full bg-white text-black border-white hover:bg-white/90 font-[family-name:var(--font-grotesk)] lowercase h-8" onClick={()=> setComposeOpen(true)}>dump thought</Button>
                <Button variant="outline" className="sm:hidden rounded-full bg-white text-black border-white h-8 px-3 font-[family-name:var(--font-grotesk)] lowercase" onClick={()=> setComposeOpen(true)}>dump</Button>
              </div>

              <h1 className="mt-3 font-[family-name:var(--font-serif)] text-xl font-bold lowercase tracking-tight leading-none">{displayName}</h1>
              <div className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/40">{handle} • joined void • {streak} day streak 🔥 • entropy {entropy}%</div>

              <p className="mt-3 font-[family-name:var(--font-grotesk)] text-[14px] leading-6 lowercase tracking-wide text-white/75 max-w-[520px]">
                vault for what i can’t say out loud. {posts.length} thoughts dumped, {preserved.length} preserved. {entropy>20?"your most shameful thought is surfacing. dump today to bury it.":"no likes. no followers. just me and the void."}
              </p>

              <div className="mt-3 flex flex-wrap gap-4 font-[family-name:var(--font-grotesk)] text-sm">
                <span><b>{posts.length}</b> <span className="text-white/40 lowercase">thoughts</span></span>
                <span><b>{preserved.length}</b> <span className="text-white/40 lowercase">preserved</span></span>
                <span className="inline-flex items-center gap-1"><FireIcon size={14} className="text-amber-500"/> <b>{streak}</b> <span className="text-white/40 lowercase">streak</span></span>
                <span className={entropy>20?"text-[#ff3b30]":"text-white/40"}><b>{entropy}%</b> <span className="lowercase">entropy</span></span>
              </div>

              <div className="mt-3 flex gap-2 font-[family-name:var(--font-grotesk)] text-xs lowercase">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-2.5 py-1"><LockKeyIcon size={12}/> encrypted</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-2.5 py-1"><Clock01Icon size={12}/> {isPro?"auto-preserved":"72h decay"}</span>
                {!isPro && <button onClick={()=> setShowPaywall(true)} className="inline-flex items-center gap-1 rounded-full bg-[#ff3b30] text-white px-2.5 py-1 animate-pulse">streak insurance — $1 / ₦500</button>}
              </div>

              {/* therapist roast */}
              <Card className="mt-4 bg-white/[0.03] border-white/10 rounded-xl p-3 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ff3b30] grid place-items-center shrink-0"><Brain01Icon size={14}/></div>
                <div>
                  <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.12em] text-white/40">void therapist roast</div>
                  <p className="font-[family-name:var(--font-serif)] text-sm leading-5 lowercase italic text-white/80 mt-1">“{getRoast()}”</p>
                  {!isPro && <button onClick={()=> setShowPaywall(true)} className="mt-1 font-[family-name:var(--font-grotesk)] text-xs lowercase underline text-amber-300">unlock daily roasts — $1 / ₦500</button>}
                </div>
              </Card>
            </div>

            <Tabs value={filter} onValueChange={(v)=> setFilter(v as any)} className="w-full">
              <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-white/[0.06] h-[53px] p-0 gap-0">
                <TabsTrigger value="posts" className="flex-1 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:text-white text-white/50 font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-sm h-full">posts <span className="ml-1 text-xs opacity-60">{posts.length}</span></TabsTrigger>
                <TabsTrigger value="preserved" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-white text-white/50 font-[family-name:var(--font-grotesk)] lowercase text-sm h-full">preserved <span className="ml-1 text-xs opacity-60">{preserved.length}</span></TabsTrigger>
                <TabsTrigger value="live" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-white text-white/50 font-[family-name:var(--font-grotesk)] lowercase text-sm h-full">live feed</TabsTrigger>
              </TabsList>

              <TabsContent value="posts" className="m-0">
                {posts.length===0 ? (
                  <div className="p-10 text-center">
                    <p className="font-[family-name:var(--font-serif)] text-lg lowercase">no thoughts yet</p>
                    <p className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/40 mt-1">dump your first thought — it’s freeing. {isPro?"auto-preserved.":"free dissolves in 72h."}</p>
                    <Button className="mt-4 bg-white text-black rounded-full font-[family-name:var(--font-grotesk)] lowercase" onClick={()=> setComposeOpen(true)}>dump thought</Button>
                  </div>
                ) : posts.map(t=>{
                  const cfg=TAG_CONFIG[t.tag];
                  const d=decay(t);
                  const h=Math.max(0, Math.floor((t.expiresAt-Date.now())/1000/60/60));
                  const isShameSurfaced = entropy>20 && t.tag==="shame";
                  return (
                    <div key={t.id} className={`px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02] transition group ${isShameSurfaced?"bg-[#ff3b30]/5":""}`}>
                      {isShameSurfaced && <div className="font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.14em] text-[#ff3b30] mb-2 flex items-center gap-1"><Alert02Icon size={12}/> surfaced by entropy — shame you buried</div>}
                      <div className="flex gap-3">
                        <img src={`https://i.pravatar.cc/100?u=${userEmail}`} className="w-10 h-10 rounded-full shrink-0" alt="" style={{filter: avatarRot}}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm lowercase font-[family-name:var(--font-grotesk)]">{displayName}</span>
                            <span className="text-sm text-white/40 font-[family-name:var(--font-grotesk)]">{handle}</span>
                            <span className="text-white/20">·</span>
                            <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40">{t.isPreserved?"preserved":`${h}h left`}</span>
                            <span className={`ml-1 text-[10px] tracking-wide px-1.5 py-0.5 rounded-full border font-[family-name:var(--font-grotesk)] lowercase ${cfg.bg} ${cfg.border} ${cfg.color}`}>{cfg.label}</span>
                            <button className="ml-auto text-white/20 hover:text-white"><MoreHorizontalIcon size={16}/></button>
                          </div>
                          <p className="mt-1 font-[family-name:var(--font-grotesk)] text-[15px] leading-6 text-white/90 lowercase">“{t.text}”</p>
                          <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-white/60 transition-all" style={{width:`${t.isPreserved?100:d}%`}} />
                          </div>
                          <div className="mt-1 flex justify-between font-[family-name:var(--font-grotesk)] text-[11px] lowercase tracking-[0.08em] text-white/25"><span>{t.isPreserved?"preserved forever":"dissolving"}</span><span>{t.isPreserved?"∞":`${h}h left`}</span></div>

                          <div className="mt-3 flex items-center justify-between max-w-[420px] text-white/35">
                            <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-grotesk)] text-xs"><Comment01Icon size={16}/> {Math.floor(Math.random()*40)} </span>
                            <button onClick={()=> setChatFor(chatFor===t.id?null:t.id)} className="inline-flex items-center gap-1.5 font-[family-name:var(--font-grotesk)] text-xs hover:text-white"><Message01Icon size={16}/> {t.matches} matches</button>
                            <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-grotesk)] text-xs"><FavouriteIcon size={16}/> {Math.floor(Math.random()*12)}</span>
                            <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-grotesk)] text-xs"><ViewIcon size={16}/> {Math.floor(Math.random()*800)+40}</span>
                            {!t.isPreserved ? (
                              <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs font-[family-name:var(--font-grotesk)] lowercase border border-white/10 hover:bg-white hover:text-black" onClick={()=> preserve(t.id)}>{isPro?"preserve":"preserve $1"}</Button>
                            ) : <Badge className="bg-emerald-500 text-white border-0 rounded-full font-[family-name:var(--font-grotesk)] lowercase text-xs h-7"><Tick02Icon size={12}/> preserved</Badge>}
                          </div>

                          {/* match chat - useful */}
                          {chatFor===t.id && (
                            <div className="mt-3 rounded-xl bg-black border border-white/10 overflow-hidden">
                              <div className="p-3 border-b border-white/5 flex items-center gap-2">
                                <img src={`https://i.pravatar.cc/100?img=${(t.matches%70)}`} className="w-7 h-7 rounded-full" alt=""/>
                                <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase">anon_{t.matches} • 94% match • {cfg.label}</span>
                                <span className="ml-auto font-[family-name:var(--font-grotesk)] text-xs lowercase text-emerald-400">● online</span>
                              </div>
                              <div className="p-3 space-y-2 max-h-[180px] overflow-auto">
                                <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[80%]">i also check my ex’s spotify every week. thought i was the only one. why do we do it?</div>
                                {(chatMsgs[t.id]||[]).map((m,i)=>(
                                  <div key={i} className={`font-[family-name:var(--font-grotesk)] text-xs lowercase px-3 py-2 rounded-2xl max-w-[80%] ${m.from==="me"?"bg-white text-black ml-auto rounded-br-sm":"bg-white/10 rounded-bl-sm"}`}>{m.text}</div>
                                ))}
                                {!isPro && <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-amber-300 flex items-center gap-1"><LockKeyIcon size={12}/> free: 1 reply. $1 unlocks unlimited anon chat.</div>}
                              </div>
                              <div className="p-2 flex gap-2 border-t border-white/5">
                                <Input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="reply anonymously..." className="flex-1 bg-white/5 border-white/10 h-8 rounded-full font-[family-name:var(--font-grotesk)] lowercase text-xs" onKeyDown={e=>{ if(e.key==="Enter" && chatInput.trim()){ const cur=chatMsgs[t.id]||[]; if(!isPro && cur.filter(m=>m.from==="me").length>=1){ setShowPaywall(true); return; } setChatMsgs({...chatMsgs, [t.id]: [...cur, {from:"me", text: chatInput.toLowerCase()}, {from:"them", text: "same. i thought it meant i’m not over them. maybe it just means i’m human."}]}); setChatInput(""); }}}/>
                                <Button size="sm" className="rounded-full bg-white text-black h-8 font-[family-name:var(--font-grotesk)] lowercase" onClick={()=>{
                                  if(!chatInput.trim()) return;
                                  const cur=chatMsgs[t.id]||[]; if(!isPro && cur.filter(m=>m.from==="me").length>=1){ setShowPaywall(true); return; }
                                  setChatMsgs({...chatMsgs, [t.id]: [...cur, {from:"me", text: chatInput.toLowerCase()}, {from:"them", text: "same. it’s not love, it’s proof we existed."}]}); setChatInput("");
                                }}>send</Button>
                              </div>
                            </div>
                          )}

                          {!chatFor && (
                            <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide text-white/45 flex items-center gap-1"><Idea01Icon size={12}/> {t.matches} people thought this today — {isPro?"tap to chat":"pay to chat"}</div>
                              <button onClick={()=> setChatFor(t.id)} className="mt-2 w-full rounded-full bg-white/10 border border-white/10 py-2 font-[family-name:var(--font-grotesk)] text-xs lowercase hover:bg-white hover:text-black">open anon chat — 94% match</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </TabsContent>

              <TabsContent value="preserved" className="m-0">
                {preserved.length===0 ? (
                  <div className="p-10 text-center font-[family-name:var(--font-grotesk)] lowercase text-white/40 text-sm">no preserved thoughts yet. {isPro?"dump one — auto-preserved.":"preserve for $1 / ₦500 • streak insurance"}</div>
                ) : preserved.map(t=>{
                  const cfg=TAG_CONFIG[t.tag];
                  return (
                    <div key={t.id} className="px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]">
                      <div className="flex gap-3">
                        <img src={`https://i.pravatar.cc/100?u=${userEmail}`} className="w-10 h-10 rounded-full" alt=""/>
                        <div className="flex-1">
                          <div className="flex items-center gap-2"><span className="font-semibold text-sm font-[family-name:var(--font-grotesk)] lowercase">{displayName}</span><span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-[family-name:var(--font-grotesk)] lowercase ${cfg.bg} ${cfg.border} ${cfg.color}`}>{cfg.label}</span><Badge className="ml-auto bg-emerald-500 text-white border-0 rounded-full font-[family-name:var(--font-grotesk)] lowercase text-xs"><Tick02Icon size={12}/> preserved</Badge></div>
                          <p className="mt-1 font-[family-name:var(--font-grotesk)] text-[15px] leading-6 lowercase">“{t.text}”</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </TabsContent>

              <TabsContent value="live" className="m-0">
                {FAKE_FEED.map(t=>{
                  const cfg=TAG_CONFIG[t.tag];
                  return (
                    <div key={t.id} className="px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.02]">
                      <div className="flex gap-3">
                        <img src={`https://i.pravatar.cc/100?img=${Math.floor(Math.random()*70)}`} className="w-10 h-10 rounded-full" alt=""/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5"><span className="font-semibold text-sm font-[family-name:var(--font-grotesk)] lowercase">anon</span><span className="text-sm text-white/40 font-[family-name:var(--font-grotesk)]">@anon_{Math.floor(Math.random()*999)}</span><span className="text-white/20">·</span><span className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/40">{Math.floor(Math.random()*50)+1}m</span><span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full border font-[family-name:var(--font-grotesk)] lowercase ${cfg.bg} ${cfg.border} ${cfg.color}`}>{cfg.label}</span></div>
                          <p className="mt-1 font-[family-name:var(--font-grotesk)] text-[14px] leading-6 lowercase text-white/70">“{t.text}”</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="p-6 text-center">
                  <p className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/40">blurred feed — keepers chat with matches.</p>
                  <Button size="sm" className="mt-3 bg-white text-black rounded-full font-[family-name:var(--font-grotesk)] lowercase" onClick={()=> setShowPaywall(true)}>unlock chat — $1 / ₦500</Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="hidden lg:block w-[350px] shrink-0 p-4 space-y-4">
            <Card className="bg-[#141414] border-white/10 rounded-2xl p-4">
              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/40 flex items-center gap-1.5"><ChartUpIcon size={14}/> brain weather</div>
              <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-black tracking-tighter">71%</span><span className="font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/50">paranoid today</span></div>
              <Progress value={71} className="mt-3 h-1.5 bg-white/10 [&>div]:bg-white" />
              <p className="mt-3 font-[family-name:var(--font-serif)] text-sm leading-6 lowercase italic text-white/60">“{getRoast()}”</p>
              {!isPro && <button onClick={()=> setShowPaywall(true)} className="mt-3 font-[family-name:var(--font-grotesk)] text-xs lowercase underline text-amber-300">unlock daily roasts — $1 / ₦500</button>}
            </Card>

            <Card className="bg-white text-black rounded-2xl p-4">
              <div className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-black/40 flex items-center justify-between">your vault <button onClick={exportPsyche} className="inline-flex items-center gap-1 text-xs lowercase border border-black/10 rounded-full px-2 py-0.5 hover:bg-black hover:text-white"><Download01Icon size={12}/> export</button></div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-black text-white p-2.5"><div className="text-xl font-black">{posts.length}</div><div className="font-[family-name:var(--font-grotesk)] text-[10px] lowercase tracking-wide opacity-60">thoughts</div></div>
                <div className={`rounded-xl p-2.5 ${entropy>20?"bg-[#ff3b30] text-white":"bg-black/5"}`}><div className="text-xl font-black">{streak}</div><div className="font-[family-name:var(--font-grotesk)] text-[10px] lowercase tracking-wide opacity-60">streak</div></div>
                <div className="rounded-xl bg-black/5 p-2.5"><div className="text-xl font-black">{entropy}%</div><div className="font-[family-name:var(--font-grotesk)] text-[10px] lowercase tracking-wide opacity-60">entropy</div></div>
              </div>
              <p className="mt-3 font-[family-name:var(--font-grotesk)] text-xs lowercase leading-5 text-black/60">{entropy>20?"vault rotting. dump today to drop entropy to 0 and hide shame.":"streak insurance: miss a day → entropy +20%, avatar rots, shame surfaces. $1 keeps you safe."}</p>
              <canvas ref={canvasRef} className="hidden"/>
            </Card>

            <Card className="bg-white/[0.03] border-white/10 rounded-2xl p-4">
              <h3 className="font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-sm font-medium">year in psyche</h3>
              <p className="font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-wide text-white/40 mt-1">tangible artifact — shareable image, worth $1 to post.</p>
              <Button onClick={exportPsyche} className="mt-3 w-full bg-white text-black hover:bg-white/90 rounded-full font-[family-name:var(--font-grotesk)] lowercase text-sm"><Download01Icon size={14}/> export psyche png</Button>
              <p className="mt-2 font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/30">keepers flex their vault. free users screenshot decay.</p>
            </Card>
          </div>
        </div>
      </div>

      <button onClick={()=> setComposeOpen(true)} className="lg:hidden fixed bottom-[72px] right-4 w-14 h-14 rounded-full bg-[#ff3b30] text-white grid place-items-center shadow-[0_8px_24px_rgba(255,59,48,0.5)] z-40">
        <PlusSignIcon size={24}/>
      </button>

      <div className="lg:hidden fixed bottom-0 inset-x-0 h-[56px] bg-black border-t border-white/10 flex items-center justify-around z-40 px-2">
        <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-white"><Brain01Icon size={20}/><span className="font-[family-name:var(--font-grotesk)] text-[10px] lowercase">vault</span></Link>
        <button onClick={()=> setFilter("live")} className="flex flex-col items-center gap-0.5 text-white/40"><ViewIcon size={20}/><span className="font-[family-name:var(--font-grotesk)] text-[10px] lowercase">live</span></button>
        <button onClick={()=> setShowPaywall(true)} className="flex flex-col items-center gap-0.5 text-white/40"><LockKeyIcon size={20}/><span className="font-[family-name:var(--font-grotesk)] text-[10px] lowercase">$1</span></button>
        <Link href="/" className="flex flex-col items-center gap-0.5 text-white/40"><SparklesIcon size={20}/><span className="font-[family-name:var(--font-grotesk)] text-[10px] lowercase">home</span></Link>
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-[#141414] border-white/10 rounded-[20px] p-0 overflow-hidden max-w-[600px] text-white sm:max-w-[600px]">
          <DialogHeader className="p-5 pb-0 text-left">
            <DialogTitle className="font-[family-name:var(--font-serif)] lowercase text-lg">dump your thought</DialogTitle>
            <DialogDescription className="font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-white/50">“{prompt}”</DialogDescription>
          </DialogHeader>
          <div className="p-5 pt-3">
            <Textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="what you can't say out loud..." className="min-h-[120px] bg-black/40 border-white/10 text-white placeholder:text-white/30 rounded-xl font-[family-name:var(--font-grotesk)] lowercase" maxLength={280} autoFocus/>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-[family-name:var(--font-grotesk)] text-xs lowercase text-white/30">{input.length}/280 • {isPro?"auto-preserved • streak +1":"entropy -20% if you dump"}</span>
              <Button onClick={dump} disabled={!input.trim()} className="bg-white text-black hover:bg-white/90 rounded-full font-[family-name:var(--font-grotesk)] lowercase">dissolve <ArrowRight01Icon size={14}/></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showPaywall && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur">
          <Card className="w-full max-w-[480px] bg-[#141414] border-white/10 rounded-[24px] p-6 relative">
            <button onClick={()=> setShowPaywall(false)} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 grid place-items-center">✕</button>
            <Badge className="bg-[#ff3b30] text-white border-0 rounded-full font-[family-name:var(--font-grotesk)] lowercase">streak insurance</Badge>
            <h3 className="mt-3 font-[family-name:var(--font-serif)] text-xl lowercase font-bold">don’t let your vault rot.</h3>
            <p className="mt-2 font-[family-name:var(--font-grotesk)] text-sm lowercase tracking-wide text-white/60 leading-6">for <b className="text-white">$1 / ₦500</b> you get: <b className="text-white">auto-preserve</b> (no decay), <b className="text-white">streak insurance</b> (miss a day, no entropy), <b className="text-white">anon match chat</b> (talk to the 94% match), <b className="text-white">daily roast</b> + <b className="text-white">year in psyche export</b>.</p>
            <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 font-[family-name:var(--font-grotesk)] text-xs lowercase text-amber-300">without it: miss tomorrow → entropy +20%, avatar rots, shame surfaces to top. you felt that?</div>
            <Button className="mt-5 w-full bg-white text-black hover:bg-white/90 rounded-full h-11 font-[family-name:var(--font-grotesk)] lowercase font-medium" onClick={async()=>{
              try{
                const res=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currency: navigator.language.includes("NG")?"NGN":"USD"})});
                const d=await res.json(); if(d.checkout_url) window.location.href=d.checkout_url; else {localStorage.setItem("void_pro","1"); setIsPro(true); setShowPaywall(false); setEntropy(0);}
              }catch{ localStorage.setItem("void_pro","1"); setIsPro(true); setShowPaywall(false); setEntropy(0);}
            }}>get streak insurance — $1 / ₦500 <LockKeyIcon size={16}/></Button>
            <button onClick={()=> setShowPaywall(false)} className="mt-3 w-full font-[family-name:var(--font-grotesk)] text-sm lowercase text-white/40">no, let it rot →</button>
          </Card>
        </div>
      )}
    </div>
  );
}
