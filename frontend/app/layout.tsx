import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Silkscreen } from "next/font/google";

import { WorkspaceFrame } from "@/components/workspace-frame";

import "./globals.css";

const sansFont = Inter({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const pixelFont = Silkscreen({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "PIXY TERMINAL",
  description: "Hermes Agent dashboard for chat, memory, and skill growth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sansFont.variable} ${monoFont.variable} ${pixelFont.variable} antialiased`}
      >
        <WorkspaceFrame>{children}</WorkspaceFrame>
      </body>
    </html>
  );
}
