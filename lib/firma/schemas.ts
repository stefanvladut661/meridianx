import { z } from "zod";
import { isDay, isMonth } from "./format";

/**
 * Validările formularelor modulului — aceleași în browser și pe server.
 * Mesajele spun ce e greșit și ce să faci.
 */

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: cel mult ${max} caractere.`)
    .transform((value) => (value === "" ? null : value));

const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toLowerCase()))
  .refine((value) => value === null || z.email().safeParse(value).success, "Emailul nu arată bine. Verifică @ și domeniul.");

/** CUI: cifre, opțional cu „RO” în față (2–10 cifre). */
const cui = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, "").toUpperCase())
  .refine((value) => value === "" || /^(RO)?\d{2,10}$/.test(value), "CUI-ul are 2–10 cifre, cu sau fără „RO” în față.")
  .transform((value) => (value === "" ? null : value));

export const clientSchema = z.object({
  nume: z.string().trim().min(1, "Scrie numele firmei.").max(200, "Numele: cel mult 200 de caractere."),
  cui,
  regCom: optionalText(40, "Nr. Reg. Com."),
  adresa: optionalText(300, "Adresa"),
  oras: optionalText(100, "Orașul"),
  judet: optionalText(100, "Județul"),
  tara: z.string().trim().min(1, "Scrie țara.").max(60),
  emailFacturare: optionalEmail,
  note: optionalText(2000, "Notele"),
});
export type ClientInput = z.output<typeof clientSchema>;

export const contactSchema = z
  .object({
    nume: z.string().trim().min(1, "Scrie numele persoanei.").max(120),
    rol: optionalText(80, "Rolul"),
    telefon: optionalText(40, "Telefonul"),
    email: optionalEmail,
  })
  .refine((value) => value.telefon !== null || value.email !== null, { message: "Pune măcar un telefon sau un email.", path: ["telefon"] });
export type ContactInput = z.output<typeof contactSchema>;

const month = z.string().refine((value) => isMonth(value), "Alege luna.");

export const pretSchema = z
  .object({
    deLa: month,
    panaLa: z.string().refine((value) => value === "" || isMonth(value), "Alege luna de sfârșit sau las-o goală."),
    suma: z.number({ error: "Scrie suma lunară." }).positive("Suma trebuie să fie mai mare ca 0.").max(10_000_000),
    descriere: z.string().trim().min(1, "Scrie textul rândului de pe factură.").max(300),
  })
  .refine((value) => value.panaLa === "" || value.panaLa >= value.deLa, { message: "Luna de sfârșit e înaintea celei de început.", path: ["panaLa"] });

export const contractSchema = z
  .object({
    numar: optionalText(60, "Numărul contractului"),
    incepe: z.string().refine((value) => isDay(value), "Alege data de început."),
    seTermina: z.string().refine((value) => value === "" || isDay(value), "Alege data de sfârșit sau las-o goală."),
    servicii: z.string().trim().min(1, "Scrie serviciile din contract.").max(1000),
    moneda: z.enum(["RON", "EUR"]),
    bugetReclame: z.number().min(0, "Bugetul nu poate fi negativ.").max(10_000_000).nullable(),
    ziEmitere: z.number().int().min(1, "Ziua emiterii: între 1 și 28.").max(28, "Ziua emiterii: între 1 și 28 (ca să existe în fiecare lună)."),
    zileScadenta: z.number().int().min(0, "Scadența: între 0 și 120 de zile.").max(120, "Scadența: între 0 și 120 de zile."),
    starea: z.enum(["activ", "suspendat", "incheiat"]),
    note: optionalText(2000, "Notele"),
    preturi: z.array(pretSchema).min(1, "Pune măcar un preț (abonamentul lunar)."),
  })
  .refine((value) => value.seTermina === "" || value.seTermina >= value.incepe, { message: "Sfârșitul contractului e înaintea începutului.", path: ["seTermina"] });
export type ContractInput = z.output<typeof contractSchema>;

export const randFacturaSchema = z.object({
  denumire: z.string().trim().min(1, "Scrie denumirea rândului.").max(300),
  descriere: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((value) => (value ? value : null)),
  cantitate: z.number({ error: "Scrie cantitatea." }).positive("Cantitatea trebuie să fie mai mare ca 0.").max(100_000),
  um: z.string().trim().min(1, "Scrie unitatea (ex. buc, lună, oră).").max(20),
  pretUnitar: z.number({ error: "Scrie prețul." }).positive("Prețul trebuie să fie mai mare ca 0.").max(10_000_000),
});

export const draftSchema = z.object({
  randuri: z.array(randFacturaSchema).min(1, "Factura are nevoie de măcar un rând.").max(50),
  zileScadenta: z.number().int().min(0, "Scadența: între 0 și 120 de zile.").max(120, "Scadența: între 0 și 120 de zile."),
  dataPlanificata: z.string().refine((value) => isDay(value), "Alege data planificată."),
  mentiuni: z
    .string()
    .trim()
    .max(1000, "Mențiunile: cel mult 1000 de caractere.")
    .transform((value) => (value === "" ? null : value)),
});
export type DraftSchemaOutput = z.output<typeof draftSchema>;

export const manualSchema = draftSchema.extend({
  clientId: z.uuid({ error: "Alege clientul." }),
  moneda: z.enum(["RON", "EUR"]),
});

export const invoiceEmailSchema = z.object({
  to: z
    .string()
    .trim()
    .min(1, "Scrie adresa clientului.")
    .transform((value) => value.split(/[,;\s]+/).map((item) => item.trim().toLowerCase()).filter(Boolean))
    .refine((list) => list.length > 0 && list.length <= 5, "Pune între una și cinci adrese, despărțite prin virgulă.")
    .refine((list) => list.every((item) => z.email().safeParse(item).success), "O adresă nu arată bine. Verifică @ și domeniul."),
  subject: z.string().trim().min(1, "Scrie subiectul.").max(300),
  text: z.string().trim().min(1, "Scrie textul emailului.").max(5000),
});

export const expenseSchema = z.object({
  furnizor: z.string().trim().min(1, "Scrie furnizorul.").max(200),
  furnizorCui: cui,
  nrDocument: optionalText(60, "Numărul documentului"),
  dataDoc: z.string().refine((value) => isDay(value), "Alege data documentului."),
  suma: z.number({ error: "Scrie suma." }).min(0, "Suma nu poate fi negativă.").max(10_000_000),
  moneda: z.enum(["RON", "EUR", "USD", "altele"]),
  categoria: z.enum(["software", "echipament", "transport", "reclame", "altele"]),
  descriere: optionalText(500, "Descrierea"),
});
export type ExpenseInput = z.output<typeof expenseSchema>;

/** Prima eroare, ca text pentru om, și câmpul ei. */
export function firstIssue(error: z.ZodError): { field: string; message: string } {
  const issue = error.issues[0];
  return { field: issue?.path.join(".") ?? "", message: issue?.message ?? "Datele nu sunt complete." };
}
