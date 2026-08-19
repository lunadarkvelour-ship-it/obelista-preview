"use client";

/* Текст, который уезжает в Claude Desktop, и копирование в буфер.
 * Вынесено из OutputPanel: то же самое копирует полоска-итог на /launch,
 * а две реализации разошлись бы на первой же правке хвоста. */

import type { BuiltBundle } from "./build-spec";

export type OutputTab = "txt" | "json";

export function outputText(built: BuiltBundle, tab: OutputTab): string {
  if (tab === "json") {
    return JSON.stringify(built.specs.length === 1 ? built.specs[0] : built.specs, null, 2);
  }
  const tail = `\n\nСначала plan_upload и покажи мне план${
    built.texts.length > 1 ? " по КАЖДОЙ связке" : ""
  }. После моего «го» — execute_upload, следи через job_status.`;
  return built.texts.join("\n\n") + tail;
}

/** Буфер обмена. В незащищённом контексте (http на телефоне) navigator.clipboard
 *  отсутствует — падаем на старый execCommand, иначе кнопка просто не работает. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* ниже запасной путь */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* совсем нет буфера — молчим, пользователь выделит руками */
  }
  document.body.removeChild(ta);
}
