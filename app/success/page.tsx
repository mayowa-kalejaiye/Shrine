"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tick02Icon, SparklesIcon, Brain01Icon } from "hugeicons-react";

function SuccessInner(){
  const params = useSearchParams();
  const checkoutId = params.get("checkout_id");
  const isMock = params.get("mock") === "1";

  useEffect(()=>{
    // mark keeper locally (replace with DB in prod via webhook)
    localStorage.setItem("void_pro","1");
  },[]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white grid place-items-center p-6">
      <Card className="w-full max-w-[520px] bg-[#141414] border-white/10 rounded-[24px] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500 text-white grid place-items-center mx-auto"><Tick02Icon size={28}/></div>
        <h1 className="mt-4 font-[family-name:var(--font-serif)] text-2xl font-black tracking-tight flex items-center justify-center gap-2"><SparklesIcon size={22}/> vault preserved</h1>
        <p className="mt-2 font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-white/60 text-sm">you’re now a <b className="text-white">void keeper</b> — unlimited thoughts, forever. bachs payment confirmed.</p>
        {checkoutId && <p className="mt-2 text-xs text-white/30 font-mono break-all">checkout: {checkoutId} {isMock && "(mock — set BACHS_API_KEY to go live)"}</p>}
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/dashboard"><Button className="bg-white text-black hover:bg-white/90 rounded-full">Enter vault <Brain01Icon size={16}/></Button></Link>
          <Link href="/"><Button variant="outline" className="rounded-full border-white/20 text-white">Home</Button></Link>
        </div>
        <p className="mt-4 text-xs text-white/20">Webhook will also confirm via /api/webhook → collection.succeeded</p>
      </Card>
    </div>
  )
}

export default function Success(){
  return <Suspense fallback={<div className="min-h-screen grid place-items-center bg-[#0a0a0b] text-white">Confirming...</div>}><SuccessInner/></Suspense>
}
