import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import "./globals.css";

const alsAgro = localFont({
  src: [
    { path: "../public/brand/ALSAgrofont-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/brand/ALSAgrofont-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/brand/ALSAgrofont-Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/brand/ALSAgrofont-BoldExpanded.ttf", weight: "800", style: "normal" },
    { path: "../public/brand/ALSAgrofont-Black.ttf", weight: "900", style: "normal" }
  ],
  variable: "--font-display",
  display: "swap"
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "7secure | Daily cybersecurity briefing",
  description: "A modern cybersecurity and AI newsletter with articles, practices, and tools.",
  icons: {
    icon: "/brand/Small_Icon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${alsAgro.variable} ${jetBrainsMono.variable}`}>
        <Header />
        <main className="container">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
