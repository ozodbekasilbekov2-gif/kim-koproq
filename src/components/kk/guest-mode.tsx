"use client";

import { useEffect, useState, useCallback } from "react";
import { apiJson } from "@/lib/api-client";
import { toast } from "sonner";
import { Zap, ArrowLeft, Lock, Unlock } from "lucide-react";
import { Loader2 } from "lucide-react";

type GuestSet = {
  id: string;
  title: string;
  description?: string | null;
  emoji: string;
  mode: string;
  isPublic: boolean;
  groupIds?: string | null;
};

type GuestQuestion = {
  id: string;
  text: string;
  emoji: string;
  category: string;
};

type GuestAvatar = {
  id: string;
  name: string;
  shortName?: string | null;
  photoUrl?: string | null;
  iconName?: string | null;
  groupId?: string | null;
  group?: { id: string; name: string; color: string } | null;
};

type GuestGroup = {
  id: string;
  name: string;
  color: string;
  _count?: { avatars: number };
};

/**
 * Guest mode — opens a shared public set without registration.
 *
 * Mirrors the original 2AF1 interface (commit 9456ada) 1:1:
 * 1. "SEN KIMSAN?" — pick which avatar you are
 * 2. Question flow with group grids (your group mandatory, other optional)
 * 3. Results viewable by everyone (public)
 * 4. Odamlar viewable by everyone
 */
export function GuestMode({
  setId,
  onExit,
}: {
  setId: string;
  onExit: () => void;
}) {
  const [set, setSet] = useState<GuestSet | null>(null);
  const [questions, setQuestions] = useState<GuestQuestion[]>([]);
  const [avatars, setAvatars] = useState<GuestAvatar[]>([]);
  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [view, setView] = useState<"questions" | "test" | "results" | "people">("questions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Selected avatar ("who am I?") — stored in localStorage per set
  const [me, setMe] = useState<string | null>(null);
  const [meJustSelected, setMeJustSelected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await apiJson<GuestSet>(`/api/sets/${setId}`);
      setSet(s);

      const q = await apiJson<{ questions: GuestQuestion[] }>(`/api/sets/${setId}/questions`);
      setQuestions(q.questions);

      // Determine which avatar groups this set uses
      let setGroupIds: string[] = [];
      try {
        const raw = (s as any).groupIds;
        if (raw) {
          setGroupIds = Array.isArray(raw) ? raw : JSON.parse(raw);
        }
      } catch {}

      const av = await apiJson<{ avatars: GuestAvatar[] }>("/api/avatars");
      const gr = await apiJson<{ groups: GuestGroup[] }>("/api/groups");

      let filteredAvatars = av.avatars;
      let filteredGroups = gr.groups;
      if (setGroupIds.length > 0) {
        filteredAvatars = av.avatars.filter((a) =>
          setGroupIds.includes(a.groupId || "")
        );
        filteredGroups = gr.groups.filter((g) =>
          setGroupIds.includes(g.id)
        );
      }
      setAvatars(filteredAvatars);
      setGroups(filteredGroups);

      // Load guest answers from localStorage
      try {
        const key = `kk_guest_answers_${setId}`;
        const raw = localStorage.getItem(key);
        if (raw) setAnswers(JSON.parse(raw));
      } catch {}

      // Load selected avatar from localStorage
      try {
        const meKey = `kk_guest_me_${setId}`;
        const savedMe = localStorage.getItem(meKey);
        if (savedMe) setMe(savedMe);
      } catch {}
    } catch (e: any) {
      console.error("[guest] load failed:", e);
      setError(e.message || "Set topilmadi yoki uni ko'rishga ruxsat yo'q");
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickMe = (avatarId: string) => {
    setMe(avatarId);
    setMeJustSelected(true);
    try {
      localStorage.setItem(`kk_guest_me_${setId}`, avatarId);
    } catch {}
  };

  const pick = (questionId: string, groupId: string, avatarId: string | null) => {
    setAnswers((prev) => {
      const cur = prev[questionId] || {};
      const next: Record<string, Record<string, string>> = {
        ...prev,
        [questionId]: { ...cur, [groupId]: avatarId || "" },
      };
      try {
        localStorage.setItem(`kk_guest_answers_${setId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <div className="bg-glow" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-24 h-24 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-2xl glow-lime animate-pulse">
            <Zap className="w-12 h-12 text-white" strokeWidth={3} fill="white" />
          </div>
          <div className="text-sm text-muted-foreground">Yuklanmoqda...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="bg-glow" />
        <div className="text-center space-y-4 relative z-10">
          <div className="text-6xl">😕</div>
          <h2 className="text-xl font-bold">Set topilmadi</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={onExit} className="btn-primary">
            Bosh sahifaga qaytish
          </button>
        </div>
      </div>
    );
  }

  if (!set) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      <div className="bg-glow" />
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-3 py-3 flex items-center gap-3">
          <button onClick={onExit} className="btn-ghost text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Bosh sahifa
          </button>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0">{set.emoji}</span>
            <div className="min-w-0">
              <h1 className="font-bold text-base leading-tight truncate">{set.title}</h1>
              <p className="text-[10px] text-brand-lime">👤 Mehmon rejimida (ro'yxatdan o'tmasdan)</p>
            </div>
          </div>
          <span className={`pill ${set.mode === "strict" ? "bg-brand-red/15 text-brand-red border border-brand-red/30" : "bg-brand-lime/15 text-brand-lime border border-brand-lime/30"}`}>
            {set.mode === "strict" ? <Lock className="w-3 h-3 mr-1 inline" /> : <Unlock className="w-3 h-3 mr-1 inline" />}
            {set.mode}
          </span>
        </div>
        <div className="max-w-5xl mx-auto px-3 pb-2 flex items-center gap-2 border-t border-border/50 overflow-x-auto scrollbar-thin">
          {(["questions", "test", "results", "people"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                view === v
                  ? "text-brand-lime border-b-2 border-brand-lime"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "questions" && "Savollar"}
              {v === "test" && "Test o'tash"}
              {v === "results" && "Natijalar"}
              {v === "people" && "👤 Odamlar"}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-3 py-4 pb-32 relative z-10">
        {view === "questions" && (
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="q-card p-3 flex items-center gap-3 fade-in" style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}>
                <span className="text-2xl w-9 text-center shrink-0">{q.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-snug">{i + 1}. {q.text}</div>
                  <span className={`pill cat-${String(q.category).split(" ")[0]} mt-1`}>{q.category}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "test" && (
          <GuestTestFlow
            setId={setId}
            questions={questions}
            avatars={avatars}
            groups={groups}
            answers={answers}
            me={me}
            onPickMe={pickMe}
            onPick={pick}
            meJustSelected={meJustSelected}
            onMeConsumed={() => setMeJustSelected(false)}
          />
        )}

        {view === "results" && (
          <GuestResultsView setId={setId} questions={questions} avatars={avatars} />
        )}

        {view === "people" && (
          <GuestPeopleView setId={setId} questions={questions} avatars={avatars} />
        )}
      </main>
    </div>
  );
}

// ================= GUEST TEST FLOW =================
// Mirrors original 2AF1: "SEN KIMSAN?" → question grid with mandatory + optional groups
function GuestTestFlow({
  setId,
  questions,
  avatars,
  groups,
  answers,
  me,
  onPickMe,
  onPick,
  meJustSelected,
  onMeConsumed,
}: {
  setId: string;
  questions: GuestQuestion[];
  avatars: GuestAvatar[];
  groups: GuestGroup[];
  answers: Record<string, Record<string, string>>;
  me: string | null;
  onPickMe: (avatarId: string) => void;
  onPick: (questionId: string, groupId: string, avatarId: string | null) => void;
  meJustSelected: boolean;
  onMeConsumed: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  // Auto-start test when "me" is selected
  useEffect(() => {
    if (meJustSelected && me) {
      onMeConsumed();
    }
  }, [meJustSelected, me, onMeConsumed]);

  if (avatars.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Bu setda avtarlar yo'q.
      </div>
    );
  }

  // Step 1: "SEN KIMSAN?" — pick who you are (mirrors original viewPickMe)
  if (!me) {
    const meAvatar = avatars.find((a) => a.id === me);
    return (
      <div className="fade-in">
        <div className="text-center mb-6">
          <h1 className="brand text-5xl sm:text-6xl leading-none">
            SEN KIMSAN?
          </h1>
          <p className="text-muted-foreground mt-2">
            O'zingni tanla. {questions.length} ta savol — o'z guruhingdan tanlaysan, boshqa guruhdan ixtiyoriy 😈
          </p>
        </div>
        {groups.map((g) => {
          const ga = avatars.filter((a) => a.group?.color === g.color || a.groupId === g.id);
          return (
            <div key={g.id} className="group-block mb-4 p-3 rounded-2xl border border-border bg-white/2">
              <div className="flex items-center gap-2 mb-3">
                <span className={`gtag gtag-${g.color}`}>{g.color} GURUH</span>
                <span className="text-muted-foreground text-xs">{ga.length} kishi</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {ga.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onPickMe(a.id)}
                    className="member-card w-full flex flex-col items-center gap-1 p-2"
                  >
                    <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                      {a.photoUrl ? (
                        <img src={a.photoUrl} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xl font-bold text-muted-foreground">
                          {a.name?.[0] || "?"}
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-bold uppercase text-center truncate w-full">
                      {a.shortName || a.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Step 2: Question flow (mirrors original viewQuestion)
  if (done || idx >= questions.length) {
    return (
      <div className="text-center py-12 space-y-4 fade-in">
        <div className="text-7xl animate-bounce">🎉</div>
        <h3 className="brand text-4xl text-brand-lime">RAHMAT!</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Javoblaringiz ushbu qurilmada saqlandi. Endi natijalarni ko'ring!
        </p>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          <button onClick={() => { setDone(false); setIdx(0); }} className="btn-ghost">
            ✏️ Javoblarni o'zgartirish
          </button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const cur = answers[q.id] || {};
  const meAvatar = avatars.find((a) => a.id === me);
  const myGroup = meAvatar?.group?.color || meAvatar?.groupId || "A";

  // Determine which groups to show: my group (mandatory) + other groups (optional)
  const myGroupObj = groups.find((g) => g.color === myGroup || g.id === myGroup);
  const otherGroups = groups.filter((g) => g !== myGroupObj);

  const next = () => {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else setDone(true);
  };

  const renderGroupGrid = (group: GuestGroup, required: boolean) => {
    const ga = avatars.filter((a) => a.group?.color === group.color || a.groupId === group.id);
    const groupId = group.color || group.id;
    return (
      <div key={group.id} className="group-block mb-4 p-3 rounded-2xl border border-border bg-white/2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`gtag gtag-${group.color}`}>{group.color} GURUH</span>
            <span className="text-muted-foreground text-xs">
              {required ? "majburiy" : "ixtiyoriy — bilmasang tashlab ket"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {ga.map((a) => {
            const isMe = a.id === me;
            const selected = cur[groupId] === a.id;
            return (
              <button
                key={a.id}
                onClick={() => !isMe && onPick(q.id, groupId, a.id)}
                className={`member-card w-full flex flex-col items-center gap-1 p-2 ${selected ? "selected" : ""} ${isMe ? "is-me" : ""}`}
                disabled={isMe}
              >
                <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-secondary flex items-center justify-center relative">
                  {a.photoUrl ? (
                    <img src={a.photoUrl} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xl font-bold text-muted-foreground">
                      {a.name?.[0] || "?"}
                    </div>
                  )}
                  {!a.photoUrl && (
                    <span className="absolute top-1 left-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-black/70 text-brand-yellow border border-brand-yellow/40">
                      🕵️ MAFIA
                    </span>
                  )}
                  {selected && (
                    <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-brand-lime text-black flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  )}
                </div>
                <div className="text-xs font-bold uppercase text-center truncate w-full">
                  {a.shortName || a.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Header: who am I + progress */}
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span className="flex items-center gap-2">
          {meAvatar?.photoUrl && (
            <img src={meAvatar.photoUrl} className="w-7 h-7 rounded-full object-cover" alt="" />
          )}
          {meAvatar?.shortName || meAvatar?.name}
          <span className={`gtag gtag-${myGroup}`}>{myGroup}</span>
        </span>
        <span>{idx + 1} / {questions.length}</span>
      </div>
      <div className="progress-bar mb-5 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-lime transition-all"
          style={{ width: `${(idx / questions.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <article className="q-card p-6 sm:p-8 text-center mb-5 relative">
        <div className="q-emoji mb-3 text-5xl">{q.emoji}</div>
        <span className={`pill cat-${String(q.category).split(" ")[0]} uppercase tracking-wider`}>{q.category}</span>
        <h2 className="q-text mt-3 brand text-3xl leading-tight">{q.text}</h2>
      </article>

      {/* My group (mandatory) */}
      {myGroupObj && renderGroupGrid(myGroupObj, true)}

      {/* Other groups (optional) */}
      {otherGroups.map((g) => renderGroupGrid(g, false))}

      {/* Navigation */}
      <div className="sticky bottom-4 flex items-center justify-center gap-3 pt-2 z-10">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="btn-ghost disabled:opacity-30"
        >
          ← Oldingi
        </button>
        <button
          onClick={next}
          disabled={!cur[myGroup]}
          className="btn-primary text-lg"
        >
          {idx === questions.length - 1 ? "🏁 Tugatish" : "Keyingi →"}
        </button>
      </div>
    </div>
  );
}

// ================= GUEST RESULTS VIEW =================
// Public results — visible to everyone (guests included)
function GuestResultsView({
  setId,
  questions,
  avatars,
}: {
  setId: string;
  questions: GuestQuestion[];
  avatars: GuestAvatar[];
}) {
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
  const avatarImg = (a: any) => (a?.photoUrl ? a.photoUrl : null);
  const avatarInitial = (a: any) => (a?.shortName || a?.name || "?")[0];
  const voterImg = (voterId: string) => data.voterInfo?.[voterId]?.photo || null;
  const voterName = (voterId: string) => data.voterInfo?.[voterId]?.name || "?";
  const voterInitial = (voterId: string) => voterName(voterId)[0] || "?";

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
                    const av = data.avatars.find((a: any) => a.id === targetId);
                    const votersArr = voters as any[];
                    const pct = total ? Math.round((votersArr.length / total) * 100) : 0;
                    const isTop = votersArr.length === max && votersArr.length > 0;
                    return (
                      <div key={targetId} className={`poll-opt ${isTop ? "top" : ""}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                            {avatarImg(av) ? (
                              <img src={avatarImg(av)} alt={av?.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-muted-foreground">{avatarInitial(av)}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium truncate">{av?.shortName || av?.name || "?"}</span>
                              <span className={`font-bold ${isTop ? "text-brand-lime" : "text-muted-foreground"}`}>{pct}%</span>
                            </div>
                            <div className="mt-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${isTop ? "bg-brand-lime" : "bg-brand-yellow/60"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          {/* Voter stack — all voters */}
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
                                      <span className="text-[8px] font-bold text-muted-foreground">{voterInitial(voterId)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground shrink-0">{votersArr.length}</div>
                        </div>
                      </div>
                    );
                  })}
                  {total === 0 && (
                    <div className="text-xs text-muted-foreground/50 py-2 text-center">Hali ovoz yo'q</div>
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
    const sorted = [...data.avatars].sort(
      (a, b) =>
        (wins[b.id]?.length || 0) - (wins[a.id]?.length || 0) ||
        (mentions[b.id] || 0) - (mentions[a.id] || 0)
    );
    return sorted.map((av: any, i: number) => {
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
                  <span className={`gtag gtag-${av.group.color}`}>{av.group.color}</span>
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
    });
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

// ================= GUEST PEOPLE VIEW =================
// Public Odamlar view — visible to everyone
function GuestPeopleView({
  setId,
  questions,
  avatars,
}: {
  setId: string;
  questions: GuestQuestion[];
  avatars: GuestAvatar[];
}) {
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
                      <span className={`gtag gtag-${av.group.color}`}>{av.group.color}</span>
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
