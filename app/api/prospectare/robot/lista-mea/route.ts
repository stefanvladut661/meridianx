import { NextRequest } from "next/server";
import { z } from "zod";
import { rpc } from "@/lib/prospectare/db";
import { robotRoute } from "@/lib/prospectare/robot-api";

/**
 * /api/prospectare/robot/lista-mea — lista de construcție a terminalului (migrarea 39): firmele alocate lui din
 * admin („Alocă pentru construcție”), încă neconstruite, cu toate datele lor, de la scorul cel mai mare.
 *
 *   GET  /lista-mea?sesiune=stefan-1
 *   POST /lista-mea   { "sesiune": "stefan-1" }
 *      → { "ok": true, "sesiune": "stefan-1", "total": 12, "firme": [ { id, nr, nume, domeniu, …, date_extra, rezervare } ] }
 *
 * Terminalul e câmpul `sesiune` (același token pe tot calculatorul). Două terminale nu primesc niciodată aceeași
 * firmă: o firmă e alocată unui singur terminal. Firma construită și publicată (/termina) iese din listă.
 */

export const dynamic = "force-dynamic";

const POST_LISTA = robotRoute(z.object({}), async (robot) => {
  const result = await rpc<{ sesiune: string; total: number; firme: unknown[] }>("prospectare_lista_mea", { p_dispozitiv: robot.id, p_sesiune: robot.sesiune });
  if (!result.ok) return result;
  return { ok: true, data: { sesiune: result.data.sesiune, total: result.data.total, firme: result.data.firme } };
});

export const POST = POST_LISTA;

/** GET cu `?sesiune=`: aceeași cerere, cu sesiunea din adresă în loc de corp. */
export async function GET(request: NextRequest) {
  const sesiune = request.nextUrl.searchParams.get("sesiune");
  const corp = sesiune === null ? {} : { sesiune };
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return POST_LISTA(new NextRequest(request.url, { method: "POST", headers, body: JSON.stringify(corp) }));
}
