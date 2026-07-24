import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";
import { ACCENT_COOKIE_NAME, accentForeground, normalizeAccentColor } from "@/lib/accent";
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
  title: "Joint",
  description: "A shared household money workspace.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const accent = normalizeAccentColor((await cookies()).get(ACCENT_COOKIE_NAME)?.value);
  const accentStyle = {
    "--primary": accent,
    "--primary-foreground": accentForeground(accent),
    "--ring": accent,
    "--chart-1": accent,
    "--accent": `color-mix(in srgb, ${accent} 12%, white)`,
    "--sidebar-primary": accent,
    "--sidebar-primary-foreground": accentForeground(accent),
    "--sidebar-ring": accent,
  } as React.CSSProperties;

  return (
    <html
      lang="en"
      style={accentStyle}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
