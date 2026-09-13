"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  LayoutGrid,
  Users,
  User,
  Zap,
  LogOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { KKUser } from "@/app/page";
import { SetsPage } from "./sets-page";
import { AvatarsPage } from "./avatars-page";
import { ProfilePage } from "./profile-page";

export type PageKey = "sets" | "avatars" | "profile";
export type ActionMode = "create" | "edit" | "delete" | null;
export type SelectionState = {
  mode: ActionMode;
  selectedIds: string[];
  search: string;
};

export function AppShell({
  user,
  onLogout,
  onOpenSharedSet,
}: {
  user: KKUser;
  onLogout: () => void;
  onOpenSharedSet?: (setId: string) => void;
}) {
  const [page, setPage] = useState<PageKey>("sets");
  const [selection, setSelection] = useState<SelectionState>({
    mode: null,
    selectedIds: [],
    search: "",
  });

  const userName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.telegramName ||
    user.email ||
    "Foydalanuvchi";

  const resetSelection = useCallback(() => {
    setSelection({ mode: null, selectedIds: [], search: "" });
  }, []);

  const handleAction = (mode: ActionMode) => {
    if (selection.mode === mode) {
      setSelection({ ...selection, mode: null, selectedIds: [] });
    } else {
      setSelection({ ...selection, mode, selectedIds: [] });
    }
  };

  const setMode = (mode: ActionMode) => {
    setSelection((s) => ({ ...s, mode, selectedIds: [] }));
  };

  const setSearch = (search: string) => {
    setSelection((s) => ({ ...s, search }));
  };

  // Universal action buttons — square shape, original neon colors
  const actionButtons: {
    key: ActionMode | "search";
    label: string;
    icon: React.ReactNode;
    bg: string;
    active?: boolean;
    onClick: () => void;
    disabled?: boolean;
  }[] = [
    {
      key: "create",
      label: "Yaratish",
      icon: <Plus className="w-5 h-5" strokeWidth={2.5} />,
      bg: "bg-brand-yellow text-black hover:bg-yellow-300",
      onClick: () => {
        if (page === "profile") return;
        setMode("create");
      },
      disabled: page === "profile",
    },
    {
      key: "edit",
      label: "Tahrirlash",
      icon: <Pencil className="w-5 h-5" strokeWidth={2} />,
      bg: "bg-white/5 text-brand-lime hover:bg-white/10 border border-brand-lime/30",
      onClick: () => {
        if (page === "profile") return;
        handleAction("edit");
      },
      disabled: page === "profile",
      active: selection.mode === "edit",
    },
    {
      key: "delete",
      label: "O'chirish",
      icon: <Trash2 className="w-5 h-5" strokeWidth={2} />,
      bg: "bg-brand-red/20 text-brand-red hover:bg-brand-red/30 border border-brand-red/40",
      onClick: () => {
        if (page === "profile") return;
        handleAction("delete");
      },
      disabled: page === "profile",
      active: selection.mode === "delete",
    },
  ];

  // Bottom nav — square buttons with original neon colors
  const bottomNav: {
    key: PageKey;
    label: string;
    icon: React.ReactNode;
    activeBg: string;
    active: boolean;
  }[] = [
    {
      key: "sets",
      label: "Setlar",
      icon: <LayoutGrid className="w-5 h-5" strokeWidth={2} />,
      activeBg: "bg-brand-coral/20 text-brand-coral border border-brand-coral/40",
      active: page === "sets",
    },
    {
      key: "avatars",
      label: "Avatari",
      icon: <Users className="w-5 h-5" strokeWidth={2} />,
      activeBg: "bg-brand-lime/20 text-brand-lime border border-brand-lime/40",
      active: page === "avatars",
    },
    {
      key: "profile",
      label: "Profil",
      icon: <User className="w-5 h-5" strokeWidth={2} />,
      activeBg: "bg-white/10 text-white border border-white/20",
      active: page === "profile",
    },
  ];

  const handleLogout = async () => {
    try {
      // Step 1: Get the CSRF token from NextAuth
      const csrfRes = await fetch("/api/auth/csrf");
      const csrfData = await csrfRes.json();
      const csrfToken = csrfData.csrfToken;

      // Step 2: Call signout with the CSRF token (must be form-encoded)
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `csrfToken=${encodeURIComponent(csrfToken)}&callbackUrl=${encodeURIComponent("/")}&json=true`,
      }).catch(() => {});
    } catch {}

    // Step 3: Clear local storage regardless of API result
    localStorage.removeItem("kk_session");
    localStorage.removeItem("kk_tg_token");
    // Clear all kk_guest_me_* keys (localStorage.removeItem doesn't support wildcards)
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("kk_guest_me_") || key.startsWith("kk_guest_answers_")) {
        localStorage.removeItem(key);
      }
    });

    // Step 4: Call parent's onLogout to reset state
    onLogout();
    toast.success("Tizimdan chiqdingiz");

    // Step 5: Force page reload to clear all session state
    if (typeof window !== "undefined") {
      setTimeout(() => window.location.reload(), 300);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      {/* Top bar with logo + universal action buttons */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-3 py-3 flex items-center gap-3">
          {/* Logo — original vibe */}
          <button
            onClick={resetSelection}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-lg glow-lime">
              <Zap className="w-5 h-5 text-white" strokeWidth={3} fill="white" />
            </div>
            <span className="brand text-lg sm:text-xl tracking-wide hidden sm:block">
              KIM KO'PROQ<span className="text-brand-yellow">...?</span>
            </span>
          </button>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Qidirish... yoki set URL'ni kiriting"
              value={selection.search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && onOpenSharedSet) {
                  const query = selection.search.trim();
                  if (!query) return;
                  // Try to extract setId from URL or raw string
                  // Supports: https://kim-koproq.vercel.app/?share=abc123
                  //           /?share=abc123
                  //           abc123 (raw setId)
                  let setId: string | null = null;
                  try {
                    // Check if it's a URL
                    if (query.startsWith("http") || query.startsWith("/")) {
                      const url = new URL(query.startsWith("/") ? `${window.location.origin}${query}` : query);
                      setId = url.searchParams.get("share");
                    }
                  } catch {
                    // Not a URL — try as raw setId (cuid format)
                    if (/^[a-z0-9]{20,30}$/i.test(query)) {
                      setId = query;
                    }
                  }
                  if (setId) {
                    onOpenSharedSet(setId);
                    setSearch("");
                  } else {
                    toast.error("URL yoki set ID noto'g'ri formatda");
                  }
                }
              }}
              className="pl-9 pr-3 h-10 bg-card border-border"
              disabled={page === "profile"}
            />
            {selection.search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-lime"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Universal action buttons — square */}
          <div className="flex items-center gap-1.5 shrink-0">
            {actionButtons.map((b) => (
              <Button
                key={b.key}
                type="button"
                size="icon"
                variant="ghost"
                disabled={b.disabled}
                onClick={b.onClick}
                title={b.label}
                className={`w-10 h-10 rounded-xl ${b.bg} ${b.active ? "ring-2 ring-ring" : ""}`}
              >
                {b.icon}
              </Button>
            ))}
          </div>
        </div>

        {/* Page title and user info */}
        <div className="max-w-5xl mx-auto px-3 pb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {page === "sets" && "📋 Savol setlari"}
            {page === "avatars" && "👥 Avatarlar / odamlar"}
            {page === "profile" && "👤 Profil"}
          </span>
          <span className="truncate max-w-[200px]">👤 {userName}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 py-4 pb-32 relative z-10">
        {selection.mode === "edit" && (
          <div className="mb-3 rounded-xl border border-brand-lime/40 bg-brand-lime/10 p-3 flex items-center justify-between">
            <span className="text-sm text-brand-lime">
              ✏️ Tahrirlash uchun elementni tanlang ({selection.selectedIds.length} tanlandi)
            </span>
            <Button variant="ghost" size="sm" onClick={resetSelection}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {selection.mode === "delete" && (
          <div className="mb-3 rounded-xl border border-brand-red/50 bg-brand-red/10 p-3 flex items-center justify-between">
            <span className="text-sm text-brand-red">
              🗑️ O'chirish uchun tanlang ({selection.selectedIds.length})
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("kk:confirm-delete", {
                      detail: { ids: selection.selectedIds },
                    })
                  );
                }}
                disabled={selection.selectedIds.length === 0}
              >
                <Trash2 className="w-4 h-4 mr-1" /> O'chirish
              </Button>
              <Button variant="ghost" size="sm" onClick={resetSelection}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {page === "sets" && (
          <SetsPage
            user={user}
            mode={selection.mode}
            selectedIds={selection.selectedIds}
            search={selection.search}
            onSelectionChange={(ids) =>
              setSelection((s) => ({ ...s, selectedIds: ids }))
            }
            onClearSelection={resetSelection}
          />
        )}
        {page === "avatars" && (
          <AvatarsPage
            user={user}
            mode={selection.mode}
            selectedIds={selection.selectedIds}
            search={selection.search}
            onSelectionChange={(ids) =>
              setSelection((s) => ({ ...s, selectedIds: ids }))
            }
            onClearSelection={resetSelection}
          />
        )}
        {page === "profile" && <ProfilePage user={user} onLogout={handleLogout} />}
      </main>

      {/* Bottom nav — square buttons */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border">
        <div className="max-w-5xl mx-auto px-2 py-2 flex items-center justify-around gap-2 pb-[env(safe-area-inset-bottom)]">
          {bottomNav.map((n) => (
            <button
              key={n.key}
              onClick={() => {
                setPage(n.key);
                resetSelection();
              }}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl transition-all active:scale-95 ${
                n.active
                  ? n.activeBg
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"
              }`}
            >
              <div className="w-7 h-7 flex items-center justify-center">
                {n.icon}
              </div>
              <span className="text-[10px] font-medium">{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
