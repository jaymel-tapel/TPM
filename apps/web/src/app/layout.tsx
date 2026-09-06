import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { cn } from "@meridian/ui";
import { TooltipProvider } from "@meridian/ui/primitives/tooltip";

export const metadata: Metadata = {
  title: "Meridian — Daily Operating System",
  description: "What you need to do today, and how the department is doing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(GeistSans.variable, GeistMono.variable)}>
      <body className="font-sans antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
