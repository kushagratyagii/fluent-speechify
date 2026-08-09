import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <AppDataProvider>{children}</AppDataProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
