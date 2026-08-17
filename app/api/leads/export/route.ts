import { type NextRequest } from "next/server";
import { leadListQuerySchema } from "@/lib/validations/lead";
import { listLeadsForExport } from "@/lib/supabase/leads";
import { getAdminUser } from "@/lib/supabase/clients";
import { STATUS_LABELS, type Lead } from "@/lib/supabase/types";
import { ERRORS, apiError } from "../../_lib/api";

/**
 * GET /api/leads/export — protejat. Export CSV al filtrului curent.
 *
 * Detaliile care fac diferența între „am un CSV" și „pot lucra cu el":
 * - BOM UTF-8, altfel Excel pe Windows strică diacriticele;
 * - separator `;` — Excel cu locale RO citește virgula ca separator zecimal
 *   și pune tot rândul într-o celulă;
 * - o valoare care începe cu `=`, `+`, `-` sau `@` e prefixată, ca să nu fie
 *   interpretată drept formulă (injecție CSV dintr-un formular public);
 * - numele fișierului conține data, ca să nu se suprascrie în Descărcări.
 */

const COLUMNS: Array<{ header: string; value: (lead: Lead) => string }> = [
  { header: "Data", value: (l) => new Date(l.createdAt).toISOString() },
  { header: "Divizie", value: (l) => l.division },
  { header: "Status", value: (l) => STATUS_LABELS[l.status] },
  { header: "Fonduri", value: (l) => (l.isFunded ? "DA" : "") },
  { header: "Nume", value: (l) => l.name },
  { header: "Companie", value: (l) => l.company ?? "" },
  { header: "Telefon", value: (l) => l.phone ?? "" },
  { header: "Email", value: (l) => l.email ?? "" },
  { header: "Tip proiect", value: (l) => l.projectType ?? "" },
  { header: "Buget", value: (l) => l.budgetRange ?? "" },
  { header: "Termen", value: (l) => l.timeline ?? "" },
  { header: "Mesaj", value: (l) => l.message ?? "" },
  { header: "Formular", value: (l) => l.source },
  { header: "Limba", value: (l) => l.locale },
  { header: "UTM sursa", value: (l) => l.utm.source ?? "" },
  { header: "UTM mediu", value: (l) => l.utm.medium ?? "" },
  { header: "UTM campanie", value: (l) => l.utm.campaign ?? "" },
  { header: "Referrer", value: (l) => l.referrer ?? "" },
  { header: "Note", value: (l) => l.notes ?? "" },
  { header: "ID", value: (l) => l.id },
];

function cell(raw: string): string {
  // Anti injecție de formulă în Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return apiError(ERRORS.unauthorized, 401);

  const params = Object.fromEntries(request.nextUrl.searchParams);
  // Exportul ignoră paginarea: se exportă tot ce se potrivește filtrului.
  const parsed = leadListQuerySchema.safeParse({ ...params, page: 1, perPage: 1 });
  if (!parsed.success) return apiError(ERRORS.invalidQuery, 400);

  const { division, status, q, from, to } = parsed.data;
  const result = await listLeadsForExport({ division, status, q, from, to });

  if (!result.ok) {
    if (result.reason === "unconfigured") return apiError(ERRORS.unavailable, 503);
    console.error("[export] eșuat:", result.detail);
    return apiError(ERRORS.unavailable, 503);
  }

  const lines = [
    COLUMNS.map((column) => cell(column.header)).join(";"),
    ...result.data.map((lead) =>
      COLUMNS.map((column) => cell(column.value(lead))).join(";")
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `meridian-leaduri-${stamp}.csv`;

  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
