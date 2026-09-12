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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Upload,
  User,
  Briefcase,
  GraduationCap,
  Stethoscope,
  Cpu,
  Palette,
  Scale,
  Wrench,
  Plane,
  Camera,
  Sparkles,
  Pencil,
} from "lucide-react";
import type { KKUser } from "@/app/page";
import type { ActionMode } from "./app-shell";

export type AvatarData = {
  id: string;
  name: string;
  shortName?: string | null;
  photoUrl?: string | null;
  iconName?: string | null;
  groupId?: string | null;
  group?: { id: string; name: string; color: string } | null;
  isDemo?: boolean; // true if this is one of the 27 2AF1 demo members
};

export type GroupData = {
  id: string;
  name: string;
  color: string;
  _count?: { avatars: number };
};

const PROFESSIONAL_ICONS = [
  { name: "user", label: "Foydalanuvchi", icon: User },
  { name: "user-tie", label: "Menejer", icon: Briefcase },
  { name: "user-graduate", label: "Talaba", icon: GraduationCap },
  { name: "user-nurse", label: "Shifokor", icon: Stethoscope },
  { name: "user-cog", label: "Dasturchi", icon: Cpu },
  { name: "user-astronaut", label: "Astronavt", icon: Plane },
  { name: "user-check", label: "Aktiv", icon: Scale },
  { name: "palette", label: "Dizayner", icon: Palette },
  { name: "wrench", label: "Mexanik", icon: Wrench },
  { name: "camera", label: "Fotograf", icon: Camera },
];

function getIcon(name?: string | null) {
  return PROFESSIONAL_ICONS.find((i) => i.name === name)?.icon || User;
}

export function AvatarsPage({
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
  const [avatars, setAvatars] = useState<AvatarData[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState<AvatarData | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [av, gr] = await Promise.all([
        apiJson<{ avatars: AvatarData[] }>("/api/avatars"),
        apiJson<{ groups: GroupData[] }>("/api/groups"),
      ]);
      setAvatars(av.avatars);
      setGroups(gr.groups);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "create") {
      setShowCreate(true);
      onClearSelection();
    }
  }, [mode, onClearSelection]);

  // confirm-delete
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { ids: string[] };
      if (!detail?.ids?.length) return;
      try {
        await Promise.all(detail.ids.map((id) => apiJson(`/api/avatars/${id}`, { method: "DELETE" })));
        await load();
        onClearSelection();
        toast.success(`${detail.ids.length} ta avatar o'chirildi`);
      } catch (err: any) {
        toast.error(err.message);
      }
    };
    window.addEventListener("kk:confirm-delete", handler);
    return () => window.removeEventListener("kk:confirm-delete", handler);
  }, [load, onClearSelection]);

  const filtered = avatars.filter((a) => {
    if (activeGroup !== "all" && a.groupId !== activeGroup) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.shortName || "").toLowerCase().includes(q)
    );
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

  return (
    <div className="space-y-4">
      {/* Groups filter / management */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={activeGroup === "all" ? "default" : "outline"}
          onClick={() => setActiveGroup("all")}
        >
          Barchasi ({avatars.length})
        </Button>
        {groups.map((g) => (
          <Button
            key={g.id}
            size="sm"
            variant={activeGroup === g.id ? "default" : "outline"}
            onClick={() => setActiveGroup(g.id)}
          >
            {g.name} ({g._count?.avatars || 0})
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setShowCreateGroup(true)}>
          <Plus className="w-4 h-4" /> Guruh
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-gradient items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">Avatarlar yo'q</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Testlar uchun odamlar qo'shing — ism + rasm yoki professional ikonka
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Avatar qo'shish
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((a) => {
            const isSelected = selectedIds.includes(a.id);
            const Icon = getIcon(a.iconName);
            const isDemo = (a as any).isDemo === true;
            return (
              <Card
                key={a.id}
                className={`relative p-3 transition-all ${
                  isDemo
                    ? "opacity-90 cursor-default"
                    : "cursor-pointer hover:shadow-md"
                } ${isSelected ? "ring-2 ring-ring" : ""}`}
                onClick={() => {
                  if (isDemo && mode !== null) {
                    toast.error("Demo avatarni o'zgartirib bo'lmaydi");
                    return;
                  }
                  if (isDemo) return; // demo avatars are read-only
                  if (mode === "edit") {
                    setEditingAvatar(a);
                    onClearSelection();
                  } else if (mode === "delete") {
                    toggleSelect(a.id);
                  } else {
                    setEditingAvatar(a);
                  }
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
                    {a.photoUrl ? (
                      <img src={a.photoUrl} alt={a.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium truncate w-full">
                      {a.shortName || a.name}
                    </div>
                    {a.shortName && a.shortName !== a.name && (
                      <div className="text-[10px] text-muted-foreground truncate w-full">
                        {a.name}
                      </div>
                    )}
                    <div className="flex items-center gap-1 justify-center mt-1 flex-wrap">
                      {a.group && (
                        <Badge variant="outline" className="text-[9px]">
                          {a.group.name}
                        </Badge>
                      )}
                      {isDemo && (
                        <Badge className="text-[8px] bg-brand-lime/20 text-brand-lime border border-brand-lime/30">
                          2AF1
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center">
                    ✓
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <AvatarDialog
          groups={groups}
          onClose={() => setShowCreate(false)}
          onSaved={async () => {
            setShowCreate(false);
            await load();
          }}
        />
      )}
      {editingAvatar && (
        <AvatarDialog
          avatar={editingAvatar}
          groups={groups}
          onClose={() => setEditingAvatar(null)}
          onSaved={async () => {
            setEditingAvatar(null);
            await load();
          }}
        />
      )}
      {showCreateGroup && (
        <GroupDialog
          onClose={() => setShowCreateGroup(false)}
          onSaved={async () => {
            setShowCreateGroup(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function AvatarDialog({
  avatar,
  groups,
  onClose,
  onSaved,
}: {
  avatar?: AvatarData;
  groups: GroupData[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(avatar?.name || "");
  const [shortName, setShortName] = useState(avatar?.shortName || "");
  const [photoUrl, setPhotoUrl] = useState(avatar?.photoUrl || "");
  const [iconName, setIconName] = useState(avatar?.iconName || "user");
  const [groupId, setGroupId] = useState(avatar?.groupId || "none");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useIcon, setUseIcon] = useState(!avatar?.photoUrl);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiJson<{ url: string }>("/api/upload", { method: "POST", body: fd });
      setPhotoUrl(res.url);
      setUseIcon(false);
      toast.success("Rasm yuklandi");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (name.trim().length < 1) {
      toast.error("Ism majburiy");
      return;
    }
    if (!useIcon && !photoUrl) {
      toast.error("Rasm yoki ikonka tanlang");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        shortName,
        photoUrl: useIcon ? null : photoUrl,
        iconName: useIcon ? iconName : null,
        groupId: groupId === "none" ? null : groupId,
      };
      if (avatar) {
        await apiJson(`/api/avatars/${avatar.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiJson("/api/avatars", { method: "POST", body: JSON.stringify(body) });
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
    if (!avatar) return;
    if (!confirm("O'chirilsinmi?")) return;
    setSaving(true);
    try {
      await apiJson(`/api/avatars/${avatar.id}`, { method: "DELETE" });
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {avatar ? "Avatarni tahrirlash" : "Yangi avatar qo'shish"}
          </DialogTitle>
          <DialogDescription>
            Testlarda ovoz berish uchun odam — ism va rasm yoki professional ikonka
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Preview */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-secondary border-2 border-border flex items-center justify-center">
              {!useIcon && photoUrl ? (
                <img src={photoUrl} alt="preview" className="w-full h-full object-cover" />
              ) : (
                (() => {
                  const Ic = getIcon(iconName);
                  return <Ic className="w-8 h-8 text-muted-foreground" />;
                })()
              )}
            </div>
          </div>

          {/* Toggle: photo vs icon */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant={!useIcon ? "default" : "outline"}
              onClick={() => setUseIcon(false)}
            >
              <Upload className="w-4 h-4 mr-1" /> Rasm
            </Button>
            <Button
              type="button"
              size="sm"
              variant={useIcon ? "default" : "outline"}
              onClick={() => setUseIcon(true)}
            >
              <Sparkles className="w-4 h-4 mr-1" /> Ikonka
            </Button>
          </div>

          {!useIcon && (
            <div className="space-y-2">
              <Label>Rasm yuklash</Label>
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
              />
              {uploading && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Yuklanmoqda...
                </div>
              )}
            </div>
          )}

          {useIcon && (
            <div className="space-y-2">
              <Label>Professional ikonka</Label>
              <div className="grid grid-cols-5 gap-2">
                {PROFESSIONAL_ICONS.map((p) => {
                  const Ic = p.icon;
                  const active = iconName === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setIconName(p.name)}
                      title={p.label}
                      className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 p-1 transition ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Ic className="w-5 h-5" />
                      <span className="text-[9px] text-muted-foreground">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>To'liq ism</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label>Qisqa ism</Label>
              <Input value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={40} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Guruh</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Guruh tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Guruh yo'q —</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          {avatar && (
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

function GroupDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("A");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 1) {
      toast.error("Guruh nomi majburiy");
      return;
    }
    setSaving(true);
    try {
      await apiJson("/api/groups", { method: "POST", body: JSON.stringify({ name, color }) });
      toast.success("Guruh yaratildi ✅");
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
          <DialogTitle>Yangi guruh</DialogTitle>
          <DialogDescription>
            Avatarlarni guruhlarga ajratishingiz mumkin (A/B guruh kabi)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nomi</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="A guruh" />
          </div>
          <div className="space-y-2">
            <Label>Belgisi (rang tag)</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} maxLength={20} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Bekor</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Yaratish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
