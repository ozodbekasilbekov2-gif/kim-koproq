"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Camera,
  MessageSquare,
  LayoutGrid,
  Users,
  User,
  Zap,
  LogOut,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiJson } from "@/lib/api-client";
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
}: {
  user: KKUser;
  onLogout: () => void;
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
      // toggle off
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

  // For create: trigger create modal directly (no selection)
  // For edit/delete: enter selection mode

  // Universal action buttons — square shape, colored like the screenshot
  const actionButtons: {
    key: ActionMode | "search" | "create";
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
      icon: <Plus className="w-5 h-5" />,
      bg: "bg-brand-yellow text-black hover:bg-yellow-300",
      onClick: () => {
        // toggle create mode (creates immediately when item is created via +)
        if (page === "profile") return; // profile disables universal actions
        setMode("create");
        // if create mode is set, the page will show a create modal — handled in each page
      },
      disabled: page === "profile",
    },
    {
      key: "edit",
      label: "Tahrirlash",
      icon: <Pencil className="w-5 h-5" />,
      bg: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
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
      icon: <Trash2 className="w-5 h-5" />,
      bg: "bg-brand-red text-white hover:bg-red-600",
      onClick: () => {
        if (page === "profile") return;
        handleAction("delete");
      },
      disabled: page === "profile",
      active: selection.mode === "delete",
    },
  ];

  const bottomNav: {
    key: PageKey;
    label: string;
    icon: React.ReactNode;
    bg: string;
    active: boolean;
  }[] = [
    {
      key: "sets",
      label: "Setlar",
      icon: <LayoutGrid className="w-5 h-5" />,
      bg: "bg-brand-coral/30 text-brand-coral",
      active: page === "sets",
    },
    {
      key: "avatars",
      label: "Avatari",
      icon: <Users className="w-5 h-5" />,
      bg: "bg-chart-1/30 text-chart-1",
      active: page === "avatars",
    },
    {
      key: "profile",
      label: "Profil",
      icon: <User className="w-5 h-5" />,
      bg: "bg-muted text-muted-foreground",
      active: page === "profile",
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken: "" }),
      }).catch(() => {});
    } catch {}
    localStorage.removeItem("kk_session");
    localStorage.removeItem("kk_tg_token");
    onLogout();
    toast.success("Tizimdan chiqdingiz");
  };

  // Selection footer actions
  const confirmDelete = async (deleteFn: (ids: string[]) => Promise<void>) => {
    if (selection.selectedIds.length === 0) {
      toast.error("Avval element(lar) ni tanlang");
      return;
    }
    try {
      await deleteFn(selection.selectedIds);
      toast.success(`${selection.selectedIds.length} ta o'chirildi`);
      resetSelection();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar with logo + universal action buttons */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-3 py-3 flex items-center gap-3">
          {/* Logo */}
          <button
            onClick={resetSelection}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-lg shadow-primary/30">
              <Zap className="w-5 h-5 text-white" strokeWidth={3} />
            </div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight hidden sm:block">
              Kim ko'proq?
            </span>
          </button>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Qidirish..."
              value={selection.search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 h-10"
              disabled={page === "profile"}
            />
            {selection.search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                className={`w-10 h-10 rounded-xl ${b.bg} ${b.active ? "ring-2 ring-offset-2 ring-ring" : ""}`}
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
            {page === "avatars" && "👥 Aavatarlar / odamlar"}
            {page === "profile" && "👤 Profil"}
          </span>
          <span className="truncate max-w-[200px]">
            👤 {userName}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 py-4 pb-32">
        {selection.mode === "edit" && (
          <div className="mb-3 rounded-xl border border-secondary bg-secondary/30 p-3 flex items-center justify-between">
            <span className="text-sm">
              ✏️ Tahrirlash uchun elementni tanlang ({selection.selectedIds.length} tanlandi)
            </span>
            <Button variant="ghost" size="sm" onClick={resetSelection}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {selection.mode === "delete" && (
          <div className="mb-3 rounded-xl border border-destructive/50 bg-destructive/10 p-3 flex items-center justify-between">
            <span className="text-sm text-destructive">
              🗑️ O'chirish uchun tanlang ({selection.selectedIds.length})
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  // The current page receives a deleteAll event
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
                  ? `${n.bg} ring-2 ring-ring`
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
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
