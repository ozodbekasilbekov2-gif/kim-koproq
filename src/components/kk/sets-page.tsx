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
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
      <div className="text-center py-20 space-y-4">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-brand-gradient items-center justify-center">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Setlar yo'q</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Birinchi savol setingizni yarating yoki demo ma'lumot qo'shing
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Yaratish
          </Button>
          <Button variant="outline" onClick={() => loadDemoData(loadSets)}>
            Demo yuklash
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((s) => {
          const isSelected = selectedIds.includes(s.id);
          const isOwner = s.ownerId === user.id;
          return (
            <Card
              key={s.id}
              className={`relative p-4 cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "ring-2 ring-ring" : ""
              } ${mode === "delete" ? "border-destructive/50" : ""}`}
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
                    <Badge variant="secondary" className="text-[10px]">
                      {s._count?.questions || 0} savol
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        s.mode === "strict" ? "border-destructive/40 text-destructive" : "border-chart-1/40 text-chart-1"
                      }`}
                    >
                      {s.mode === "strict" ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                      {s.mode === "strict" ? "Strict" : "Loose"}
                    </Badge>
                    {!s.isPublic && (
                      <Badge variant="outline" className="text-[10px]">
                        Shaxsiy
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center">
                  ✓
                </div>
              )}
            </Card>
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Orqaga
        </Button>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-2xl">{set.emoji}</span>
          <div>
            <h2 className="font-bold text-lg leading-tight">{set.title}</h2>
            {set.description && (
              <p className="text-xs text-muted-foreground">{set.description}</p>
            )}
          </div>
        </div>
        <Badge variant={set.mode === "strict" ? "outline" : "secondary"} className="text-[10px]">
          {set.mode === "strict" ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
          {set.mode}
        </Badge>
      </div>

      <div className="flex items-center gap-2 border-b">
        <Button variant={view === "questions" ? "default" : "ghost"} size="sm" onClick={() => setView("questions")}>
          Savollar
        </Button>
        <Button variant={view === "test" ? "default" : "ghost"} size="sm" onClick={() => setView("test")}>
          Test o'tash
        </Button>
        <Button variant={view === "results" ? "default" : "ghost"} size="sm" onClick={() => setView("results")}>
          Natijalar
        </Button>
      </div>

      {view === "questions" && (
        <div className="space-y-2">
          {questions.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              H savol yo'q. {canEdit ? "Birinchi savolni qo'shing" : "Egasi savol qo'shishini kuting"}
            </div>
          )}
          {questions.map((q, i) => (
            <Card key={q.id} className="p-3 flex items-center gap-3">
              <span className="text-2xl w-9 text-center">{q.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-snug">
                  {i + 1}. {q.text}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {q.category}
                </div>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => setEditingQ(q)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </Card>
          ))}
          {canEdit && (
            <Button className="w-full" onClick={() => setShowAddQ(true)}>
              <Plus className="w-4 h-4 mr-1" /> Savol qo'shish
            </Button>
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
      <div className="text-center py-12 space-y-3">
        <div className="text-5xl">🎉</div>
        <h3 className="font-bold text-xl">Tugatdingiz!</h3>
        <p className="text-sm text-muted-foreground">
          Javoblaringiz saqlandi. Endi natijalarni ko'ring.
        </p>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{idx + 1} / {questions.length}</span>
        <div className="flex-1 mx-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(idx / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="p-6 text-center space-y-2">
        <div className="text-4xl">{q.emoji}</div>
        <Badge variant="secondary" className="text-[10px]">{q.category}</Badge>
        <h3 className="font-semibold text-lg leading-tight">{q.text}</h3>
      </Card>

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
                  <Badge variant="outline">{g.name || g.color}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    majburiy
                  </span>
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

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          ← Oldingi
        </Button>
        <Button onClick={next}>
          {idx === questions.length - 1 ? "Tugatish 🏁" : "Keyingi →"}
        </Button>
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
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
        selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
      }`}
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
        {avatar.photoUrl ? (
          <img src={avatar.photoUrl} alt={avatar.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center text-xl">
            {avatar.name?.[0] || "?"}
          </div>
        )}
      </div>
      <div className="text-[10px] font-medium text-center truncate max-w-full">
        {avatar.shortName || avatar.name}
      </div>
      {selected && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
          ✓
        </div>
      )}
    </button>
  );
}

function ResultsView({ setId }: { setId: string }) {
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
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="text-center text-sm text-muted-foreground">
        👥 {data.voters}/{data.totalMembers} ovoz berdi · ✅ {data.completed} tugatdi
      </div>
      {data.questions.map((q: any) => {
        const qResults = data.results[q.id] || {};
        return (
          <Card key={q.id} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{q.emoji}</span>
              <h4 className="font-semibold text-sm flex-1">{q.text}</h4>
            </div>
            <div className="space-y-2">
              {Object.entries(qResults).map(([g, byTarget]: [string, any]) => {
                const total = Object.values(byTarget).reduce(
                  (s: number, v: any) => s + v.length,
                  0
                );
                return (
                  <div key={g} className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase">{g} · {total} ovoz</div>
                    {Object.entries(byTarget)
                      .sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length)
                      .map(([targetId, voters]) => {
                        const av = data.avatars.find((a: any) => a.id === targetId);
                        const pct = total ? Math.round(((voters as any[]).length / total) * 100) : 0;
                        return (
                          <div key={targetId} className="flex items-center gap-2 text-xs">
                            <div className="w-20 truncate">{av?.shortName || av?.name || "?"}</div>
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="w-10 text-right">{(voters as any[]).length}</div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
