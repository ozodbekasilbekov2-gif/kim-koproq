import {
  ArrowLeft,
  ArchiveRestore,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Edit3,
  HeartHandshake,
  Leaf,
  Lightbulb,
  List,
  LockKeyhole,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  demoState,
  getTelegramInitData,
  type ChatPayload,
  type MiniChat,
  type MiniMessage,
  type MiniState,
  type MiniTag,
  miniApi,
  loadMiniState,
} from "@/lib/miniapp";

const ICONS: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "heart-handshake": HeartHandshake,
  "book-open": List,
  "music-2": Music2,
  palette: Palette,
  "briefcase-business": BriefcaseBusiness,
  "graduation-cap": ShieldCheck,
  camera: Camera,
  leaf: Leaf,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
};
const COLORS = ["#6d5dfc", "#e35d6a", "#1da89b", "#e59b42", "#4f86f7", "#9b6de3"];
const ICON_CHOICES = ["message-circle", "heart-handshake", "music-2", "palette", "briefcase-business", "camera", "leaf", "sparkles"];

type Page = "chats" | "profile" | "settings";

export default function MiniApp() {
  const [state, setState] = useState<MiniState | null>(null);
  const [page, setPage] = useState<Page>("chats");
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [chatPayload, setChatPayload] = useState<ChatPayload | null>(null);
  const [trashMode, setTrashMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const hasTelegramSession = Boolean(getTelegramInitData());

  const refreshState = async () => {
    try {
      const next = await loadMiniState();
      setState(next);
    } catch {
      if (!state) setState(demoState);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();
    void refreshState();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state?.settings.theme === "dark");
    document.documentElement.style.setProperty("--mini-accent", state?.profile.accentColor ?? "#6d5dfc");
    const webApp = window.Telegram?.WebApp;
    webApp?.setHeaderColor?.(state?.settings.theme === "dark" ? "#171922" : "#f6f4ef");
    webApp?.setBackgroundColor?.(state?.settings.theme === "dark" ? "#171922" : "#f6f4ef");
  }, [state?.settings.theme, state?.profile.accentColor]);

  useEffect(() => {
    if (!selectedChatId) return;
    const poll = async () => {
      if (!hasTelegramSession) return;
      try {
        const next = await miniApi<ChatPayload>(`/chats/${selectedChatId}${trashMode ? "?trash=true" : ""}`);
        setChatPayload(next);
      } catch {
        // Keep the last known messages while Telegram is reconnecting.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3500);
    return () => window.clearInterval(timer);
  }, [selectedChatId, trashMode, hasTelegramSession]);

  const currentChats = trashMode ? state?.deletedChats ?? [] : state?.chats ?? [];
  const currentTags = trashMode ? state?.deletedTags ?? [] : state?.tags ?? [];
  const selectedChat = currentChats.find(chat => chat.id === selectedChatId) ?? chatPayload?.chat;

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function mutate(path: string, options: RequestInit = {}, refreshChat = false) {
    try {
      await miniApi(path, options);
      await refreshState();
      if (refreshChat && selectedChatId && hasTelegramSession) {
        const next = await miniApi<ChatPayload>(`/chats/${selectedChatId}${trashMode ? "?trash=true" : ""}`);
        setChatPayload(next);
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : "Не удалось сохранить изменения");
    }
  }

  async function openChat(chat: MiniChat) {
    setPage("chats");
    setTrashMode(false);
    setSelectedId(null);
    setSelectedChatId(chat.id);
    if (!hasTelegramSession) {
      setChatPayload({ chat, messages: demoMessages(chat.id) });
      return;
    }
    try {
      const next = await miniApi<ChatPayload>(`/chats/${chat.id}`);
      setChatPayload(next);
    } catch {
      flash("Не удалось открыть чат");
    }
  }

  async function findNewChat() {
    if (!hasTelegramSession) {
      const nextId = 500 + (state?.chats.length ?? 0);
      const demoChat: MiniChat = { id: nextId, name: "Новый диалог", iconKey: "sparkles", color: "#6d5dfc", status: "waiting", deletedAt: null, other: { displayName: "Ищем собеседника", iconKey: "sparkles", accentColor: "#6d5dfc" }, sharedTags: ["новое"] };
      setState(previous => previous ? { ...previous, chats: [demoChat, ...previous.chats] } : previous);
      flash("Ищем собеседника по общим тегам");
      return;
    }
    try {
      const result = await miniApi<{ chat: MiniChat; matched: boolean }>("/chats/match", { method: "POST", body: "{}" });
      await refreshState();
      if (result.chat?.id) await openChat(result.chat);
      flash(result.matched ? "Собеседник найден по общим тегам" : "Вы добавлены в очередь поиска");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Поиск временно недоступен");
    }
  }

  function handleAdd() {
    if (page === "chats" && selectedChatId === null) void findNewChat();
    else if (page === "profile") setAddingTag(value => !value);
  }

  function handleEdit() {
    if (page === "chats" && selectedChatId === null && selectedId !== null && !trashMode) {
      const selectedChat = currentChats.find(chat => chat.id === selectedId);
      if (selectedChat) {
        const nextName = window.prompt("Новое название чата", selectedChat.name)?.trim();
        if (nextName && nextName !== selectedChat.name) {
          if (hasTelegramSession) void mutate(`/chats/${selectedChat.id}`, { method: "PATCH", body: JSON.stringify({ name: nextName }) });
          else setState(previous => previous ? { ...previous, chats: previous.chats.map(chat => chat.id === selectedChat.id ? { ...chat, name: nextName } : chat) } : previous);
        }
      }
      return;
    }
    setEditMode(value => !value);
    setSelectedId(null);
    if (page === "chats" && selectedChatId === null) flash("Выберите сообщение внутри чата для изменения");
  }

  function handleTrash() {
    setTrashMode(value => !value);
    setSelectedId(null);
    setEditMode(false);
  }

  function handleBack() {
    if (selectedChatId !== null) {
      setSelectedChatId(null);
      setChatPayload(null);
      setEditMode(false);
      setTrashMode(false);
      return;
    }
    setPage("chats");
    setTrashMode(false);
  }

  async function toggleTheme() {
    const theme = state?.settings.theme === "dark" ? "light" : "dark";
    if (!state) return;
    setState({ ...state, settings: { ...state.settings, theme } });
    if (hasTelegramSession) await mutate("/settings", { method: "PATCH", body: JSON.stringify({ theme }) });
  }

  if (loading || !state) return <div className="mini-shell flex items-center justify-center text-sm text-muted-foreground">Загрузка Mini App…</div>;

  return (
    <div className={`mini-shell font-${state.settings.fontScale}`}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[640px] flex-col">
        <TopBar
          page={page}
          inChat={selectedChatId !== null}
          trashMode={trashMode}
          editMode={editMode}
          theme={state.settings.theme}
          onAdd={handleAdd}
          onTrash={handleTrash}
          onEdit={handleEdit}
          onBack={handleBack}
          onTheme={() => void toggleTheme()}
        />
        <main className="mini-scroll flex-1 overflow-y-auto px-4 pb-28 pt-3">
          {selectedChatId !== null && chatPayload ? (
            <ChatView
              chat={chatPayload.chat}
              messages={chatPayload.messages}
              profile={state.profile}
              chatBackground={state.settings.chatBackground}
              trashMode={trashMode}
              editMode={editMode}
              selectedId={selectedId}
              messageDraft={messageDraft}
              editingMessageId={editingMessageId}
              onDraftChange={setMessageDraft}
              onSelect={setSelectedId}
              onEditMessage={setEditingMessageId}
              onCancelEdit={() => setEditingMessageId(null)}
              onSend={async () => {
                const body = messageDraft.trim();
                if (!body) return;
                if (!hasTelegramSession) {
                  setChatPayload(previous => previous ? { ...previous, messages: [...previous.messages, { id: Date.now(), chatId: chatPayload.chat.id, senderTelegramUserId: "demo", body, editedAt: null, deletedAt: null, createdAt: new Date().toISOString() }] } : previous);
                  setMessageDraft("");
                  return;
                }
                await mutate(`/chats/${chatPayload.chat.id}/messages`, { method: "POST", body: JSON.stringify({ body }) }, true);
                setMessageDraft("");
              }}
              onSaveEdit={async () => {
                const body = messageDraft.trim();
                if (!editingMessageId || !body) return;
                await mutate(`/chats/${chatPayload.chat.id}/messages/${editingMessageId}`, { method: "PATCH", body: JSON.stringify({ body }) }, true);
                setEditingMessageId(null);
                setMessageDraft("");
              }}
              onTrashMessage={async messageId => {
                if (!hasTelegramSession) return;
                await mutate(`/chats/${chatPayload.chat.id}/messages/${messageId}`, { method: "DELETE" }, true);
                setSelectedId(null);
              }}
              onRestoreMessage={async messageId => {
                await mutate(`/chats/${chatPayload.chat.id}/messages/${messageId}/restore`, { method: "POST", body: "{}" }, true);
                setSelectedId(null);
              }}
              onPermanentDelete={async messageId => {
                if (!window.confirm("Удалить сообщение навсегда?")) return;
                await mutate(`/chats/${chatPayload.chat.id}/messages/${messageId}/permanent-delete`, { method: "POST", body: "{}" }, true);
                setSelectedId(null);
              }}
            />
          ) : page === "chats" ? (
            <ChatsPage
              chats={currentChats}
              trashMode={trashMode}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpen={chat => void openChat(chat)}
              onRestore={async chat => { await mutate(`/chats/${chat.id}/restore`, { method: "POST", body: "{}" }); setSelectedId(null); }}
              onDelete={async chat => { await mutate(`/chats/${chat.id}?permanent=true`, { method: "DELETE" }); setSelectedId(null); }}
              onMatch={() => void findNewChat()}
            />
          ) : page === "profile" ? (
            <ProfilePage
              state={state}
              tags={currentTags}
              trashMode={trashMode}
              addingTag={addingTag}
              tagDraft={tagDraft}
              onTagDraftChange={setTagDraft}
              onAddTag={async () => {
                if (!tagDraft.trim()) return;
                if (hasTelegramSession) await mutate("/tags", { method: "POST", body: JSON.stringify({ label: tagDraft }) });
                else setState(previous => previous ? { ...previous, tags: [...previous.tags, { id: Date.now(), label: tagDraft.trim(), deletedAt: null }] } : previous);
                setTagDraft("");
                setAddingTag(false);
              }}
              onProfileChange={async patch => {
                setState(previous => previous ? { ...previous, profile: { ...previous.profile, ...patch } } : previous);
                if (hasTelegramSession) await mutate("/profile", { method: "PATCH", body: JSON.stringify(patch) });
              }}
              onRestoreTag={async tag => { await mutate(`/tags/${tag.id}/restore`, { method: "POST", body: "{}" }); setSelectedId(null); }}
              onDeleteTag={async tag => { await mutate(`/tags/${tag.id}?permanent=true`, { method: "DELETE" }); setSelectedId(null); }}
              onTrashTag={async tag => { await mutate(`/tags/${tag.id}`, { method: "DELETE" }); setSelectedId(null); }}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <SettingsPage
              state={state}
              onChange={async patch => {
                setState(previous => previous ? { ...previous, settings: { ...previous.settings, ...patch } } : previous);
                if (hasTelegramSession) await mutate("/settings", { method: "PATCH", body: JSON.stringify(patch) });
              }}
            />
          )}
        </main>
        {notice && <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-xl">{notice}</div>}
        <BottomBar page={page} onPage={nextPage => { setPage(nextPage); setSelectedChatId(null); setChatPayload(null); setTrashMode(false); setSelectedId(null); }} />
      </div>
    </div>
  );
}

function TopBar({ page, inChat, trashMode, editMode, theme, onAdd, onTrash, onEdit, onBack, onTheme }: { page: Page; inChat: boolean; trashMode: boolean; editMode: boolean; theme: "light" | "dark"; onAdd: () => void; onTrash: () => void; onEdit: () => void; onBack: () => void; onTheme: () => void }) {
  return (
    <header className="mini-topbar sticky top-0 z-30 border-b border-border/70 bg-background/95 px-4 pb-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {inChat ? <button className="mini-icon-btn" onClick={onBack} aria-label="Назад"><ArrowLeft className="size-[18px]" /></button> : <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--mini-accent)] text-white"><ShieldCheck className="size-5" /></div>}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold tracking-tight">{trashMode ? "Корзина" : inChat ? "Диалог" : page === "chats" ? "Чаты" : page === "profile" ? "Профиль" : "Настройки"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{trashMode ? "Долгое хранение удалённых данных" : inChat ? "Анонимное сообщение" : "Тихое пространство для общения"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <TopAction icon={Plus} label="Добавить" onClick={onAdd} disabled={page === "settings" || inChat} />
          <LongPressAction icon={Trash2} label="Корзина" active={trashMode} onClick={onTrash} onLongPress={onTrash} />
          <TopAction icon={editMode ? Check : Pencil} label="Изменить" active={editMode} onClick={onEdit} disabled={page === "settings"} />
          <TopAction icon={inChat ? ArrowLeft : MoreHorizontal} label="Назад" onClick={onBack} />
          <TopAction icon={theme === "dark" ? Sparkles : CircleHelp} label="Тема" onClick={onTheme} />
        </div>
      </div>
    </header>
  );
}

function TopAction({ icon: Icon, label, onClick, active = false, disabled = false }: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return <button className={`mini-icon-btn ${active ? "active" : ""} ${disabled ? "opacity-35" : ""}`} disabled={disabled} onClick={onClick} aria-label={label} title={label}><Icon className="size-[18px]" /></button>;
}

function LongPressAction({ icon: Icon, label, onClick, onLongPress, active }: { icon: LucideIcon; label: string; onClick: () => void; onLongPress: () => void; active?: boolean }) {
  const started = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const finish = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (Date.now() - started.current < 550) onClick();
  };
  return <button className={`mini-icon-btn ${active ? "active" : ""}`} onPointerDown={() => { started.current = Date.now(); timer.current = window.setTimeout(onLongPress, 550); }} onPointerUp={finish} onPointerLeave={() => timer.current && window.clearTimeout(timer.current)} aria-label={label} title={label}><Icon className="size-[18px]" /></button>;
}

function ChatsPage({ chats, trashMode, selectedId, onSelect, onOpen, onRestore, onDelete, onMatch }: { chats: MiniChat[]; trashMode: boolean; selectedId: number | null; onSelect: (id: number | null) => void; onOpen: (chat: MiniChat) => void; onRestore: (chat: MiniChat) => void; onDelete: (chat: MiniChat) => void; onMatch: () => void }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--mini-accent)]">{trashMode ? "Удалённые" : "Ваша история"}</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{trashMode ? "Корзина чатов" : "Все разговоры"}</h1></div>
        {!trashMode && <button onClick={onMatch} className="flex items-center gap-1 rounded-full bg-[var(--mini-accent)] px-3 py-2 text-xs font-semibold text-white"><Plus className="size-3.5" /> Новый чат</button>}
      </div>
      {chats.length === 0 ? <EmptyState trashMode={trashMode} onMatch={onMatch} /> : <div className="space-y-2.5">{chats.map(chat => <ChatRow key={chat.id} chat={chat} selected={selectedId === chat.id} trashMode={trashMode} onOpen={() => onOpen(chat)} onSelect={() => onSelect(chat.id)} onRestore={() => onRestore(chat)} onDelete={() => onDelete(chat)} />)}</div>}
    </section>
  );
}

function ChatRow({ chat, selected, trashMode, onOpen, onSelect, onRestore, onDelete }: { chat: MiniChat; selected: boolean; trashMode: boolean; onOpen: () => void; onSelect: () => void; onRestore: () => void; onDelete: () => void }) {
  const started = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const Icon = ICONS[chat.iconKey] ?? MessageCircle;
  function pointerDown() { started.current = Date.now(); timer.current = window.setTimeout(onSelect, 560); }
  function pointerUp() { if (timer.current) window.clearTimeout(timer.current); if (Date.now() - started.current < 560) onOpen(); }
  return <article className={`mini-card relative rounded-2xl p-3.5 ${selected ? "ring-2 ring-[var(--mini-accent)]" : ""}`} onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerLeave={() => timer.current && window.clearTimeout(timer.current)}>
    <div className="flex items-center gap-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[17px] text-white" style={{ background: chat.color }}><Icon className="size-6" /></div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-bold">{chat.name}</p><span className={`size-2 rounded-full ${chat.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} /></div><p className="mt-1 truncate text-xs text-muted-foreground">{chat.sharedTags.length ? chat.sharedTags.map(tag => `#${tag}`).join(" · ") : "общих тегов пока нет"}</p></div>
      <div className="flex flex-col items-end gap-2 text-muted-foreground"><span className="text-[10px]">#{chat.id}</span><ChevronRight className="size-4" /></div>
    </div>
    {selected && <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3"><button className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--mini-accent)]" onClick={trashMode ? onRestore : onSelect}>{trashMode ? "Восстановить" : "Выбрано"}</button><button className="rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive" onClick={onDelete}>{trashMode ? "Удалить навсегда" : "В корзину"}</button></div>}
  </article>;
}

function ProfilePage({ state, tags, trashMode, addingTag, tagDraft, onTagDraftChange, onAddTag, onProfileChange, onRestoreTag, onDeleteTag, onTrashTag, selectedId, onSelect }: { state: MiniState; tags: MiniTag[]; trashMode: boolean; addingTag: boolean; tagDraft: string; onTagDraftChange: (value: string) => void; onAddTag: () => void; onProfileChange: (patch: Partial<MiniState["profile"]>) => void; onRestoreTag: (tag: MiniTag) => void; onDeleteTag: (tag: MiniTag) => void; onTrashTag: (tag: MiniTag) => void; selectedId: number | null; onSelect: (id: number | null) => void }) {
  const Icon = ICONS[state.profile.iconKey] ?? MessageCircle;
  return <section className="space-y-5"><div className="mini-card overflow-hidden rounded-3xl"><div className="h-20" style={{ background: `linear-gradient(120deg, ${state.profile.accentColor}, ${state.profile.accentColor}55)` }} /><div className="px-5 pb-5"><div className="-mt-8 flex items-end justify-between"><div className="flex size-16 items-center justify-center rounded-[21px] border-4 border-card text-white shadow-lg" style={{ background: state.profile.accentColor }}><Icon className="size-8" /></div><span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">анонимный профиль</span></div><input className="mt-4 w-full bg-transparent text-xl font-bold outline-none" value={state.profile.displayName} onChange={event => onProfileChange({ displayName: event.target.value })} placeholder="Ваше имя в Mini App" /><p className="mt-1 text-xs leading-5 text-muted-foreground">Это имя и иконка отображаются только в ваших чатах и могут быть изменены в любое время.</p></div></div>
    <div className="mini-card rounded-3xl p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--mini-accent)]">Визуальный профиль</p><h2 className="mt-1 text-lg font-bold">Иконка и цвет</h2></div><Pencil className="size-4 text-muted-foreground" /></div><div className="mt-4 grid grid-cols-8 gap-2">{ICON_CHOICES.map(key => { const Choice = ICONS[key] ?? MessageCircle; return <button key={key} onClick={() => onProfileChange({ iconKey: key })} className={`flex aspect-square items-center justify-center rounded-xl border ${state.profile.iconKey === key ? "border-transparent text-white" : "border-border text-muted-foreground"}`} style={state.profile.iconKey === key ? { background: state.profile.accentColor } : undefined}><Choice className="size-4" /></button>; })}</div><div className="mt-4 flex gap-2">{COLORS.map(color => <button key={color} aria-label={color} onClick={() => onProfileChange({ accentColor: color })} className={`size-8 rounded-full border-2 ${state.profile.accentColor === color ? "border-foreground p-0.5" : "border-transparent"}`}><span className="block size-full rounded-full" style={{ background: color }} /></button>)}</div></div>
    <div className="mini-card rounded-3xl p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--mini-accent)]">{trashMode ? "Корзина" : "Общие интересы"}</p><h2 className="mt-1 text-lg font-bold">{trashMode ? "Удалённые теги" : "Ваши теги"}</h2></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{tags.length}</span></div>{addingTag && !trashMode && <div className="mt-4 flex gap-2"><input autoFocus value={tagDraft} onChange={event => onTagDraftChange(event.target.value)} onKeyDown={event => event.key === "Enter" && onAddTag()} placeholder="например, кино" className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2" /><button onClick={onAddTag} className="rounded-xl bg-[var(--mini-accent)] px-4 text-sm font-semibold text-white"><Check className="size-4" /></button></div>}{tags.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">{trashMode ? "Корзина тегов пуста." : "Добавьте пару интересов — бот найдёт более подходящего собеседника."}</p> : <div className="mt-5 flex flex-wrap gap-2">{tags.map(tag => <TagPill key={tag.id} tag={tag} trashMode={trashMode} selected={selectedId === tag.id} onSelect={() => onSelect(tag.id)} onRestore={() => onRestoreTag(tag)} onDelete={() => onDeleteTag(tag)} onTrash={() => onTrashTag(tag)} />)}</div>}</div>
  </section>;
}

function TagPill({ tag, trashMode, selected, onSelect, onRestore, onDelete, onTrash }: { tag: MiniTag; trashMode: boolean; selected: boolean; onSelect: () => void; onRestore: () => void; onDelete: () => void; onTrash: () => void }) {
  const timer = useRef<number | undefined>(undefined); const started = useRef(0);
  return <div className={`relative rounded-full border px-3 py-2 text-xs font-medium ${selected ? "border-[var(--mini-accent)] bg-accent text-accent-foreground" : "border-border bg-background"}`} onPointerDown={() => { started.current = Date.now(); timer.current = window.setTimeout(onSelect, 560); }} onPointerUp={() => { if (timer.current) window.clearTimeout(timer.current); if (Date.now() - started.current < 560) onSelect(); }}><span>#{tag.label}</span>{selected && <div className="absolute left-0 top-9 z-20 flex min-w-max gap-1 rounded-xl border border-border bg-card p-1 shadow-xl"><button className="rounded-lg p-2 text-[var(--mini-accent)]" onClick={trashMode ? onRestore : onTrash}>{trashMode ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}</button>{trashMode && <button className="rounded-lg p-2 text-destructive" onClick={onDelete}><Trash2 className="size-4" /></button>}</div>}</div>;
}

function SettingsPage({ state, onChange }: { state: MiniState; onChange: (patch: Partial<MiniState["settings"]>) => void }) {
  return <section className="space-y-4"><div className="px-1"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--mini-accent)]">Ваше пространство</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Настройки</h1></div><SettingCard title="Размер текста" icon={Settings2}><Segmented value={state.settings.fontScale} options={["small", "medium", "large"]} labels={["Малый", "Средний", "Крупный"]} onChange={fontScale => onChange({ fontScale: fontScale as MiniState["settings"]["fontScale"] })} /></SettingCard><SettingCard title="Фон окна чата" icon={Palette}><div className="grid grid-cols-4 gap-2">{(["paper", "mist", "peach", "night"] as const).map(background => <button key={background} onClick={() => onChange({ chatBackground: background })} className={`h-14 rounded-xl border text-xs ${state.settings.chatBackground === background ? "border-[var(--mini-accent)] ring-2 ring-[var(--mini-accent)]/20" : "border-border"} chat-bg-${background}`}>{background === "paper" ? "Бумага" : background === "mist" ? "Туман" : background === "peach" ? "Персик" : "Ночь"}</button>)}</div></SettingCard><SettingCard title="Цвет ваших сообщений" icon={MessageCircle}><div className="flex flex-wrap gap-3">{COLORS.map(color => <button key={color} onClick={() => onChange({ messageColor: color })} className={`size-9 rounded-full border-2 ${state.settings.messageColor === color ? "border-foreground p-0.5" : "border-transparent"}`}><span className="block size-full rounded-full" style={{ background: color }} /></button>)}</div></SettingCard><SettingCard title="Тема Mini App" icon={Sparkles}><Segmented value={state.settings.theme} options={["light", "dark"]} labels={["Светлая", "Тёмная"]} onChange={theme => onChange({ theme: theme as "light" | "dark" })} /></SettingCard><div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs leading-5 text-indigo-900"><LockKeyhole className="mb-2 size-4" />Настройки и профиль сохраняются на сервере и привязаны к вашему проверенному Telegram-аккаунту.</div></section>;
}

function SettingCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) { return <div className="mini-card rounded-3xl p-5"><div className="mb-4 flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-4" /></div><h2 className="font-bold">{title}</h2></div>{children}</div>; }
function Segmented({ value, options, labels, onChange }: { value: string; options: string[]; labels: string[]; onChange: (value: string) => void }) { return <div className="grid grid-cols-3 gap-2">{options.map((option, index) => <button key={option} onClick={() => onChange(option)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${value === option ? "border-[var(--mini-accent)] bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}>{labels[index]}</button>)}</div>; }

function ChatView({ chat, messages, profile, chatBackground, trashMode, editMode, selectedId, messageDraft, editingMessageId, onDraftChange, onSelect, onEditMessage, onCancelEdit, onSend, onSaveEdit, onTrashMessage, onRestoreMessage, onPermanentDelete }: { chat: MiniChat; messages: MiniMessage[]; profile: MiniState["profile"]; chatBackground: MiniState["settings"]["chatBackground"]; trashMode: boolean; editMode: boolean; selectedId: number | null; messageDraft: string; editingMessageId: number | null; onDraftChange: (value: string) => void; onSelect: (id: number | null) => void; onEditMessage: (id: number) => void; onCancelEdit: () => void; onSend: () => void; onSaveEdit: () => void; onTrashMessage: (id: number) => void; onRestoreMessage: (id: number) => void; onPermanentDelete: (id: number) => void }) {
  const ownId = getLocalTelegramId();
  const OtherIcon = ICONS[chat.other.iconKey] ?? MessageCircle;
  return <section className="-mx-4 -mt-3 flex min-h-[calc(100dvh-150px)] flex-col"><div className="border-b border-border bg-background/80 px-4 py-3 backdrop-blur"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl text-white" style={{ background: chat.color }}><OtherIcon className="size-5" /></div><div className="min-w-0 flex-1"><h1 className="truncate text-base font-bold">{chat.name}</h1><p className="text-[11px] text-muted-foreground">{chat.sharedTags.length ? chat.sharedTags.map(tag => `#${tag}`).join(" · ") : "анонимный диалог"}</p></div><span className="text-[10px] text-muted-foreground">#{chat.id}</span></div></div><div className={`mini-scroll flex-1 space-y-3 overflow-y-auto px-4 py-5 chat-bg-${chatBackground}`}><div className="mx-auto mb-5 max-w-[290px] rounded-2xl border border-border bg-card/80 p-3 text-center text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mx-auto mb-1 size-4 text-[var(--mini-accent)]" />Диалог анонимный. Общие теги помогают найти контакт, но имя раскрывается только добровольно.</div>{messages.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">{trashMode ? "Удалённых сообщений нет." : "Напишите первое сообщение."}</p> : messages.map(message => { const own = ownId ? message.senderTelegramUserId === ownId : message.senderTelegramUserId === "demo"; const selected = selectedId === message.id; const deleted = Boolean(message.deletedAt); return <MessageBubble key={message.id} message={message} own={own} deleted={deleted} selected={selected} trashMode={trashMode} editMode={editMode} profileColor={profile.accentColor} onSelect={() => onSelect(message.id)} />; })}</div>{selectedId && <MessageActions messageId={selectedId} trashMode={trashMode} editMode={editMode} onEdit={() => { onEditMessage(selectedId); onSelect(null); }} onTrash={() => void onTrashMessage(selectedId)} onRestore={() => void onRestoreMessage(selectedId)} onPermanentDelete={() => void onPermanentDelete(selectedId)} />}<div className="border-t border-border bg-background p-3 pb-[max(12px,env(safe-area-inset-bottom))]">{editingMessageId ? <div className="flex gap-2"><input autoFocus value={messageDraft} onChange={event => onDraftChange(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--mini-accent)]" placeholder="Изменить сообщение" /><button onClick={onSaveEdit} className="flex size-12 items-center justify-center rounded-2xl bg-[var(--mini-accent)] text-white"><Check className="size-5" /></button><button onClick={onCancelEdit} className="flex size-12 items-center justify-center rounded-2xl border border-border"><X className="size-5" /></button></div> : <div className="flex gap-2"><input value={messageDraft} onChange={event => onDraftChange(event.target.value)} onKeyDown={event => event.key === "Enter" && onSend()} disabled={trashMode} className="min-w-0 flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--mini-accent)] disabled:opacity-50" placeholder={trashMode ? "Режим корзины" : "Написать анонимно…"} /><button onClick={onSend} disabled={!messageDraft.trim() || trashMode} className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--mini-accent)] text-white disabled:opacity-40"><ChevronRight className="size-5" /></button></div>}</div></section>;
}

function MessageBubble({ message, own, deleted, selected, trashMode, editMode, profileColor, onSelect }: { message: MiniMessage; own: boolean; deleted: boolean; selected: boolean; trashMode: boolean; editMode: boolean; profileColor: string; onSelect: () => void }) { const started = useRef(0); const timer = useRef<number | undefined>(undefined); return <div className={`flex ${own ? "justify-end" : "justify-start"}`}><button onClick={onSelect} onPointerDown={() => { started.current = Date.now(); timer.current = window.setTimeout(onSelect, 560); }} onPointerUp={() => timer.current && window.clearTimeout(timer.current)} className={`max-w-[86%] rounded-2xl px-4 py-3 text-left shadow-sm transition ${own ? "rounded-br-md text-white" : "rounded-bl-md mini-card"} ${selected ? "ring-2 ring-[var(--mini-accent)]" : ""} ${deleted ? "opacity-60 line-through" : ""}`} style={own && !deleted ? { background: profileColor } : undefined}><span className="mb-1 block text-[10px] font-semibold opacity-65">{deleted ? "Удалено" : own ? "Вы" : "Собеседник"}</span><span className="whitespace-pre-wrap text-sm leading-5">{message.body}</span>{message.editedAt && !deleted && <span className="ml-2 text-[10px] opacity-60">изменено</span>}{(editMode || trashMode) && own && !deleted && <Edit3 className="mt-2 size-3.5 opacity-60" />}</button></div>; }
function MessageActions({ messageId, trashMode, editMode, onEdit, onTrash, onRestore, onPermanentDelete }: { messageId: number; trashMode: boolean; editMode: boolean; onEdit: () => void; onTrash: () => void; onRestore: () => void; onPermanentDelete: () => void }) { return <div className="flex items-center justify-center gap-2 border-t border-border bg-background px-4 py-2"><span className="mr-2 text-[10px] text-muted-foreground">Сообщение #{messageId}</span>{trashMode ? <><button onClick={onRestore} className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700">Восстановить</button><button onClick={onPermanentDelete} className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">Удалить навсегда</button></> : editMode ? <><button onClick={onEdit} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">Изменить</button><button onClick={onTrash} className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">В корзину</button></> : null}</div>; }

function BottomBar({ page, onPage }: { page: Page; onPage: (page: Page) => void }) { return <nav className="mini-bottombar fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 px-4 pt-2 backdrop-blur-md"><div className="mx-auto grid max-w-[640px] grid-cols-3 gap-2"><BottomButton icon={MessageCircle} label="Чаты" active={page === "chats"} onClick={() => onPage("chats")} /><BottomButton icon={UserRound} label="Профиль" active={page === "profile"} onClick={() => onPage("profile")} /><BottomButton icon={Settings2} label="Настройки" active={page === "settings"} onClick={() => onPage("settings")} /></div></nav>; }
function BottomButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) { return <button onClick={onClick} className={`flex h-12 items-center justify-center gap-2 rounded-2xl border text-xs font-semibold ${active ? "border-transparent bg-[var(--mini-accent)] text-white" : "border-border bg-card text-muted-foreground"}`}><Icon className="size-4" />{label}</button>; }
function EmptyState({ trashMode, onMatch }: { trashMode: boolean; onMatch: () => void }) { return <div className="mini-card rounded-3xl px-6 py-12 text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">{trashMode ? <ArchiveRestore className="size-7" /> : <HeartHandshake className="size-7" />}</div><h2 className="mt-5 text-lg font-bold">{trashMode ? "Корзина пуста" : "Здесь пока тихо"}</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{trashMode ? "Удалённые чаты появятся здесь и будут доступны для восстановления." : "Добавьте новый чат — мы попробуем найти собеседника с похожими интересами."}</p>{!trashMode && <button onClick={onMatch} className="mt-5 rounded-2xl bg-[var(--mini-accent)] px-4 py-3 text-sm font-semibold text-white"><Plus className="mr-1 inline size-4" />Найти собеседника</button>}</div>; }

function getLocalTelegramId() { const raw = getTelegramInitData(); const user = new URLSearchParams(raw).get("user"); if (!user) return ""; try { return String((JSON.parse(user) as { id: number }).id); } catch { return ""; } }
function demoMessages(chatId: number): MiniMessage[] { return [{ id: chatId * 10 + 1, chatId, senderTelegramUserId: "other", body: "Привет. Рад, что мы совпали по тегам.", editedAt: null, deletedAt: null, createdAt: new Date(Date.now() - 500000).toISOString() }, { id: chatId * 10 + 2, chatId, senderTelegramUserId: "demo", body: "Тоже рад. Можно общаться спокойно и без неловкости.", editedAt: null, deletedAt: null, createdAt: new Date(Date.now() - 420000).toISOString() }]; }
