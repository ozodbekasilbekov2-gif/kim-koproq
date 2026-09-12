"use client";

import { useEffect, useState, useCallback } from "react";
import { apiJson } from "@/lib/api-client";
import { toast } from "sonner";
import { Zap, ArrowLeft, Share2, Lock, Unlock } from "lucide-react";
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
 * Allows taking the test (anonymously) and viewing results.
 * Votes are stored locally only (no server sync for guest votes).
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load the set
      const s = await apiJson<GuestSet>(`/api/sets/${setId}`);
      setSet(s);

      // Load questions
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

      // Load all avatars and groups (public endpoint includes demo data)
      const av = await apiJson<{ avatars: GuestAvatar[] }>("/api/avatars");
      const gr = await apiJson<{ groups: GuestGroup[] }>("/api/groups");

      // Filter by set's groupIds if any
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

  const pick = (questionId: string, groupId: string, avatarId: string | null) => {
    setAnswers((prev) => {
      const cur = prev[questionId] || {};
      const next: Record<string, Record<string, string>> = {
        ...prev,
        [questionId]: { ...cur, [groupId]: avatarId || "" },
      };
      // Persist to localStorage
      try {
        localStorage.setItem(
          `kk_guest_answers_${setId}`,
          JSON.stringify(next)
        );
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

        {view === "test" && questions.length > 0 && (
          <GuestTestView
            setId={setId}
            questions={questions}
            avatars={avatars}
            groups={groups}
            answers={answers}
            onPick={pick}
          />
        )}

        {view === "results" && (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">📊</div>
            <h3 className="font-bold text-lg">Natijalar faqat ro'yxatdan o'tgan foydalanuvchilar uchun</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Mehmon sifatida siz o'z javoblaringizni ko'rasiz, lekin boshqalarning
              ovozlari ko'rinmaydi. To'liq natijalar uchun ro'yxatdan o'ting.
            </p>
            <button onClick={onExit} className="btn-primary">Ro'yxatdan o'tish</button>
          </div>
        )}

        {view === "people" && (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">👤</div>
            <h3 className="font-bold text-lg">Odamlar statistikasi</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Mehmon sifatida bu bo'lim cheklangan. Ro'yxatdan o'tgan foydalanuvchilar
              har bir avatar necha marta tanlanganini va qaysi savolda g'alaba
              qozonganini ko'ra oladi.
            </p>
            <button onClick={onExit} className="btn-primary">Ro'yxatdan o'tish</button>
          </div>
        )}
      </main>
    </div>
  );
}

// Guest test view — saves answers locally only
function GuestTestView({
  setId,
  questions,
  avatars,
  groups,
  answers,
  onPick,
}: {
  setId: string;
  questions: GuestQuestion[];
  avatars: GuestAvatar[];
  groups: GuestGroup[];
  answers: Record<string, Record<string, string>>;
  onPick: (questionId: string, groupId: string, avatarId: string | null) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  if (avatars.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Bu setda avtarlar yo'q.
      </div>
    );
  }

  if (done || idx >= questions.length) {
    return (
      <div className="text-center py-12 space-y-4 fade-in">
        <div className="text-7xl animate-bounce">🎉</div>
        <h3 className="brand text-4xl text-brand-lime">RAHMAT!</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Javoblaringiz ushbu qurilmada saqlandi. Natijalarni ko'rish uchun
          ro'yxatdan o'ting.
        </p>
        <button onClick={() => { setDone(false); setIdx(0); }} className="btn-ghost">
          ✏️ Javoblarni o'zgartirish
        </button>
      </div>
    );
  }

  const q = questions[idx];
  const cur = answers[q.id] || {};

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
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {avatars.map((a) => (
            <GuestAvatarTile
              key={a.id}
              avatar={a}
              selected={cur["default"] === a.id}
              onClick={() => onPick(q.id, "default", a.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const ga = avatars.filter((a) => a.groupId === g.id);
            if (ga.length === 0) return null;
            return (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`gtag gtag-${g.color || "A"}`}>{g.name} GURUH</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ga.map((a) => (
                    <GuestAvatarTile
                      key={a.id}
                      avatar={a}
                      selected={cur[g.color || g.id] === a.id}
                      onClick={() => onPick(q.id, g.color || g.id, a.id)}
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

function GuestAvatarTile({
  avatar,
  selected,
  onClick,
}: {
  avatar: GuestAvatar;
  selected: boolean;
  onClick: () => void;
}) {
  const hasPhoto = !!avatar.photoUrl;
  return (
    <button
      onClick={onClick}
      className={`member-card w-full p-2 flex flex-col items-center gap-1 ${selected ? "selected" : ""}`}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex items-center justify-center relative">
        {hasPhoto ? (
          <img src={avatar.photoUrl!} alt={avatar.name} className="w-full h-full object-cover" />
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
