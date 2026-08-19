// app/api/extension/state/route.ts
//
// GET /api/extension/state — что показать на /extension.
// Proxy в backend (или локальный mock, см. lib/extension-store.ts).
//
// CORS открыт: расширение дёргает state из Options/Popup (chrome-extension:// origin),
// и без Access-Control-Allow-Origin браузер режет ответ с TypeError: Failed to fetch.
// Ingest-роут уже отдаёт CORS, этот — теперь тоже.

import { NextResponse } from "next/server"
import { store } from "@/lib/extension-store"

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Extension-Key",
  "Access-Control-Max-Age": "86400",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  const state = await store.state()
  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "no-store",
      ...CORS,
    },
  })
}
