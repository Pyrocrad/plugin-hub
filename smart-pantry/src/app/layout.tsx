import type { Metadata, Viewport } from "next";
import "./globals.css";
import { HouseholdProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = { title: "Smart Pantry", description: "Jouw keuken, met een persoonlijke chef die ze kent.", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#15803d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <RegisterSW />
        <HouseholdProvider>
          <AppShell>{children}</AppShell>
        </HouseholdProvider>
      </body>
    </html>
  );
}
