import { COOKIE_NAME } from "@shared/const";
import { countActiveChats, countTelegramUsers } from "./db";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  bot: router({
    status: publicProcedure.query(async () => ({
      configured: Boolean(ENV.telegramBotToken),
      webhookPath: "/api/telegram/webhook",
      users: await countTelegramUsers(),
      activeChats: await countActiveChats(),
    })),
  }),
});

export type AppRouter = typeof appRouter;
