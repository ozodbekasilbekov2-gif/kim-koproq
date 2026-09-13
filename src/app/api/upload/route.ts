import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserDb } from "@/lib/session";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// POST /api/upload — handles multipart/form-data file upload
// Saves to /public/uploads/<uuid>.<ext>
// Returns { url: "/uploads/<uuid>.<ext>" }
// Max 8MB, accepts jpeg/png/webp/gif only.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserDb(req);
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fayl topilmadi" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Maksimal 8 MB" }, { status: 400 });
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Faqat rasm (jpg/png/webp/gif)" }, { status: 400 });
    }

    const ext = file.type.split("/")[1];
    const filename = `${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buf);
    const url = `/uploads/${filename}`;
    return NextResponse.json({ url });
  } catch (e: any) {
    console.error("[upload] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
