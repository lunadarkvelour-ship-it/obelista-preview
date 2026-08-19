// app/api/extension/ingest/route.ts
//
// POST /api/extension/ingest — proxy в obelista_mcp backend.
//
// CORS открыт: расширение шлёт с любого origin (facebook.com, business.facebook.com,
// adsmanager.facebook.com). Без CORS браузер не отправит. В проде это нормально
// потому что ingest ВСЕГДА публичный (extension key авторизует), а не cookie-
// авторизация.
//
// Валидация: пропускаем всё что не type in {"token","adsmanager_state"} и
// отдаём 400. Полная JSON-schema валидация — позже, когда стабилизируется формат.

import { NextRequest, NextResponse } from "next/server"
import { store } from "@/lib/extension-store"
import type { IngestType, IngestRequest } from "@/lib/extension-types"

const ALLOWED: ReadonlySet<IngestType> = new Set<IngestType>(["token", "adsmanager_state"])

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Extension-Key",
  "Access-Control-Max-Age": "86400",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  let body: IngestRequest
  try {
    body = (await req.json()) as IngestRequest
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400, headers: CORS })
  }
  if (!body || !ALLOWED.has(body.type) || !body.fb_user_id || !body.captured_at || !body.payload) {
    return NextResponse.json(
      { ok: false, error: "invalid request: need type, fb_user_id, captured_at, payload" },
      { status: 400, headers: CORS },
    )
  }
  const result = await store.record(body)
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "store rejected" },
      { status: 502, headers: CORS },
    )
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 200, headers: CORS })
}
