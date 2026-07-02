"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface MatchHighlightContextValue {
  /** Non-null for ~10s right after a match posts new journal entries. */
  journalHighlightCount: number | null;
  /** Call with the newly-matched count (> 0 only) right after a match succeeds. */
  notifyPosted: (count: number) => void;
}

const MatchHighlightContext = createContext<MatchHighlightContextValue | null>(
  null,
);

/**
 * Shared home for the "N transactions just matched" signal.
 *
 * This used to be local state inside LedgerSidebar, back when
 * LedgerSidebar rendered both LedgerMatchButton and LedgerNav itself.
 * Now that LedgerMatchButton lives in each ledger page's own header
 * (same position as RunMatchingButton on /reconciliation) instead of in
 * the sidebar, the button and LedgerNav's "+N" badge on
 * "ჟურნალის გატარებები" are siblings under app/layout.tsx rather than
 * parent/child — so the highlight state has to live above both of them,
 * here, provided once from the root layout.
 */
export function MatchHighlightProvider({ children }: { children: ReactNode }) {
  const [journalHighlightCount, setJournalHighlightCount] = useState<
    number | null
  >(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifyPosted = useCallback((count: number) => {
    setJournalHighlightCount(count);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // 10s, per the demo spec: long enough to notice, short enough that it
    // reads as "something just happened" rather than a permanent badge.
    timerRef.current = setTimeout(() => {
      setJournalHighlightCount(null);
    }, 10_000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <MatchHighlightContext.Provider
      value={{ journalHighlightCount, notifyPosted }}
    >
      {children}
    </MatchHighlightContext.Provider>
  );
}

export function useMatchHighlight(): MatchHighlightContextValue {
  const ctx = useContext(MatchHighlightContext);
  if (!ctx) {
    throw new Error(
      "useMatchHighlight must be used within MatchHighlightProvider (see src/app/layout.tsx)",
    );
  }
  return ctx;
}
