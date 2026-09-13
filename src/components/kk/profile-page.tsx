"use client";

import { useState, useEffect } from "react";
import { apiJson } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Upload,
  LogOut,
  Mail,
  Phone,
  Camera,
  Calendar,
} from "lucide-react";
import type { KKUser } from "@/app/page";

export function ProfilePage({
  user,
  onLogout,
  onUserUpdated,
}: {
  user: KKUser;
  onLogout: () => void;
  onUserUpdated?: (updated: KKUser) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || user.telegramPhoto || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setAvatarUrl(user.avatarUrl || user.telegramPhoto || "");
  }, [user]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiJson<{ url: string }>("/api/upload", { method: "POST", body: fd });
      setAvatarUrl(res.url);
      toast.success("Rasm yangilandi");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await apiJson<KKUser>("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ firstName, lastName, avatarUrl }),
      });
      toast.success("Profil saqlandi ✅");
      // Notify parent component to update state (triggers re-render)
      if (onUserUpdated) onUserUpdated(updated);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const initials =
    (user.firstName?.[0] || "") + (user.lastName?.[0] || "") ||
    user.email?.[0] ||
    "?";

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Profile header card */}
      <Card className="p-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-brand-gradient flex items-center justify-center text-white text-3xl font-bold">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initials.toUpperCase()
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-lg">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
              />
            </label>
          </div>
        </div>
        <div>
          <h2 className="font-bold text-xl">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.telegramName ||
              "Foydalanuvchi"}
          </h2>
          {user.email && (
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Mail className="w-3 h-3" /> {user.email}
            </p>
          )}
          {user.telegramName && (
            <Badge variant="secondary" className="mt-2 gap-1">
              <Phone className="w-3 h-3" /> Telegram: @{user.telegramName}
            </Badge>
          )}
        </div>
      </Card>

      {/* Edit profile form */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Ma'lumotlarni tahrirlash</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Ism</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-2">
            <Label>Familiya</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} />
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Saqlash
        </Button>
      </Card>

      {/* Stats / extra info */}
      <Card className="p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Hisob yaratildi</span>
          {/* No createdAt from initial load — show placeholder */}
          <span className="ml-auto">—</span>
        </div>
        {user.telegramId && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>Telegram ID</span>
            <span className="ml-auto font-mono text-xs">{user.telegramId}</span>
          </div>
        )}
      </Card>

      <Button variant="destructive" onClick={onLogout} className="w-full">
        <LogOut className="w-4 h-4 mr-2" /> Tizimdan chiqish
      </Button>
    </div>
  );
}
