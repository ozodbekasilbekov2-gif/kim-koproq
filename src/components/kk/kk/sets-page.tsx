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
} from "lucide-react";
import type { KKUser } from "@/app/page";
import type { ActionMode } from "./app-shell";

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
            Birinchi savol setingizni yarating yoki 2AF1 demo ma'lumotlarni yuklang
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-1 inline" /> Yaratish
          </button>
          <button onClick={() => loadDemoData(loadSets)} className="btn-ghost">
            ⚡ 2AF1 demo yuklash
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

  const save = async () => {
    if (title.trim().length < 2) {
      toast.error("Sarlavha 2+ belgi");
      return;
    }
    setSaving(true);
    try {
      const body = { title, description, emoji, mode: setMode, isPublic };
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
              <div className="text-xs text-muted-foreground">Hamma ko'ra oladi</div>
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
  const [view, setView] = useState<"questions" | "test" | "results">("questions");

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

      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setView("questions")}
          className={`px-4 py-2 text-sm font-medium transition ${
            view === "questions"
              ? "text-brand-lime border-b-2 border-brand-lime"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Savollar
        </button>
        <button
          onClick={() => setView("test")}
          className={`px-4 py-2 text-sm font-medium transition ${
            view === "test"
              ? "text-brand-lime border-b-2 border-brand-lime"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Test o'tash
        </button>
        <button
          onClick={() => setView("results")}
          className={`px-4 py-2 text-sm font-medium transition ${
            view === "results"
              ? "text-brand-lime border-b-2 border-brand-lime"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Natijalar
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
      {view === "results" && <ResultsView setId={setId} />}

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
        const av = await apiJson<{ avatars: any[] }>("/api/avatars");
        setAvatars(av.avatars);
        const gr = await apiJson<{ groups: any[] }>("/api/groups");
        setGroups(gr.groups);
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
  return (
    <button
      onClick={onClick}
      className={`member-card w-full p-2 flex flex-col items-center gap-1 ${selected ? "selected" : ""}`}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex items-center justify-center relative">
        {hasPhoto ? (
          <img src={avatar.photoUrl} alt={avatar.name} className="w-full h-full object-cover" />
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

function ResultsView({ setId }: { setId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("all");

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
                        className={`poll-opt ${isTop ? "top" : ""}`}
                      >
                        <div className="flex items-center gap-2">
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
                          <div className="text-xs text-muted-foreground shrink-0">
                            {votersArr.length} ovoz
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
    </div>
  );
}
