import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppToastRegion } from "@/components/ui/toast";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

/* Одно семейство на весь интерфейс: Cal Sans 2.0 variable. DM Sans и
   Geist Mono сняты — Cal Sans покрывает и то и другое, и не покрывает
   только реальный моноширинный грид (его у Cal Sans нет, и для id/JSON
   принят пропорциональный шрифт с tabular-nums — лучшее, что есть без
   отдельного моно-семейства).

   Пять осей из одного файла (~247 КБ woff2):
     opsz  8–45  optical size  — адаптация рисунка буквы под кегль
     GEOM  0–100 geometric form — 0 a11y / 25 ui-default / 50 brand / 100 geo
     wght  400–700 weight      — реальная лестница, не Faux Bold
     YTAS  720–800 ascenders    — высота прописных, не влияет на line-height
     SHRP  0–100 sharpness      — острые углы, FUTURA-look

   «Разнообразие» в этом файле — комбинации этих осей. body идёт в UI-нейтрали
   (opsz 14, GEOM 25, wght 400), заголовки — в Cal Sans brand (opsz 45, GEOM 50,
   wght 600), 11-пиксельные подписи — в micro (opsz 8). Все вариации берёт
   браузер из одного файла через `font-variation-settings`, без сетевых
   запросов на каждое начертание.

   `font-optical-sizing: auto` в globals.css включает автоподстройку opsz
   по отображаемому кеглю — крупная метрика получает opsz ближе к 45, мелкая
   подпись — к 8, без отдельных CSS-правил на каждый размер. Без неё оси
   остаются явными (`font-variation-settings`), но «магия» не работает.

   next/font/local инлайнит woff2 в CSS при build — Vercel отдаёт его
   с Next-сервера, отдельный хостинг / CORS не нужны. */
const calSans = localFont({
  variable: "--font-cal-sans",
  display: "swap",
  src: "./fonts/CalSansVF.woff2",
});

export const metadata: Metadata = {
  title: "Obelista",
  description: "Bundle builder for bulk Facebook ad uploads",
  applicationName: "Obelista",
  // Ярлык на домашнем экране: без этого iOS берёт <title> и режет его многоточием.
  appleWebApp: { capable: true, title: "Obelista", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  // Светлая/тёмная — чтобы строка статуса iOS не спорила с фоном страницы.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0d" },
  ],
  // Панель — рабочий инструмент в одну колонку: автозум при фокусе на поле только мешает.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* Тема лежит в zustand-persist ("zaliv-panel-v2"), а он читается только после
   гидрации — до неё страница успела бы моргнуть чужой темой. Этот скрипт
   выполняется синхронно в <head>, до первой отрисовки, и ставит атрибут сам.
   Дефолт — светлая (белая база). Ошибки глушим: приватный режим/битый JSON
   не должны валить страницу.

   Акцента здесь больше нет: он один и зашит в `:root`. */
const NO_FLASH = `(()=>{try{
  var s=JSON.parse(localStorage.getItem("zaliv-panel-v2")||"{}").state||{};
  var t=s.theme==="dark"?"dark":"light", e=document.documentElement;
  e.dataset.theme=t; e.classList.toggle("dark",t==="dark");
}catch(_){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={calSans.variable}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>
        {/* Оболочка живёт в layout: при переходе между листами она не
            размонтируется, поэтому поллинг снапшота не перезапускается. */}
        <AppShell>{children}</AppShell>
        <AppToastRegion />
      </body>
    </html>
  );
}
