"use client";

import { useEffect, useState, useCallback } from "react";
import { apiJson } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Lock,
  Unlock,
  ChevronRight,
  Loader2,
  Sparkles,
  Plus,
  Pencil,
  Share2,
} from "lucide-react";
import type { KKUser } from "@/app/page";
import type { ActionMode } from "./app-shell";
import { SharedResultsView } from "@/components/kk/shared-results";

export type SetData = {
  id: string;
  title: string;
  description?: string | null;
  emoji: string;
  mode: string;
  isPublic: boolean;
  ownerId: string;
  owner?: { firstName?: string | null; lastName?: string | null; telegramName?: string | null };
  _count?: { questions: number };
  createdAt: string;
};

export function SetsPage({
  user,
  mode,
  selectedIds,
  search,
  onSelectionChange,
  onClearSelection,
}: {
  user: KKUser;
  mode: ActionMode;
  selectedIds: string[];
  search: string;
  onSelectionChange: (ids: string[]) => void;
  onClearSelection: () => void;
}) {
  const [sets, setSets] = useState<SetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openSetId, setOpenSetId] = useState<string | null>(null);

  const loadSets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ sets: SetData[] }>("/api/sets");
      setSets(data.sets);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  // Open create modal when mode is "create"
  useEffect(() => {
    if (mode === "create") {
      setShowCreate(true);
      onClearSelection();
    }
  }, [mode, onClearSelection]);

  // Listen for confirm-delete event
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { ids: string[] };
      if (!detail?.ids?.length) return;
      try {
        await Promise.all(detail.ids.map((id) => apiJson(`/api/sets/${id}`, { method: "DELETE" })));
        await loadSets();
        onClearSelection();
        toast.success(`${detail.ids.length} ta set o'chirildi`);
      } catch (err: any) {
        toast.error(err.message);
      }
    };
    window.addEventListener("kk:confirm-delete", handler);
    return () => window.removeEventListener("kk:confirm-delete", handler);
  }, [loadSets, onClearSelection]);

  const filtered = sets.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q);
  });

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-brand-lime" />
      </div>
    );
  }

  if (openSetId) {
    return (
      <SetDetailView
        setId={openSetId}
        user={user}
        onBack={() => setOpenSetId(null)}
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20 space-y-4 fade-in">
        <div className="inline-flex w-20 h-20 rounded-2xl bg-brand-gradient items-center justify-center glow-lime">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <div>
          <h3 className="brand text-2xl">SETLAR YO'Q</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Birinchi savol setingizni yarating — demo set avtomatik yaratiladi
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-1 inline" /> Yaratish
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((s, i) => {
          const isSelected = selectedIds.includes(s.id);
          const isOwner = s.ownerId === user.id;
          return (
            <div
              key={s.id}
              className={`q-card p-4 cursor-pointer transition-all hover:border-brand-lime/40 fade-in ${
                isSelected ? "ring-2 ring-brand-lime" : ""
              } ${mode === "delete" ? "border-brand-red/50" : ""}`}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              onClick={() => {
                if (mode === "edit") {
                  if (!isOwner) {
                    toast.error("Faqat o'zingiz yaratgan setni tahrirlay olasiz");
                    return;
                  }
                  setEditingId(s.id);
                  onClearSelection();
                } else if (mode === "delete") {
                  toggleSelect(s.id);
                } else {
                  setOpenSetId(s.id);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl shrink-0">{s.emoji}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{s.title}</h3>
                  {s.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {s.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="pill bg-white/5 text-muted-foreground border border-border">
                      📝 {s._count?.questions || 0} savol
                    </span>
                    <span
                      className={`pill ${
                        s.mode === "strict"
                          ? "bg-brand-red/15 text-brand-red border border-brand-red/30"
                          : "bg-brand-lime/15 text-brand-lime border border-brand-lime/30"
                      }`}
                    >
                      {s.mode === "strict" ? <Lock className="w-3 h-3 mr-1 inline" /> : <Unlock className="w-3 h-3 mr-1 inline" />}
                      {s.mode === "strict" ? "Strict" : "Loose"}
                    </span>
                    {!s.isPublic && (
                      <span className="pill bg-white/5 text-muted-foreground border border-border">
                        🔒 Shaxsiy
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-red text-white text-xs flex items-center justify-center">
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCreate && (
        <SetDialog
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={async () => {
            setShowCreate(false);
            await loadSets();
          }}
        />
      )}

      {editingId && (
        <SetDialog
          mode="edit"
          setId={editingId}
          initialData={sets.find((s) => s.id === editingId)}
          onClose={() => setEditingId(null)}
          onSaved={async () => {
            setEditingId(null);
            await loadSets();
          }}
        />
      )}
    </>
  );
}

async function loadDemoData(reload: () => Promise<void>) {
  try {
    toast.loading("Demo yuklanmoqda...", { id: "demo" });
    await apiJson("/api/seed", { method: "POST" });
    await reload();
    toast.success("Demo ma'lumotlar qo'shildi", { id: "demo" });
  } catch (e: any) {
    toast.error(e.message, { id: "demo" });
  }
}

function SetDialog({
  mode,
  setId,
  initialData,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  setId?: string;
  initialData?: SetData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [emoji, setEmoji] = useState(initialData?.emoji || "❓");
  const [setMode, setSetMode] = useState<"strict" | "loose">(
    (initialData?.mode as any) || "loose"
  );
  const [isPublic, setIsPublic] = useState(initialData?.isPublic ?? true);
  const [saving, setSaving] = useState(false);
  // Avatar groups for selection
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() => {
    try {
      const raw = (initialData as any)?.groupIds;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  // Load groups on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await apiJson<{ groups: any[] }>("/api/groups");
        setGroups(data.groups);
      } catch (e) {
        // ignore — groups will be empty
      }
    })();
  }, []);

  const toggleGroup = (gid: string) => {
    if (selectedGroupIds.includes(gid)) {
      setSelectedGroupIds(selectedGroupIds.filter((x) => x !== gid));
    } else {
      setSelectedGroupIds([...selectedGroupIds, gid]);
    }
  };

  const save = async () => {
    if (title.trim().length < 2) {
      toast.error("Sarlavha 2+ belgi");
      return;
    }
    setSaving(true);
    try {
      const body = { title, description, emoji, mode: setMode, isPublic, groupIds: selectedGroupIds };
      if (mode === "create") {
        await apiJson("/api/sets", { method: "POST", body: JSON.stringify(body) });
      } else if (setId) {
        await apiJson(`/api/sets/${setId}`, { method: "PUT", body: JSON.stringify(body) });
      }
      toast.success(mode === "create" ? "Yaratildi ✅" : "Saqlandi ✅");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Yangi set yaratish" : "Setni tahrirlash"}
          </DialogTitle>
          <DialogDescription>
            Savol to'plami — kim ko'proq so'rovlari uchun
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-3">
            <div className="space-y-2 w-20">
              <Label>Emoji</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={8}
                className="text-center text-2xl"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="title">Sarlavha</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Kim ko'proq...?"
                maxLength={120}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tavsif (ixtiyoriy)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu set kim haqida..."
              maxLength={500}
              rows={2}
            />
          </div>

          {/* Avatar groups selection */}
          <div className="space-y-2">
            <Label>Guruhlarni tanlang (avtarlar shu guruhlardan javob sifatida ko'rinadi)</Label>
            {groups.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 rounded-lg border border-dashed">
                Guruhlar topilmadi. "Avatari" bo'limida guruh yarating.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const selected = selectedGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={`pill transition-all ${
                        selected
                          ? "bg-brand-lime text-black border border-brand-lime"
                          : "bg-white/5 text-muted-foreground border border-border hover:border-brand-lime/40"
                      }`}
                    >
                      {selected ? "✓ " : ""}
                      {g.name} ({g._count?.avatars || 0})
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">
              {selectedGroupIds.length === 0
                ? "⚠️ Hech qaysi guruh tanlanmagan — barcha avatarlar ko'rinadi"
                : `${selectedGroupIds.length} ta guruh tanlandi`}
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {setMode === "strict" ? <Lock className="w-4 h-4 text-destructive" /> : <Unlock className="w-4 h-4 text-chart-1" />}
                  {setMode === "strict" ? "Strict rejim" : "Loose rejim"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {setMode === "strict"
                    ? "Faqat siz savol qo'sha/tahrirlay olasiz"
                    : "Har bir foydalanuvchi savolni o'zgartira oladi"}
                </div>
              </div>
              <Switch checked={setMode === "loose"} onCheckedChange={(c) => setSetMode(c ? "loose" : "strict")} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium text-sm">Ochiq (public)</div>
              <div className="text-xs text-muted-foreground">Hamma ko'ra oladi va ro'yxatdan o'tmasdan o'ta oladi</div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Bekor
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {mode === "create" ? "Yaratish" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Set detail view — show questions, edit them, take the test
function SetDetailView({
  setId,
  user,
  onBack,
}: {
  setId: string;
  user: KKUser;
  onBack: () => void;
}) {
  const [set, setSet] = useState<SetData | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddQ, setShowAddQ] = useState(false);
  const [editingQ, setEditingQ] = useState<any | null>(null);
  const [view, setView] = useState<"questions" | "test" | "results" | "people">("questions");
  const [showShare, setShowShare] = useState(false);
  const [showEditSet, setShowEditSet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Listen for "go to results" event from TestView's completion screen
  useEffect(() => {
    const handler = () => setView("results");
    window.addEventListener("kk:goto-results", handler);
    return () => window.removeEventListener("kk:goto-results", handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await apiJson<SetData>(`/api/sets/${setId}`);
      setSet(s);
      const q = await apiJson<{ questions: any[] }>(`/api/sets/${setId}/questions`);
      setQuestions(q.questions);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!set) {
    return <div>Set topilmadi</div>;
  }

  const isOwner = set.ownerId === user.id;
  const canEdit = isOwner || set.mode === "loose";

  const deleteSet = async () => {
    try {
      await apiJson(`/api/sets/${setId}`, { method: "DELETE" });
      toast.success("Set o'chirildi");
      onBack();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost text-sm">
          ← Orqaga
        </button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-3xl shrink-0">{set.emoji}</span>
          <div className="min-w-0">
            <h2 className="font-bold text-lg leading-tight truncate">{set.title}</h2>
            {set.description && (
              <p className="text-xs text-muted-foreground truncate">{set.description}</p>
            )}
          </div>
        </div>
        {/* Share button — visible if set is public */}
        {set.isPublic && (
          <button
            onClick={() => setShowShare(true)}
            className="btn-ghost text-xs flex items-center gap-1"
            title="Setni ulashish"
          >
            <Share2 className="w-4 h-4" /> Ulashish
          </button>
        )}
        {/* Edit button — only for owner */}
        {isOwner && (
          <button
            onClick={() => setShowEditSet(true)}
            className="btn-ghost text-xs flex items-center gap-1"
            title="Setni tahrirlash"
          >
            ✏️ Tahrirlash
          </button>
        )}
        {/* Delete button — only for owner */}
        {isOwner && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger text-xs flex items-center gap-1"
            title="Setni o'chirish"
          >
            🗑 O'chirish
          </button>
        )}
        <span
          className={`pill ${
            set.mode === "strict"
              ? "bg-brand-red/15 text-brand-red border border-brand-red/30"
              : "bg-brand-lime/15 text-brand-lime border border-brand-lime/30"
          }`}
        >
          {set.mode === "strict" ? <Lock className="w-3 h-3 mr-1 inline" /> : <Unlock className="w-3 h-3 mr-1 inline" />}
          {set.mode}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-border overflow-x-auto scrollbar-thin">
        <button
          onClick={() => setView("questions")}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
            view === "questions"
              ? "text-brand-lime border-b-2 border-brand-lime"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Savollar
        </button>
        <button
          onClick={() => setView("test")}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
            view === "test"
              ? "text-brand-lime border-b-2 border-brand-lime"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Test o'tash
        </button>
        <button
          onClick={() => setView("results")}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
            view === "results"
              ? "text-brand-lime border-b-2 border-brand-lime"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Natijalar
        </button>
        <button
          onClick={() => setView("people")}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
            view === "people"
              ? "text-brand-lime border-b-2 border-brand-lime"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          👤 Odamlar
        </button>
      </div>

      {view === "questions" && (
        <div className="space-y-2">
          {questions.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Hali savol yo'q. {canEdit ? "Birinchi savolni qo'shing" : "Egasi savol qo'shishini kuting"}
            </div>
          )}
          {questions.map((q, i) => (
            <div key={q.id} className="q-card p-3 flex items-center gap-3 fade-in" style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}>
              <span className="text-2xl w-9 text-center shrink-0">{q.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-snug">
                  {i + 1}. {q.text}
                </div>
                <span className={`pill cat-${String(q.category).split(" ")[0]} mt-1`}>
                  {q.category}
                </span>
              </div>
              {canEdit && (
                <button
                  onClick={() => setEditingQ(q)}
                  className="text-muted-foreground hover:text-brand-lime p-2 rounded-lg hover:bg-white/5"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <button onClick={() => setShowAddQ(true)} className="btn-primary w-full">
              <Plus className="w-4 h-4 mr-1 inline" /> Savol qo'shish
            </button>
          )}
        </div>
      )}

      {view === "test" && <TestView setId={setId} questions={questions} />}
      {view === "results" && <SharedResultsView setId={setId} />}
      {view === "people" && <SharedResultsView setId={setId} />}

      {showShare && (
        <ShareDialog setId={setId} title={set.title} onClose={() => setShowShare(false)} />
      )}

      {showAddQ && (
        <QuestionDialog
          setId={setId}
          onClose={() => setShowAddQ(false)}
          onSaved={async () => {
            setShowAddQ(false);
            await load();
          }}
        />
      )}
      {editingQ && (
        <QuestionDialog
          setId={setId}
          question={editingQ}
          onClose={() => setEditingQ(null)}
          onSaved={async () => {
            setEditingQ(null);
            await load();
          }}
        />
      )}

      {/* Edit set dialog */}
      {showEditSet && (
        <SetDialog
          mode="edit"
          setId={setId}
          initialData={set}
          onClose={() => setShowEditSet(false)}
          onSaved={async () => {
            setShowEditSet(false);
            await load();
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <Dialog open onOpenChange={(o) => !o && setShowDeleteConfirm(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🗑 Setni o'chirish</DialogTitle>
              <DialogDescription>
                "{set.title}" setini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi —
                barcha savollar, ovozlar va natijalar o'chiriladi.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Bekor qilish
              </Button>
              <Button variant="destructive" onClick={deleteSet}>
                🗑 Ha, o'chirish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function QuestionDialog({
  setId,
  question,
  onClose,
  onSaved,
}: {
  setId: string;
  question?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [emoji, setEmoji] = useState(question?.emoji || "❓");
  const [text, setText] = useState(question?.text || "");
  const [category, setCategory] = useState(question?.category || "Xaos");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (text.trim().length < 5) {
      toast.error("Savol 5+ belgi bo'lsin");
      return;
    }
    setSaving(true);
    try {
      const body = { text, emoji, category };
      if (question) {
        await apiJson(`/api/questions/${question.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiJson(`/api/sets/${setId}/questions`, { method: "POST", body: JSON.stringify(body) });
      }
      toast.success("Saqlandi ✅");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!question) return;
    if (!confirm("O'chirilsinmi?")) return;
    setSaving(true);
    try {
      await apiJson(`/api/questions/${question.id}`, { method: "DELETE" });
      toast.success("O'chirildi");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{question ? "Savolni tahrirlash" : "Yangi savol"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-3">
            <div className="space-y-2 w-20">
              <Label>Emoji</Label>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={8}
                className="text-center text-2xl"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Kategoriya</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Xaos / Roast / Rostini ayt / Kelajak"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Savol matni</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Kim ko'proq ...?"
              rows={3}
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          {question && (
            <Button variant="destructive" onClick={del} disabled={saving}>
              O'chirish
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Bekor
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Take the test
function TestView({ setId, questions }: { setId: string; questions: any[] }) {
  const [avatars, setAvatars] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Load the set first to get groupIds
        const setData = await apiJson<any>(`/api/sets/${setId}`);
        let setGroupIds: string[] = [];
        try {
          const raw = (setData as any).groupIds;
          if (raw) {
            setGroupIds = Array.isArray(raw) ? raw : JSON.parse(raw);
          }
        } catch {}

        // Load all avatars and groups
        const av = await apiJson<{ avatars: any[] }>("/api/avatars");
        const gr = await apiJson<{ groups: any[] }>("/api/groups");

        // Filter avatars: if the set has groupIds, only show avatars in those groups.
        // Otherwise (no groups selected), show all avatars.
        let filteredAvatars = av.avatars;
        let filteredGroups = gr.groups;
        if (setGroupIds.length > 0) {
          filteredAvatars = av.avatars.filter((a: any) =>
            setGroupIds.includes(a.groupId)
          );
          filteredGroups = gr.groups.filter((g: any) =>
            setGroupIds.includes(g.id)
          );
        }
        setAvatars(filteredAvatars);
        setGroups(filteredGroups);

        const pr = await apiJson<{ answers: Record<string, Record<string, string>> }>(
          `/api/vote?setId=${setId}`
        );
        setAnswers(pr.answers || {});
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [setId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Avval "Avatari" bo'limida odamlar qo'shing.
      </div>
    );
  }

  if (done || idx >= questions.length) {
    return (
      <div className="text-center py-12 space-y-4 fade-in">
        <div className="text-7xl animate-bounce">🎉</div>
        <h3 className="brand text-4xl text-brand-lime">RAHMAT!</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Hammasiga javob berding. Endi natijalar — kim nima bo'ldi? 👀
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <button
            onClick={() => {
              const event = new CustomEvent("kk:goto-results");
              window.dispatchEvent(event);
            }}
            className="btn-primary"
          >
            📊 Natijalarni ko'rish
          </button>
          <button
            onClick={() => { setDone(false); setIdx(0); }}
            className="btn-ghost"
          >
            ✏️ Javoblarni o'zgartirish
          </button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const cur = answers[q.id] || {};

  const pick = async (groupId: string, avatarId: string | null) => {
    const newAnswers = { ...answers, [q.id]: { ...cur, [groupId]: avatarId } };
    setAnswers(newAnswers);
    try {
      await apiJson("/api/vote", {
        method: "POST",
        body: JSON.stringify({
          setId,
          questionId: q.id,
          targets: { [groupId]: avatarId },
        }),
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const next = () => {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else setDone(true);
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">{idx + 1} / {questions.length}</span>
        <div className="flex-1 mx-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-lime transition-all glow-lime"
            style={{ width: `${(idx / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="q-card p-6 text-center space-y-3">
        <div className="text-5xl">{q.emoji}</div>
        <span className={`pill cat-${String(q.category).split(" ")[0]}`}>{q.category}</span>
        <h3 className="font-semibold text-lg leading-tight max-w-md mx-auto">{q.text}</h3>
      </div>

      {groups.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Guruhlar yo'q — barcha avatarlar bitta ro'yxatda
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {avatars.map((a) => (
              <AvatarTile
                key={a.id}
                avatar={a}
                selected={cur["default"] === a.id}
                onClick={() => pick("default", a.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const ga = avatars.filter((a) => a.groupId === g.id);
            if (ga.length === 0) return null;
            return (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`gtag gtag-${g.color || "A"}`}>{g.name || g.color} GURUH</span>
                  <span className="text-[10px] text-muted-foreground">majburiy</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ga.map((a) => (
                    <AvatarTile
                      key={a.id}
                      avatar={a}
                      selected={cur[g.color || g.id] === a.id}
                      onClick={() => pick(g.color || g.id, a.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-20 flex items-center justify-between gap-2 pt-2 z-10">
        <button
          onClick={() => setIdx(idx - 1)}
          disabled={idx === 0}
          className="btn-ghost disabled:opacity-30"
        >
          ← Oldingi
        </button>
        <button onClick={next} className="btn-primary">
          {idx === questions.length - 1 ? "Tugatish 🏁" : "Keyingi →"}
        </button>
      </div>
    </div>
  );
}

function AvatarTile({
  avatar,
  selected,
  onClick,
}: {
  avatar: any;
  selected: boolean;
  onClick: () => void;
}) {
  // Original Kim Ko'proq vibe: member card with photo or MAFIA badge for those without photo
  const hasPhoto = !!avatar.photoUrl;
  const hasIcon = !!avatar.iconName;
  return (
    <button
      onClick={onClick}
      className={`member-card w-full p-2 flex flex-col items-center gap-1 ${selected ? "selected" : ""}`}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex items-center justify-center relative">
        {hasPhoto ? (
          <img src={avatar.photoUrl} alt={avatar.name} className="w-full h-full object-cover" />
        ) : hasIcon ? (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <IconFallback iconName={avatar.iconName} className="w-6 h-6 text-muted-foreground" />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xl font-bold text-muted-foreground">
            {avatar.name?.[0] || "?"}
          </div>
        )}
        {!hasPhoto && (
          <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] text-center text-yellow-400 font-bold tracking-wider py-0.5">
            🕵️ MAFIA
          </span>
        )}
      </div>
      <div className="text-[10px] font-medium text-center truncate max-w-full">
        {avatar.shortName || avatar.name}
      </div>
      {selected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand-lime text-black text-xs flex items-center justify-center font-bold">
          ✓
        </div>
      )}
    </button>
  );
}

// Icon fallback: maps iconName to Lucide icon
function IconFallback({ iconName, className }: { iconName: string; className?: string }) {
  // Map common professional icon names to Lucide icons
  const iconMap: Record<string, string> = {
    "user": "👤",
    "user-tie": "👔",
    "user-graduate": "🎓",
    "user-nurse": "⚕️",
    "user-cog": "⚙️",
    "user-astronaut": "🚀",
    "user-check": "✓",
    "user-secret": "🕵️",
    "palette": "🎨",
    "wrench": "🔧",
    "camera": "📷",
  };
  const emoji = iconMap[iconName] || "👤";
  return <span className={className}>{emoji}</span>;
}

function ResultsView({ setId }: { setId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("all");
  // Modal: when set, shows a detail dialog for a specific question + group
  // with ALL voter avatars and their percentages (no truncation)
  const [detail, setDetail] = useState<{ q: any; g: string; targetId: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiJson<any>(`/api/results?setId=${setId}`);
        setData(r);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [setId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-lime" />
      </div>
    );
  }

  if (!data) return null;

  const cats = [...new Set(data.questions.map((q: any) => q.category))] as string[];
  const catClass = (c: string) => "cat-" + String(c).split(" ")[0];

  // Helper: get avatar image URL (photo or icon-based placeholder)
  const avatarImg = (a: any) => {
    if (a?.photoUrl) return a.photoUrl;
    return null;
  };
  const avatarInitial = (a: any) => (a?.shortName || a?.name || "?")[0];

  // Helper: get voter display info (name + photo) from voterInfo map.
  // Falls back to "?" if voter is unknown.
  const voterImg = (voterId: string): string | null => {
    const info = data.voterInfo?.[voterId];
    return info?.photo || null;
  };
  const voterName = (voterId: string): string => {
    const info = data.voterInfo?.[voterId];
    return info?.name || "?";
  };
  const voterInitial = (voterId: string): string => {
    const name = voterName(voterId);
    return name[0] || "?";
  };

  function renderQuestions(c: string) {
    const qs = data.questions.filter((q: any) => c === "all" || q.category === c);
    return qs.map((q: any, i: number) => {
      const qResults = data.results[q.id] || {};
      return (
        <div
          key={q.id}
          className="q-card p-4 fade-in"
          style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{q.emoji}</span>
            <span className={`pill ${catClass(q.category)}`}>{q.category}</span>
          </div>
          <h4 className="font-semibold text-base mb-3 leading-tight">{q.text}</h4>
          <div className="space-y-3">
            {Object.entries(qResults).map(([g, byTarget]: [string, any]) => {
              const total = Object.values(byTarget).reduce(
                (s: number, v: any) => s + v.length,
                0
              );
              const max = Math.max(0, ...Object.values(byTarget).map((v: any) => v.length));
              const sorted = Object.entries(byTarget).sort(
                (a, b) => (b[1] as any[]).length - (a[1] as any[]).length
              );
              return (
                <div key={g} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`gtag gtag-${g}`}>{g} GURUH</span>
                    <span className="text-muted-foreground">{total} ovoz</span>
                  </div>
                  {sorted.map(([targetId, voters]: [string, any]) => {
                    const votersArr = voters as any[];
                    const av = data.avatars.find((a: any) => a.id === targetId);
                    const pct = total ? Math.round((votersArr.length / total) * 100) : 0;
                    const isTop = votersArr.length === max && votersArr.length > 0;
                    return (
                      <div
                        key={targetId}
                        className={`poll-opt ${isTop ? "top" : ""} cursor-pointer hover:bg-white/5`}
                        onClick={() => setDetail({ q, g, targetId })}
                      >
                        <div className="flex items-center gap-2">
                          {/* Target avatar (who was voted for) */}
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                            {avatarImg(av) ? (
                              <img src={avatarImg(av)} alt={av?.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-muted-foreground">
                                {avatarInitial(av)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium truncate">
                                {av?.shortName || av?.name || "?"}
                              </span>
                              <span className={`font-bold ${isTop ? "text-brand-lime" : "text-muted-foreground"}`}>
                                {pct}%
                              </span>
                            </div>
                            <div className="mt-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${isTop ? "bg-brand-lime" : "bg-brand-yellow/60"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          {/* Voter stack — small avatars of ALL who voted (no limit) */}
                          {votersArr.length > 0 && (
                            <div className="flex items-center gap-1 shrink-0 max-w-[120px]">
                              <div className="flex flex-wrap">
                                {votersArr.map((voterId: string, i: number) => (
                                  <div
                                    key={voterId + i}
                                    className="w-5 h-5 rounded-full overflow-hidden border border-background bg-secondary flex items-center justify-center"
                                    style={{ marginLeft: i === 0 ? 0 : -6 }}
                                    title={voterName(voterId)}
                                  >
                                    {voterImg(voterId) ? (
                                      <img src={voterImg(voterId)!} alt={voterName(voterId)} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-[8px] font-bold text-muted-foreground">
                                        {voterInitial(voterId)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground shrink-0">
                            {votersArr.length}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {total === 0 && (
                    <div className="text-xs text-muted-foreground/50 py-2 text-center">
                      Hali ovoz yo'q
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }

  function renderPeople() {
    // Build wins + mentions per avatar
    const wins: Record<string, any[]> = {};
    const mentions: Record<string, number> = {};
    for (const q of data.questions) {
      for (const g of Object.keys(data.results[q.id] || {})) {
        const byTarget = data.results[q.id][g] || {};
        let best: string | null = null;
        let bn = 0;
        for (const [t, vs] of Object.entries(byTarget)) {
          mentions[t] = (mentions[t] || 0) + (vs as any[]).length;
          if ((vs as any[]).length > bn) {
            bn = (vs as any[]).length;
            best = t;
          }
        }
        if (best && bn > 0) {
          (wins[best] ||= []).push({ q, n: bn });
        }
      }
    }
    const sorted = [...data.avatars].sort(
      (a, b) =>
        (wins[b.id]?.length || 0) - (wins[a.id]?.length || 0) ||
        (mentions[b.id] || 0) - (mentions[a.id] || 0)
    );
    return sorted.map((av: any, i: number) => (
      <div
        key={av.id}
        className="q-card p-4 fade-in"
        style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary flex items-center justify-center shrink-0">
            {avatarImg(av) ? (
              <img src={avatarImg(av)} alt={av.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">
                {avatarInitial(av)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold flex items-center gap-2">
              <span className="truncate">{av.name}</span>
              {av.group && (
                <span className={`gtag gtag-${av.group.color}`}>
                  {av.group.color}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              🏆 {(wins[av.id] || []).length} g'alaba · 👥 {mentions[av.id] || 0} ovoz
            </div>
          </div>
        </div>
        {(wins[av.id] || []).length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {wins[av.id].map((w, j) => (
              <li key={j} className="flex gap-2 items-start">
                <span>{w.q.emoji}</span>
                <span className="text-muted-foreground flex-1">{w.q.text}</span>
                <span className="text-brand-lime font-bold">{w.n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    ));
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="brand text-4xl leading-none">
          NATIJALAR <span className="text-brand-yellow">🏆</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-2">
          👥 {data.voters}/{data.totalMembers} ovoz berdi · ✅ {data.completed} tugatdi
        </p>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => setCat("all")}
          className={`pill ${cat === "all" ? "bg-brand-lime text-black" : "bg-white/5 text-muted-foreground border border-border"}`}
        >
          Barchasi
        </button>
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`pill ${cat === c ? catClass(c) + " ring-2 ring-ring" : "bg-white/5 text-muted-foreground border border-border"}`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => setCat("__people")}
          className={`pill ${cat === "__people" ? "bg-brand-coral/20 text-brand-coral border border-brand-coral/40 ring-2 ring-ring" : "bg-white/5 text-muted-foreground border border-border"}`}
        >
          👤 Odamlar
        </button>
      </div>

      <div className="space-y-3">
        {cat === "__people" ? renderPeople() : renderQuestions(cat)}
      </div>

      {/* Detail modal: shows all voters for a specific target avatar */}
      {detail && data && (
        <VoterDetailModal
          q={detail.q}
          g={detail.g}
          targetId={detail.targetId}
          data={data}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ---------- Voter detail modal ----------
// Shows ALL voters for a specific question + group + target avatar.
// No truncation — every voter's avatar + name is shown in a grid.
function VoterDetailModal({
  q,
  g,
  targetId,
  data,
  onClose,
}: {
  q: any;
  g: string;
  targetId: string;
  data: any;
  onClose: () => void;
}) {
  const qResults = data.results[q.id] || {};
  const byTarget = qResults[g] || {};
  const votersArr = (byTarget[targetId] || []) as string[];
  const total = Object.values(byTarget).reduce(
    (s: number, v: any) => s + v.length,
    0
  );
  const pct = total ? Math.round((votersArr.length / total) * 100) : 0;
  const targetAv = data.avatars.find((a: any) => a.id === targetId);
  const hasPhoto = !!targetAv?.photoUrl;

  // Helper functions (same as in ResultsView, duplicated for this component)
  const voterImg = (voterId: string): string | null => {
    const info = data.voterInfo?.[voterId];
    return info?.photo || null;
  };
  const voterName = (voterId: string): string => {
    const info = data.voterInfo?.[voterId];
    return info?.name || "Foydalanuvchi";
  };
  const voterInitial = (voterId: string): string => {
    return voterName(voterId)[0] || "?";
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{q.emoji}</span>
            <span className={`gtag gtag-${g}`}>{g} GURUH</span>
          </DialogTitle>
          <DialogDescription className="text-sm leading-snug pt-1">
            {q.text}
          </DialogDescription>
        </DialogHeader>

        {/* Target avatar summary */}
        <div className="q-card p-4 flex items-center gap-3 my-2">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary flex items-center justify-center shrink-0">
            {hasPhoto ? (
              <img src={targetAv.photoUrl} alt={targetAv.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-2xl font-bold text-muted-foreground">
                {targetAv?.name?.[0] || "?"}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="font-bold text-base">{targetAv?.name || "?"}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              📊 {pct}% · 👥 {votersArr.length} ovoz
            </div>
            <div className="mt-1.5 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-lime"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* All voters grid (no limit) */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Ovoz berganlar ({votersArr.length}):
          </div>
          {votersArr.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              Hali ovoz yo'q
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {votersArr.map((voterId: string, i: number) => (
                <div
                  key={voterId + i}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/3 border border-border hover:border-brand-lime/30 transition"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
                    {voterImg(voterId) ? (
                      <img
                        src={voterImg(voterId)!}
                        alt={voterName(voterId)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">
                        {voterInitial(voterId)}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-center font-medium truncate w-full">
                    {voterName(voterId)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Yopish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Share dialog ----------
function ShareDialog({
  setId,
  title,
  onClose,
}: {
  setId: string;
  title: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // Use window.location.origin if available (works for any deployment),
  // fallback to NEXT_PUBLIC_MINI_APP_URL env var, or hardcoded vercel URL.
  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_MINI_APP_URL || "https://kim-koproq.vercel.app";
  const shareUrl = `${baseUrl}/?share=${setId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Havola nusxalandi!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nusxalash amalga oshmadi");
    }
  };

  const shareToTelegram = () => {
    const text = `Kim ko'proq...? — ${title}\nSo'rovnomada qatnashing:`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setni ulashish 🔗</DialogTitle>
          <DialogDescription>
            Bu havola orqali har kim (ro'yxatdan o'tmasdan) so'rovnomada qatnasha oladi
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground mb-1">Havola:</div>
            <div className="text-sm font-mono break-all text-brand-lime">{shareUrl}</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={copy} className="btn-primary flex-1">
              {copied ? "✓ Nusxalandi" : "📋 Nusxalash"}
            </Button>
            <Button onClick={shareToTelegram} className="btn-ghost flex-1">
              📲 Telegram
            </Button>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            ⚠️ Set "Ochiq" (public) bo'lishi kerak — boshqalar kirib o'ta oladi
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Yopish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- People view (separate from Results) ----------
// Shows each avatar with: how many times they were chosen, in which questions,
// and how many "wins" (top votes) they have. Matches the original 2AF1 style.
function PeopleView({ setId }: { setId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiJson<any>(`/api/results?setId=${setId}`);
        setData(r);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [setId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-lime" />
      </div>
    );
  }

  if (!data) return null;

  // Build wins + mentions per avatar
  const wins: Record<string, Array<{ q: any; n: number; group: string }>> = {};
  const mentions: Record<string, number> = {};
  for (const q of data.questions) {
    for (const g of Object.keys(data.results[q.id] || {})) {
      const byTarget = data.results[q.id][g] || {};
      let best: string | null = null;
      let bn = 0;
      for (const [t, vs] of Object.entries(byTarget)) {
        const voters = vs as any[];
        mentions[t] = (mentions[t] || 0) + voters.length;
        if (voters.length > bn) {
          bn = voters.length;
          best = t;
        }
      }
      if (best && bn > 0) {
        (wins[best] ||= []).push({ q, n: bn, group: g });
      }
    }
  }

  // Sort: most wins first, then most mentions
  const sorted = [...data.avatars].sort(
    (a, b) =>
      (wins[b.id]?.length || 0) - (wins[a.id]?.length || 0) ||
      (mentions[b.id] || 0) - (mentions[a.id] || 0)
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="brand text-4xl leading-none">
          ODAMLAR <span className="text-brand-coral">👤</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-2">
          Har bir avatar necha marta tanlangan va qaysi savolda g'alaba qozongan
        </p>
      </div>

      <div className="space-y-3">
        {sorted.map((av: any, i: number) => {
          const avatarWins = wins[av.id] || [];
          const mentionCount = mentions[av.id] || 0;
          const hasPhoto = !!av.photoUrl;
          return (
            <div
              key={av.id}
              className="q-card p-4 fade-in"
              style={{ animationDelay: `${Math.min(i * 30, 400)}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                  {hasPhoto ? (
                    <img src={av.photoUrl} alt={av.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xl font-bold text-muted-foreground">
                      {av.name?.[0] || "?"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold flex items-center gap-2 flex-wrap">
                    <span className="truncate">{av.name}</span>
                    {av.group && (
                      <span className={`gtag gtag-${av.group.color}`}>
                        {av.group.color}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    🏆 {avatarWins.length} g'alaba · 👥 {mentionCount} ovoz
                  </div>
                </div>
              </div>
              {avatarWins.length > 0 ? (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {avatarWins.map((w, j) => (
                    <li key={j} className="flex gap-2 items-start">
                      <span className="text-lg shrink-0">{w.q.emoji}</span>
                      <span className="text-muted-foreground flex-1">{w.q.text}</span>
                      <span className="text-brand-lime font-bold shrink-0">{w.n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 text-xs text-muted-foreground/50 italic">
                  Hali hech qaysi savolda birinchi emas 🙃
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
