"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Scale,
  Users,
  FileText,
  Building2,
  Boxes,
  UserRound,
  Receipt,
  Car,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const LIVE_ITEMS: NavItem[] = [
  { href: "/", label: "შეჯამება", icon: LayoutDashboard },
  { href: "/accounts", label: "ანგარიშთა გეგმა", icon: Wallet },
  { href: "/journal", label: "ჟურნალის გატარებები", icon: Scale },
];

// Not built on this branch — see docs/ARCHITECTURE.md section 2.3 for
// what each of these would need (a domain table + one adapter writing
// to financial_events, nothing more). Shown, disabled, so the roadmap
// this architecture is meant to support is visible on the page itself,
// not just in a doc.
const FUTURE_ITEMS: NavItem[] = [
  { href: "#", label: "მომხმარებლები", icon: Users },
  { href: "#", label: "გაყიდვის ინვოისები", icon: FileText },
  { href: "#", label: "მომწოდებლები", icon: Building2 },
  { href: "#", label: "შესყიდვის ინვოისები", icon: Receipt },
  { href: "#", label: "მარაგის ერთეულები", icon: Boxes },
  { href: "#", label: "თანამშრომლები", icon: UserRound },
  { href: "#", label: "ძირითადი აქტივები", icon: Car },
];

interface LedgerNavProps {
  /**
   * Non-null for ~10s right after LedgerMatchButton posts new journal
   * entries — see LedgerSidebar. Renders a pulsing "+N" badge on the
   * "ჟურნალის გატარებები" item so the effect of clicking match is visible
   * on the nav itself, not just on the page you happen to be viewing.
   */
  journalHighlightCount?: number | null;
}

export function LedgerNav({ journalHighlightCount }: LedgerNavProps = {}) {
  const pathname = usePathname();

  return (
    <nav className="w-full shrink-0 sm:w-56">
      <ul className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:gap-0.5 sm:overflow-visible">
        {LIVE_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const isJournal = item.href === "/journal";
          const highlighted = isJournal && !!journalHighlightCount;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-500",
                  isActive
                    ? "bg-ink text-paper-raised"
                    : "text-ink-muted hover:bg-paper hover:text-ink",
                  highlighted &&
                    !isActive &&
                    "bg-matched-bg text-matched ring-2 ring-matched/40 animate-pulse",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 whitespace-nowrap">{item.label}</span>
                {highlighted && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                      isActive
                        ? "bg-paper-raised/20 text-paper-raised"
                        : "bg-matched text-paper-raised",
                    )}
                  >
                    +{journalHighlightCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 hidden sm:block">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          მომავალი მოდულები
        </p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {FUTURE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <span className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted/50">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 whitespace-nowrap">
                    {item.label}
                  </span>
                  <Lock className="h-3 w-3 shrink-0" />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
