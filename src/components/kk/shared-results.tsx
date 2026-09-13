"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * Unified Results + People view — used by BOTH:
 * - sets-page.tsx (logged-in users viewing their own set)
 * - guest-mode.tsx (anonymous users viewing a shared set)
 *
 * This ensures identical rendering regardless of auth state.
 * Data comes from /api/results?setId=xxx (public for public sets).
 */

const catClass = (c: string) => "cat-" + String(c).split(" ")[0];

const avatarImg = (a: any) => (a?.photoUrl ? a.photoUrl : null);
const avatarInitial = (a: any) => (a?.shortName || a?.name || "?")[0];

export function SharedResultsView({ setId, mode = "results" }: { setId: string; mode?: "results" | "people" }) {
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

  const voterImg = (voterId: string): string | null => {
    const info = data.voterInfo?.[voterId];
    return info?.photo || null;
  };
  const voterName = (voterId: string): string => {
    const info = data.voterInfo?.[voterId];
    return info?.name || "?";
  };
  const voterInitial = (voterId: string): string => {
    return voterName(voterId)[0] || "?";
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
                    const av = data.avatars.find((a: any) => a.id === targetId);
                    const votersArr = voters as any[];
                    const pct = total ? Math.round((votersArr.length / total) * 100) : 0;
                    const isTop = votersArr.length === max && votersArr.length > 0;
                    return (
                      <div key={targetId} className={`poll-opt ${isTop ? "top" : ""}`}>
                        <div className="flex items-center gap-2">
                          {/* Target avatar */}
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
                          {/* Voter stack — ALL voters (no limit) */}
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

  // If mode="people", force show people view. If mode="results", show results + category chips.
  const showPeople = mode === "people" || cat === "__people";

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="brand text-4xl leading-none">
          {showPeople ? (
            <>ODAMLAR <span className="text-brand-coral">👤</span></>
          ) : (
            <>NATIJALAR <span className="text-brand-yellow">🏆</span></>
          )}
        </h2>
        <p className="text-xs text-muted-foreground mt-2">
          {showPeople
            ? "Har bir avatar necha marta tanlangan va qaysi savolda g'alaba qozongan"
            : `👥 ${data.voters}/${data.totalMembers} ovoz berdi · ✅ ${data.completed} tugatdi`}
        </p>
      </div>

      {/* Category chips — only in results mode */}
      {mode !== "people" && (
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
      )}

      <div className="space-y-3">
        {showPeople ? renderPeople() : renderQuestions(cat)}
      </div>
    </div>
  );
}
