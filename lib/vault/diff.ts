import { KIND_LABEL, type EntryPayload } from "./entries";

/**
 * Diferența dintre două payload-uri (feat/vault, faza 6). Pură.
 *
 * Răspunde la o singură întrebare, cea pe care o pune omul în istoric:
 * „ce era diferit atunci față de acum?". Titlul, tipul, etichetele și
 * notițele sunt tratate ca niște câmpuri cu etichete fixe; câmpurile
 * propriu-zise se împerechează după etichetă (normalizată), a doua
 * apariție cu a doua apariție. Ordinea câmpurilor nu contează — nu e
 * o schimbare de conținut.
 *
 * Secretele ies cu `secret: true` și UI-ul decide dacă arată valorile.
 */

export interface Change {
  label: string;
  /** `null` = câmpul nu exista în acea versiune. */
  before: string | null;
  after: string | null;
  secret: boolean;
}

const key = (label: string) => label.trim().toLowerCase();

export function diffPayloads(before: EntryPayload, after: EntryPayload): Change[] {
  const changes: Change[] = [];
  const push = (label: string, a: string | null, b: string | null, secret = false) => {
    if ((a ?? "") !== (b ?? "")) changes.push({ label, before: a, after: b, secret });
  };

  push("Titlu", before.title, after.title);
  push("Tip", KIND_LABEL[before.kind], KIND_LABEL[after.kind]);

  const buckets = new Map<string, { before: EntryPayload["fields"]; after: EntryPayload["fields"] }>();
  const order: string[] = [];
  for (const field of before.fields) {
    const k = key(field.label);
    if (!buckets.has(k)) {
      buckets.set(k, { before: [], after: [] });
      order.push(k);
    }
    buckets.get(k)!.before.push(field);
  }
  for (const field of after.fields) {
    const k = key(field.label);
    if (!buckets.has(k)) {
      buckets.set(k, { before: [], after: [] });
      order.push(k);
    }
    buckets.get(k)!.after.push(field);
  }
  for (const k of order) {
    const bucket = buckets.get(k)!;
    const count = Math.max(bucket.before.length, bucket.after.length);
    for (let i = 0; i < count; i++) {
      const a = bucket.before[i];
      const b = bucket.after[i];
      const label = (b ?? a)!.label;
      push(label, a?.value ?? null, b?.value ?? null, Boolean(a?.secret || b?.secret));
    }
  }

  push("Etichete", before.tags.join(", ") || null, after.tags.join(", ") || null);
  push("Notițe", before.notes || null, after.notes || null);
  return changes;
}
