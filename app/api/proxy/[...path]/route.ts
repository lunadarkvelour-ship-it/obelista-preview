import { proxyFetch } from "@/lib/api";
import { NextRequest } from "next/server";

/* Catch-all прокси: GET /api/proxy/accounts → app.obelista.com/accounts.
 * Только для чтения. В проде это даст живые данные; без env — моки. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const tail = req.nextUrl.search ?? "";
  const upstream = "/" + (path?.join("/") ?? "") + tail;
  return proxyFetch(upstream, { method: "GET" });
}
