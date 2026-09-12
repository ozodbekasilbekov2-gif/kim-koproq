import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kim ko'proq...? — 2AF1 so'rovi",
  description: "2AF1 guruhi uchun qiziqarli so'rov. Kim ko'proq...? — Telegram Mini App bilan sinxron.",
  keywords: ["kim koproq", "2AF1", "test", "so'rov", "telegram", "mini app"],
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Kim ko'proq...?",
    description: "2AF1 guruh so'rovi — Telegram Mini App bilan sinxron",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        {/* Telegram Mini App SDK */}
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased bg-background text-foreground`}
      >
        {/* Background glow — original Kim Ko'proq vibe */}
        <div className="bg-glow" />
        <div className="relative z-10">
          <Providers>{children}</Providers>
        </div>
        <Toaster />
        <SonnerToaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  );
}
