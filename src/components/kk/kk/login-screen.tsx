"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { apiJson, setSessionToken } from "@/lib/api-client";
import { toast } from "sonner";
import type { KKUser } from "@/app/page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Loader2, Zap } from "lucide-react";

export function LoginScreen({ onLogin }: { onLogin: (u: KKUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "register") {
        await apiJson("/api/register", {
          method: "POST",
          body: JSON.stringify({ email, password, firstName, lastName }),
        });
      }
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        toast.error(res?.error || "Email yoki parol noto'g'ri");
        setBusy(false);
        return;
      }
      setSessionToken(null);
      const me = await apiJson<KKUser>("/api/profile");
      onLogin(me);
      toast.success("Xush kelibsiz!");
    } catch (e: any) {
      toast.error(e.message || "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      {/* Glow accents */}
      <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-brand-lime/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full bg-brand-yellow/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo — original vibe */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-brand-gradient shadow-2xl glow-lime">
            <Zap className="w-12 h-12 text-white" strokeWidth={3} fill="white" />
          </div>
          <div>
            <h1 className="brand text-5xl tracking-wide leading-none">
              KIM KO'PROQ<span className="text-brand-yellow">...?</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              2AF1 guruhi uchun qiziqarli so'rov
            </p>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-card border border-border">
            <TabsTrigger value="login">Kirish</TabsTrigger>
            <TabsTrigger value="register">Ro'yxatdan o'tish</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="siz@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10 bg-card border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-lime"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full btn-primary" size="lg">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Kirish
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Ism</Label>
                  <Input
                    id="firstName"
                    placeholder="Ozodbek"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Familiya</Label>
                  <Input
                    id="lastName"
                    placeholder="Asilbekov"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email2">Email</Label>
                <Input
                  id="email2"
                  type="email"
                  placeholder="siz@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2">Parol (min 6 belgi)</Label>
                <div className="relative">
                  <Input
                    id="password2"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pr-10 bg-card border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-lime"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full btn-primary" size="lg">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Ro'yxatdan o'tish
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-xs text-muted-foreground">
            yoki
          </span>
        </div>

        <div className="rounded-xl border border-brand-lime/30 bg-brand-lime/5 p-4 text-center text-sm">
          <p className="font-medium text-brand-lime">Telegram orqali kirish</p>
          <p className="text-xs text-muted-foreground mt-1">
            Telegram botimizdan mini app ni ochsangiz, avtomatik kiriladi — hech qanday parol kerak emas.
          </p>
        </div>
      </div>
    </div>
  );
}
