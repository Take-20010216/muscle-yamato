import type { Metadata, Viewport } from "next";
import { Bangers } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AuthGuard from "@/components/AuthGuard";

const bangers = Bangers({ subsets: ["latin"], weight: "400", variable: "--font-display" });

const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : null;

export const metadata: Metadata = {
  title: "MUSCLE YAMATO",
  description: "筋トレ記録アプリ",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MUSCLE YAMATO" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={bangers.variable}>
      <head>
        {SUPABASE_ORIGIN && (
          <>
            <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="" />
            <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
          </>
        )}
      </head>
      <body className="min-h-screen bg-bg text-ink">
        <AuthGuard>
          <div className="max-w-md mx-auto pb-24">{children}</div>
          <BottomNav />
        </AuthGuard>
      </body>
    </html>
  );
}
