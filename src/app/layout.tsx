import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppDataProvider } from "@/hooks/use-app-data";
import "./globals.css";

// The Tailwind theme maps `font-sans` to `--font-sans`, so the loaded font has
// to publish itself under that name.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A warmer, more characterful face for headings only — keeps the app's
// generous white/sage surfaces from reading as a generic dashboard template.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal"],
});

export const metadata: Metadata = {
  title: "Fluent — Speech Therapy Practice",
  description:
    "Build a daily speech therapy habit with guided breathing, reading and speaking exercises.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#171d26" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <AppDataProvider>{children}</AppDataProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
