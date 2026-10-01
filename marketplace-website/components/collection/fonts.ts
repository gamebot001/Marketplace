import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

/**
 * Fonts for the collection detail surface. Declared once and shared by the
 * browse route and the per-item route so the same variables (and the same
 * preloaded files) apply to both.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const collectionFontVars =
  `${inter.variable} ${fraunces.variable} ${jetbrains.variable}`;
