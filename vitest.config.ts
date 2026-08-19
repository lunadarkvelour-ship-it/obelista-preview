import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  /* Автоматический JSX-рантайм, как у Next. Без него любой компонент, отрисованный
     смотрелкой (`lib/__tests__/preview-*.test.ts`), падает на «React is not defined»:
     esbuild по умолчанию собирает JSX в React.createElement и требует импорт React в
     каждом файле, а Next этого не требует и код его не содержит. Чинить импортами в
     компонентах значило бы подгонять продукт под инструмент. */
  esbuild: { jsx: "automatic" },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
