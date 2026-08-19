// app/api/extension/state/route.ts
//
// GET /api/extension/state — что показать на /extension.
// Proxy в backend (или локальный mock, см. lib/extension-store.ts).

import { NextResponse } from "next/server"
import { store } from "@/lib/extension-store"

export const dynamic = "force-dynamic"

export async function GET() {
  const state = await store.state()
  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
