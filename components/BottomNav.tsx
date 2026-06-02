"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "ホーム", icon: HomeIcon },
  { href: "/record", label: "記録", icon: RecordIcon },
  { href: "/community", label: "仲間", icon: CommunityIcon },
  { href: "/routine", label: "ルーティン", icon: RoutineIcon },
  { href: "/stats", label: "統計", icon: StatsIcon },
  { href: "/settings", label: "設定", icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-border z-50">
      <ul className="grid grid-cols-6 max-w-md mx-auto">
        {tabs.map((t) => {
          const active = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                prefetch={true}
                className={`flex flex-col items-center py-2 text-[10px] ${active ? "text-navy font-semibold" : "text-muted"}`}
              >
                <t.icon className="w-5 h-5 mb-0.5" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

function HomeIcon(p: any) { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>); }
function RecordIcon(p: any) { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>); }
function RoutineIcon(p: any) { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>); }
function CommunityIcon(p: any) { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/><path d="M18.5 14c2 .6 3.5 2 3.5 4.5"/></svg>); }
function StatsIcon(p: any) { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>); }
function SettingsIcon(p: any) { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>); }
