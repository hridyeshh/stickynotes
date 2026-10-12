import type { Metadata } from "next";
import { Caveat, Cormorant_Garamond, Lora } from "next/font/google";
import { SignedInFlag } from "@/components/signed-in";
import { SIGNED_IN_COOKIE } from "@/lib/session";
import "./classical.css";
import "./site.css";

// Self-hosted at build time, so visitors' browsers never call Google Fonts.
const heading = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-cormorant" });
const body = Lora({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-lora" });
// The margin-note handwriting (.hand), on the landing page and the app alike.
const hand = Caveat({ subsets: ["latin"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "stickynotes",
  description: "Select a passage on any page and keep it as a note, filed under its topic with every source listed.",
};

// Public pages are static, the same for everyone, so their header carries links for both cases and CSS shows one
// (.when-in / .when-out in site.css). This marks <html> before the first paint; SignedInFlag keeps it right after.
const markSignedIn = `document.documentElement.toggleAttribute("data-signed-in",document.cookie.split("; ").includes("${SIGNED_IN_COOKIE}=1"))`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The script adds an attribute React didn't render.
    <html lang="en" className={`${heading.variable} ${body.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: markSignedIn }} />
      </head>
      <body>
        {children}
        <SignedInFlag />
      </body>
    </html>
  );
}
