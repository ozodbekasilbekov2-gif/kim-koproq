import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, isValidEmail, isStrongEnoughPassword } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName } = body;
    if (!email || !password) {
      return NextResponse.json({ error: "Email va parol majburiy" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email noto'g'ri formatda" }, { status: 400 });
    }
    if (!isStrongEnoughPassword(password)) {
      return NextResponse.json({ error: "Parol kamida 6 ta belgidan iborat bo'lsin" }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "Bu email allaqachon ro'yxatdan o'tgan" }, { status: 409 });
    }
    const hash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: hash,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
      },
    });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (e: any) {
    console.error("[register] error:", e);
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
