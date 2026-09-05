"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Brain01Icon, LockKeyIcon, ShieldKeyIcon, ViewIcon } from "hugeicons-react";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin"|"signup">("signin");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem("void_user", JSON.stringify({ email }));
      window.location.href = "/dashboard";
    }, 700);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white grid place-items-center p-6 relative overflow-hidden">
      {/* bg */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-[radial-gradient(ellipse_at_center,_rgba(255,59,48,0.10),_transparent_60%)] blur-[30px]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}} />
      </div>

      <div className="w-full max-w-[420px]">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-white text-black grid place-items-center font-black text-[14px]">V</div>
          <span className="font-semibold tracking-tight">VOID</span>
          <Badge variant="secondary" className="bg-white/10 text-white/60 border-white/10 text-[10px]">BETTER-AUTH SECURED</Badge>
        </Link>

        {/* Better-Auth.com style: centered card, clean, shadcn */}
        <Card className="bg-[#141414] border-white/10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <CardHeader className="space-y-3 pb-4">
            <div className="w-10 h-10 rounded-xl bg-white text-black grid place-items-center mx-auto">
              <Brain01Icon size={20} />
            </div>
            <CardTitle className="text-center font-[family-name:var(--font-serif)] text-[22px] tracking-tight">
              {mode === "signin" ? "welcome back to the void" : "create your vault"}
            </CardTitle>
            <CardDescription className="text-center font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-white/50">
              {mode === "signin" ? "sign in to continue dissolving" : "anonymous by default. encrypted. yours."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Social - better-auth pattern */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="bg-white text-black hover:bg-white/90 border-0 rounded-full h-10 font-medium" onClick={() => { localStorage.setItem("void_user", JSON.stringify({email:"demo@void.so"})); window.location.href="/dashboard"}}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google
              </Button>
              <Button variant="outline" className="rounded-full h-10 bg-white/10 border-white/10 text-white hover:bg-white/15" onClick={() => { localStorage.setItem("void_user", JSON.stringify({email:"demo@void.so"})); window.location.href="/dashboard"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                GitHub
              </Button>
            </div>

            <div className="relative">
              <Separator className="bg-white/10" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#141414] px-3 font-[family-name:var(--font-grotesk)] text-xs lowercase tracking-[0.14em] text-white/30">or</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-white/80 text-sm">email</Label>
                <Input id="email" type="email" placeholder="you@void.so" required value={email} onChange={e=>setEmail(e.target.value)} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-xl focus-visible:ring-white/20 font-[family-name:var(--font-grotesk)]" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="password" className="font-[family-name:var(--font-grotesk)] lowercase tracking-wide text-white/80 text-sm">password</Label>
                  {mode==="signin" && <a className="font-[family-name:var(--font-grotesk)] lowercase text-xs text-white/40 hover:text-white/70">forgot?</a>}
                </div>
                <Input id="password" type="password" placeholder="••••••••" required className="bg-white/5 border-white/10 h-11 rounded-xl font-[family-name:var(--font-grotesk)]" />
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-white text-black hover:bg-white/90 rounded-full h-11 font-semibold">
                {loading ? "Entering..." : mode==="signin" ? "Enter Void" : "Create Vault"} <LockKeyIcon size={16}/>
              </Button>
            </form>

            <div className="flex items-center justify-center gap-1 text-sm">
              <span className="text-white/40">{mode==="signin" ? "No vault yet?" : "Already have a vault?"}</span>
              <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} className="text-white font-medium hover:underline">
                {mode==="signin" ? "Create one" : "Sign in"}
              </button>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-white/30">
              <span className="flex items-center gap-1"><ShieldKeyIcon size={12}/> Better Auth</span>
              <span>•</span>
              <span className="flex items-center gap-1"><ViewIcon size={12}/> Encrypted</span>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-white/20 px-6">
          By entering, you agree that your thoughts will dissolve in 72h unless preserved. This is not therapy. If you’re in crisis, talk to a human.
        </p>
      </div>
    </div>
  );
}
