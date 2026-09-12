"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  isTelegramMiniApp,
  loginViaTelegram,
  getStoredTgToken,
} from "@/lib/telegram-client";
import { apiJson } from "@/lib/api-client";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { LoginScreen } from "@/components/kk/login-screen";
import { AppShell } from "@/components/kk/app-shell";

export type KKUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  telegramName?: string | null;
  telegramPhoto?: string | null;
  telegramId?: string | null;
};

export default function Home() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<KKUser | null>(null);
  const [tgStatus, setTgStatus] = useState<"checking" | "no-tg" | "logged-in">("checking");

  const isTg = typeof window !== "undefined" && isTelegramMiniApp();

  // Telegram Mini App login — only when running inside Telegram
  const tryTelegramLogin = useCallback(async () => {
    if (!isTelegramMiniApp()) {
      setTgStatus("no-tg");
      return;
    }
    const stored = getStoredTgToken();
    let me: KKUser | null = null;
    if (stored) {
      try {
        me = await apiJson<KKUser>("/api/profile");
      } catch {
        const data = await loginViaTelegram();
        if (data?.user) me = data.user;
      }
    } else {
      const data = await loginViaTelegram();
      if (data?.user) me = data.user;
      else toast.error("Telegram orqali kirib bo'lmadi. Botdan qayta urining.");
    }
    if (me) setUser(me);
    setTgStatus("logged-in");
  }, []);

  useEffect(() => {
    // Telegram Mini App login side-effect — runs once on mount.
    void tryTelegramLogin();
  }, [tryTelegramLogin]);

  // Apply Telegram WebApp theme on mount
  useEffect(() => {
    const w = window as any;
    if (w.Telegram?.WebApp) {
      try {
        w.Telegram.WebApp.ready();
        w.Telegram.WebApp.expand();
        w.Telegram.WebApp.disableVerticalSwipes?.();
        w.Telegram.WebApp.setHeaderColor?.("#0a0a0a");
        w.Telegram.WebApp.setBackgroundColor?.("#0a0a0a");
      } catch {}
    }
  }, []);

  // Loading state:
  // - In Telegram Mini App: wait for tg login to complete
  // - On web: wait for NextAuth status
  const loading = isTg
    ? tgStatus === "checking"
    : status === "loading" || (status === "unauthenticated" && tgStatus === "checking");

  // Derive user from session directly (no setState-in-effect)
  const sessionUser: KKUser | null =
    !isTg && status === "authenticated" && session?.user
      ? (() => {
          const u = session.user as any;
          return {
            id: u.id,
            email: u.email,
            firstName: u.name?.split(" ")[0] || null,
            lastName: u.name?.split(" ").slice(1).join(" ") || null,
            avatarUrl: u.image,
          };
        })()
      : null;

  const currentUser = user || sessionUser;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <div className="bg-glow" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-24 h-24 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-2xl glow-lime animate-pulse">
            <Zap className="w-12 h-12 text-white" strokeWidth={3} fill="white" />
          </div>
          <div className="brand text-2xl tracking-wide">
            KIM KO'PROQ<span className="text-brand-yellow">...?</span>
          </div>
          <div className="text-sm text-muted-foreground">Yuklanmoqda...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={(u) => setUser(u)} />;
  }

  return <AppShell user={currentUser} onLogout={() => setUser(null)} />;
}
