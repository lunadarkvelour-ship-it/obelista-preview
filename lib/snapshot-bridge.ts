"use client";

/* Клиент моста снапшота (расширение browser_ext/snapshot_bridge).
 *
 * Панель живёт на сервере и локальный data/ui_snapshot.json прочитать не может.
 * Расширение читает его на машине оператора и отдаёт странице через
 * window.postMessage — здесь вторая половина этого разговора.
 *
 * Моста может не быть вовсе (чужой браузер, не поставлено) — тогда всё
 * продолжает работать через /api/snapshot, просто раз в 10 минут, а не в минуту.
 */

import type { Snapshot } from "./types";
import { snapshotIdentity } from "./snapshot";

export interface BridgeState {
  /** Расширение ответило хотя бы раз. */
  present: boolean;
  ok: boolean;
  readAt: number;
  generatedAt: string;
  /** Что именно прочитало расширение: файл или локальный сервер. */
  source: string;
  provider: string;
  revision: string;
  error: string;
}

export const EMPTY_BRIDGE: BridgeState = {
  present: false, ok: false, readAt: 0, generatedAt: "", source: "",
  provider: "", revision: "", error: "",
};

interface Incoming {
  laundry?: string;
  ok?: boolean;
  changed?: boolean;
  snapshot?: Snapshot | null;
  generatedAt?: string;
  readAt?: number;
  source?: string;
  error?: string;
}

/** Подписаться на мост. onState зовётся на каждый ответ расширения;
 *  snapshot приходит только когда он реально поменялся. */
export function createBridge(
  onState: (state: BridgeState, snapshot: Snapshot | null) => void
): { poll: () => void; dispose: () => void } {
  if (typeof window === "undefined") {
    return { poll: () => {}, dispose: () => {} };
  }

  const post = (laundry: string) => {
    try {
      window.postMessage({ laundry }, window.location.origin);
    } catch {
      /* пустой origin в about:blank — моста там всё равно нет */
    }
  };

  const onMessage = (e: MessageEvent) => {
    if (e.source !== window) return;
    const m = e.data as Incoming | null;
    if (!m || (m.laundry !== "state" && m.laundry !== "ready")) return;
    if (m.laundry === "ready") {
      // Расширение объявилось раньше, чем панель успела спросить.
      post("hello");
      return;
    }
    onState(
      {
        present: true,
        ok: !!m.ok,
        readAt: m.readAt || 0,
        generatedAt: m.generatedAt || "",
        source: m.source || "",
        provider: snapshotIdentity(m.snapshot || null)?.provider || "",
        revision: snapshotIdentity(m.snapshot || null)?.revision || "",
        error: m.error || "",
      },
      m.snapshot || null
    );
  };

  window.addEventListener("message", onMessage);
  post("hello");

  return {
    poll: () => post("poll"),
    dispose: () => window.removeEventListener("message", onMessage),
  };
}
