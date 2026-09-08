import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { cn } from "@meridian/ui";
import { TooltipProvider } from "@meridian/ui/primitives/tooltip";

/**
 * Instrument Sans replaces Geist. Same discipline — a neutral grotesque built
 * for interfaces — but with terminals and a lowercase g that give a page title
 * some voice at display sizes, where Geist read as anonymous.
 */
const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MB Advertising — Daily Operating System",
  description: "What you need to do today, and how the department is doing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(sans.variable, GeistMono.variable)}>
      <body className="font-sans antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
