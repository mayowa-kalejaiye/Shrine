import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Instrument_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  subsets: ["latin"],
});

// My pick: Instrument Sans - same family as the headline serif, but neo-grotesque.
// Why not Space Grotesk? Space is geometric/bubbly — too friendly/playful for "a place to die".
// VOID needs clinical, quiet, slightly institutional — like a hospital form you confess on.
// Instrument Sans is neutral, a bit narrow, pairs perfectly with Instrument Serif, feels premium
// and confessional without trying to be quirky. Geist would be second choice, but this is more coherent.
const instrumentSans = Instrument_Sans({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400","500","600"],
});

export const metadata: Metadata = {
  title: "SHRINE — a world map of memories",
  description: "Pin a memory where it happened. One photo, one line, one coordinate. A world museum of memories.",
  openGraph: {
    title: "SHRINE — a world map of memories",
    description: "Where did this memory happen? Pin it on a real globe. 500+ memories, every continent.",
    url: "https://shrine-map.vercel.app",
    siteName: "SHRINE",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SHRINE — world map of memories" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SHRINE — a world map of memories",
    description: "Where did this memory happen? Pin it on a real globe.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${instrumentSans.variable} antialiased bg-[#0a0a0b] text-white selection:bg-[#ff3b30]/30`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
