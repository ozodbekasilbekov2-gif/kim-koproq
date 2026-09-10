import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Bot, Check, LockKeyhole, MessageCircle, Radio, ShieldCheck, Sparkles } from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "Анонимный диалог",
    text: "Собеседники видят только сообщения друг друга. Telegram ID и username не передаются автоматически.",
  },
  {
    icon: LockKeyhole,
    title: "История — под контролем",
    text: "Названия чатов персональные: их видит только тот, кто их придумал. Удаление закрывает чат для пользователя.",
  },
  {
    icon: ShieldCheck,
    title: "Односторонний контакт",
    text: "Кнопка «Представить контакты» отправляет только ваш публичный username и не раскрывает контакт собеседника.",
  },
];

export default function Home() {
  const status = trpc.bot.status.useQuery(undefined, { refetchInterval: 15_000 });

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fc] text-slate-950">
      <div className="absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(circle_at_18%_0%,#dfe8ff_0%,rgba(247,248,252,0)_52%),radial-gradient(circle_at_84%_10%,#d8f5ec_0%,rgba(247,248,252,0)_48%)]" />
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:py-10">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300">
              <Bot className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Анонимные чаты</p>
              <p className="text-xs text-slate-500">Telegram community layer</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-2 rounded-full border-emerald-200 bg-white/70 px-3 py-1.5 text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Serverless-ready
          </Badge>
        </nav>

        <section className="grid items-center gap-12 pb-16 pt-20 lg:grid-cols-[1.04fr_.96fr] lg:pb-24 lg:pt-28">
          <div>
            <Badge className="mb-6 rounded-full bg-indigo-100 px-3 py-1 text-indigo-700 hover:bg-indigo-100">
              <Sparkles className="mr-1.5 size-3.5" />
              Мягкое знакомство без давления
            </Badge>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
              Разговор начинается с <span className="text-indigo-600">анонимности.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
              Бот помогает найти нового собеседника, сохранить разговор в личной истории и раскрыть контакт только тогда, когда вы сами к этому готовы.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button className="h-12 rounded-xl bg-slate-950 px-5 text-base hover:bg-slate-800" asChild>
                <a href="https://t.me" target="_blank" rel="noreferrer">
                  Открыть Telegram <ArrowUpRight className="ml-2 size-4" />
                </a>
              </Button>
              <Button variant="outline" className="h-12 rounded-xl border-slate-300 bg-white/70 px-5 text-base" asChild>
                <a href="#how-it-works">Как это работает</a>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden rounded-[28px] border-white/80 bg-slate-950 text-white shadow-2xl shadow-indigo-200/40">
            <CardHeader className="border-b border-white/10 px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live control room</p>
                  <CardTitle className="mt-2 text-2xl tracking-tight">Состояние системы</CardTitle>
                </div>
                <Radio className="size-5 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8 sm:py-8">
              <StatusItem label="Telegram endpoint" value={status.data?.configured ? "Подключён" : "Ожидает токен"} active={status.data?.configured ?? false} />
              <StatusItem label="Webhook route" value={status.data?.webhookPath ?? "/api/telegram/webhook"} />
              <Metric label="Пользователи" value={status.data?.users ?? 0} />
              <Metric label="Активные чаты" value={status.data?.activeChats ?? 0} />
              <div className="col-span-full mt-2 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-slate-300">
                Токен хранится только на сервере. Сообщения проходят через базу данных и маршрутизируются между двумя Telegram-чатами без показа технических идентификаторов.
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="how-it-works" className="grid gap-4 border-t border-slate-200/80 py-16 sm:grid-cols-3">
          {features.map(feature => (
            <Card key={feature.title} className="rounded-3xl border-slate-200/80 bg-white/75 shadow-sm shadow-slate-200/50">
              <CardContent className="p-6">
                <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <feature.icon className="size-5" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{feature.text}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-8 rounded-[32px] bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-10 lg:grid-cols-[.9fr_1.1fr] lg:p-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">MVP flow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Три действия вместо сложного интерфейса</h2>
            <p className="mt-4 max-w-md leading-7 text-slate-600">Всё управление остаётся внутри Telegram. Эта страница нужна для состояния, документации и будущих настроек модерации.</p>
          </div>
          <div className="grid gap-3">
            <FlowStep number="01" title="Пообщаться" text="Бот ставит пользователя в очередь или сразу соединяет с ожидающим собеседником." />
            <FlowStep number="02" title="История чатов" text="Список возвращает к прежним диалогам; названия можно менять, а историю — удалять для себя." />
            <FlowStep number="03" title="Представить контакты" text="Одним нажатием отправляется только ваш публичный username. Решение остаётся односторонним." />
          </div>
        </section>

        <footer className="flex flex-col gap-3 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Анонимные чаты · MVP</span>
          <span className="flex items-center gap-2"><Check className="size-4 text-emerald-600" /> Privacy-first by design</span>
        </footer>
      </div>
    </main>
  );
}

function StatusItem({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
        {active && <span className="size-2 rounded-full bg-emerald-400" />}
        {value}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

function FlowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 p-4">
      <span className="pt-0.5 font-mono text-xs font-semibold text-indigo-600">{number}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}
