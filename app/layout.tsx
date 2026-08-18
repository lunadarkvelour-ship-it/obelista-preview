import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/* Geist Sans — основной sans, как в проде Obelista
 * (там --font-dm = DM Sans, но Geist имеет тот же характер: нейтральный
 * гротеск с хорошей кириллицей; и он же в superagentslabs, чьи приёмы мы
 * переиспользуем). Geist Mono — для ID, цифр, имён файлов. */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Obelista — превью новой панели",
  description: "Редизайн UI: медиатека, аналитика, аккаунты, кампании, интеграции",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
