import type { MetadataRoute } from "next";

// Ярлык с домашнего экрана открывается как standalone-приложение: без адресной
// строки Safari экран короче на ~100px, а нижняя панель перестаёт прыгать.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Obelista",
    short_name: "Obelista",
    description: "Bundle builder for bulk Facebook ad uploads",
    start_url: "/",
    display: "standalone",
    background_color: "#151517",
    theme_color: "#151517",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
