import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "./classical.css";
import "./site.css";

// Self-hosted at build time, so visitors' browsers never call Google Fonts.
const heading = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-cormorant" });
const body = Lora({ subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"], variable: "--font-lora" });

export const metadata: Metadata = {
  title: "stickynotes",
  description: "Select a passage on any page and keep it as a note, filed under its topic with every source listed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
