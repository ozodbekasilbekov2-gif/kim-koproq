import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-utils";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user || !user.passwordHash) return null;
        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email || undefined,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
          image: user.avatarUrl || undefined,
        };
      },
    }),
    // Telegram provider: receives signed initData from frontend, validates server-side
    {
      id: "telegram",
      name: "Telegram",
      type: "credentials",
      credentials: {
        initData: { label: "initData", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.initData) return null;
        const { validateTelegramInitData, normalizeBotToken } = await import("@/lib/telegram");
        const token = normalizeBotToken(process.env.TELEGRAM_BOT_TOKEN);
        if (!token) return null;
        const tgUser = validateTelegramInitData(credentials.initData, token);
        if (!tgUser) return null;

        // find or create user by telegramId
        let user = await db.user.findUnique({
          where: { telegramId: String(tgUser.id) },
        });
        if (!user) {
          user = await db.user.create({
            data: {
              telegramId: String(tgUser.id),
              telegramName: tgUser.username || tgUser.first_name,
              firstName: tgUser.first_name || null,
              lastName: tgUser.last_name || null,
              telegramPhoto: tgUser.photo_url || null,
            },
          });
        } else {
          // refresh info
          user = await db.user.update({
            where: { id: user.id },
            data: {
              telegramName: tgUser.username || tgUser.first_name || user.telegramName,
              firstName: tgUser.first_name || user.firstName,
              lastName: tgUser.last_name || user.lastName,
              telegramPhoto: tgUser.photo_url || user.telegramPhoto,
            },
          });
        }

        return {
          id: user.id,
          email: user.email || undefined,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.telegramName || undefined,
          image: user.avatarUrl || user.telegramPhoto || undefined,
        };
      },
    } as any,
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/?auth=login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.image = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).image = token.image;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-me-in-prod",
};

export async function getCurrentUser(req?: any) {
  // helper used in API routes
  const { getServerSession } = await import("next-auth");
  return await getServerSession(authOptions);
}
