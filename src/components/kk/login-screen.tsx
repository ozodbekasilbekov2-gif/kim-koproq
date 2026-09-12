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
      // NextAuth cookie set — fetch profile to populate UI
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-gradient shadow-2xl shadow-primary/30">
            <Zap className="w-10 h-10 text-white" strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Kim ko'proq...?</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Test platformasi — o'z so'rovlaringizni yarating
            </p>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
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
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full" size="lg">
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Familiya</Label>
                  <Input
                    id="lastName"
                    placeholder="Asilbekov"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
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
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full" size="lg">
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

        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center text-sm">
          <p className="font-medium">Telegram orqali kirish</p>
          <p className="text-xs text-muted-foreground mt-1">
            Telegram botimizdan mini app ni ochsangiz, avtomatik kiriladi.
          </p>
        </div>
      </div>
    </div>
  );
}
