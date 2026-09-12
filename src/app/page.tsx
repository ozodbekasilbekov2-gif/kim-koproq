"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  loginViaTelegram,
  getStoredTgToken,
  waitForTelegramSdk,
} from "@/lib/telegram-client";
import { apiJson } from "@/lib/api-client";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { LoginScreen } from "@/components/kk/login-screen";
import { AppShell } from "@/components/kk/app-shell";
import { GuestMode } from "@/components/kk/guest-mode";

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
  // tgStatus: "checking" (still waiting for SDK + login attempt) | "done" (finished, user or null)
  const [tgStatus, setTgStatus] = useState<"checking" | "done">("checking");
  // Guest mode: when ?share=setId is in URL, allow browsing without registration
  const [guestSetId, setGuestSetId] = useState<string | null>(null);

  // Check for ?share=setId in URL on mount — if present, enter guest mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const share = params.get("share");
      if (share) {
        setGuestSetId(share);
        setTgStatus("done"); // skip auth wait
      }
    }
  }, []);

  // Telegram Mini App login — runs on mount, waits for SDK to load
  const tryTelegramLogin = useCallback(async () => {
    // Wait for the Telegram SDK script to load (up to 5 seconds).
    // If it doesn't load, we're not in a Telegram Mini App — fall through to NextAuth.
    const sdkReady = await waitForTelegramSdk(5000);
    if (!sdkReady) {
      // Not in Telegram Mini App — NextAuth will handle auth
      setTgStatus("done");
      return;
    }

    // SDK is ready — we're in a Telegram Mini App context.
    // Try to use a stored JWT first (avoids re-login on every visit).
    const stored = getStoredTgToken();
    let me: KKUser | null = null;
    if (stored) {
      try {
        me = await apiJson<KKUser>("/api/profile");
      } catch {
        // Token is stale — re-login via initData
        const data = await loginViaTelegram();
        if (data?.user) me = data.user;
        else if ((data as any)?.error) {
          toast.error(`Telegram login xatosi: ${(data as any).error}`);
        }
      }
    } else {
      // No stored token — fresh login via Telegram initData
      const data = await loginViaTelegram();
      if (data?.user) {
        me = data.user;
      } else if ((data as any)?.error) {
        toast.error(`Telegram login xatosi: ${(data as any).error}`);
      } else {
        // loginViaTelegram returns null if SDK not ready or initData empty
        toast.error("Telegram orqali kirib bo'lmadi. Botdan qayta urining.");
      }
    }
    if (me) setUser(me);
    setTgStatus("done");
  }, []);

  useEffect(() => {
    void tryTelegramLogin();
  }, [tryTelegramLogin]);

  // Loading state:
  // - Wait for Telegram SDK check to finish (up to 5s)
  // - AND wait for NextAuth session check
  const loading = tgStatus === "checking" || status === "loading";

  // Derive user from NextAuth session (when not in Telegram Mini App)
  const sessionUser: KKUser | null =
    status === "authenticated" && session?.user
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

  // Guest mode: ?share=setId — show the set directly without registration
  if (guestSetId) {
    const exitGuest = () => {
      setGuestSetId(null);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("share");
        window.history.replaceState({}, "", url.toString());
      }
    };
    return <GuestMode setId={guestSetId} onExit={exitGuest} />;
  }

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
