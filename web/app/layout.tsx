import type { Metadata } from "next";
import Link from "next/link";

import { RunSelector } from "../components/run-selector";
import { getRuns } from "../lib/api";
import "./globals.css";


export const metadata: Metadata = {
  title: "Orange Treaty",
  description: "Orange juice supply chain negotiation simulator.",
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runsResult = await getRuns();
  const runs = runsResult.data ?? [];

  return (
    <html lang="en">
      <body>
        <div className="shell page">
          <header className="topbar">
            <Link className="brand" href="/">
              <span className="brand-orange" aria-hidden="true" />
              Orange Treaty
            </Link>
            <div className="topbar-tools">
              {runs.length > 0 ? <RunSelector runs={runs} variant="nav" /> : null}
              <nav className="nav">
                <Link href="/">Run Simulation</Link>
                <Link href="/runs">Runs</Link>
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
