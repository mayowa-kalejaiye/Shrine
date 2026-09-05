import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cancel01Icon } from "hugeicons-react";

export default function Cancel(){
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white grid place-items-center p-6">
      <Card className="w-full max-w-[520px] bg-[#141414] border-white/10 rounded-[24px] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/10 grid place-items-center mx-auto"><Cancel01Icon size={24}/></div>
        <h1 className="mt-4 text-xl font-bold">Payment cancelled</h1>
        <p className="mt-2 text-white/60 text-sm">Your thoughts will keep dissolving in 72h. Come back when you’re ready to preserve them.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/dashboard"><Button className="bg-white text-black rounded-full">Back to vault</Button></Link>
          <Link href="/"><Button variant="ghost" className="text-white/60">Home</Button></Link>
        </div>
      </Card>
    </div>
  )
}
