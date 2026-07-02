import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MatchHighlightProvider } from "@/modules/ledger/context/MatchHighlightContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Payment Reconciliation Dashboard",
  description: "Bank transaction to contract reconciliation tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ka"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper">
        <QueryProvider>
          <MatchHighlightProvider>
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-6 sm:flex-row">
                <AppSidebar />
                <main className="min-w-0 flex-1">{children}</main>
              </div>
            </div>
          </MatchHighlightProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
