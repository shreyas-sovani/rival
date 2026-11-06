import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import type { ReactNode } from "react";

import { DISCLAIMER_BANNER } from "../content/disclaimers";
import { testIds } from "../testids.ts";
import { routes } from "../viewmodels/routes.ts";

import "./globals.css";

const display = localFont({
  src: "../../public/fonts/source-serif-4-latin-400-normal.woff2",
  variable: "--font-display",
  weight: "400",
  display: "swap",
});

const text = localFont({
  src: "../../public/fonts/source-sans-3-latin-400-normal.woff2",
  variable: "--font-text",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rival",
  description: "A testnet intent auction prototype.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${display.variable} ${text.variable}`} lang="en">
      <body>
        <header className="site-header" data-testid={testIds.header}>
          <Link className="wordmark" href="/">
            Rival
          </Link>
          <nav aria-label="Primary navigation" className="primary-nav" data-testid={testIds.nav}>
            {routes
              .filter(route => route.nav)
              .map(route => (
                <Link href={route.path} key={route.path}>
                  {route.title}
                </Link>
              ))}
          </nav>
        </header>
        <aside className="disclaimer" data-testid={testIds.disclaimer} role="note">
          {DISCLAIMER_BANNER}
        </aside>
        {children}
        <footer className="site-footer" data-testid={testIds.footer}>
          Rival · intent auctions on testnet
        </footer>
      </body>
    </html>
  );
}
