"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AUTH_PAGES = ["/login", "/signup"];

// 静的書き出し(SPA)版の認証ガード。
// ミドルウェアの代わりにクライアント側でセッションを確認し、
// 未ログインなら /login へ、ログイン済みで認証ページにいたら / へ誘導する。
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    function route(hasSession: boolean) {
      const onAuthPage = AUTH_PAGES.includes(pathname);
      if (!hasSession && !onAuthPage) {
        router.replace("/login");
        return false;
      }
      if (hasSession && onAuthPage) {
        router.replace("/");
        return false;
      }
      return true;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const ok = route(!!session);
      setReady(ok);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      route(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // 認証ページはそのまま表示（ガード不要）
  if (AUTH_PAGES.includes(pathname)) return <>{children}</>;

  // セッション確認中はスピナー（リダイレクト中のチラつき防止）
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
