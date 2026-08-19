import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import localFont from "next/font/local";
import { AppToastRegion } from "@/components/ui/toast";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

/* Два семейства: DM Sans на весь интерфейс и Geist Mono на техническое.

   DM Sans — выбор владельца. Он вариативный, и это здесь не украшение: одна
   ось веса вместо четырёх статических начертаний даёт ровную лестницу
   400→500→600→700 без скачков плотности, а ось оптического размера (`opsz`)
   подтягивает начертание под кегль — крупные метрики и 11-пиксельные подписи
   в таблице получают разный рисунок буквы, а не один, растянутый на оба.

   Кириллицы в DM Sans нет ВООБЩЕ — ни в раздаче, ни у Google (latin и
   latin-ext). Поэтому он появился здесь только вместе с переводом интерфейса
   на английский; до перевода он свалил бы весь русский текст в системный
   шрифт. Появится русская локаль — сюда придётся вернуться.

   Futura PT убрана из текста: заголовки теперь тем же DM Sans, разница между
   уровнями держится кеглем и весом, а не сменой семейства. Вордмарк в шапке
   рисованный и от шрифта не зависит.

   Техническое — Geist Mono. Идентификаторы, JSON и шаблоны нейминга обязаны
   стоять по сетке целиком, а не только цифрами: `act_1769335884224328` и
   `hiu/7--[GEO]--[ACT]` в пропорциональном шрифте не читаются.

   `next/font/google` скачивает шрифт при СБОРКЕ и раздаёт со своего домена:
   панель по-прежнему открывается офлайн, к Google на лету никто не ходит. */
const sans = DM_Sans({
  variable: "--font-dm",
  display: "swap",
  subsets: ["latin"],
  // Обе оси явно: без `opsz` Next возьмёт только вес, и вариативность
  // выродится в обычный шрифт с одной ступенью.
  axes: ["opsz"],
});
const mono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    { path: "../public/fonts/GeistMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/GeistMono-Medium.woff2", weight: "500", style: "normal" },
  ],
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
      className={`${sans.variable} ${mono.variable}`}
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
