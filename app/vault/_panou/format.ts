/** Formatări mici pentru Vault, în română. */

/** `3` + `intrare`/`intrări` → „3 intrări”; de la 20 în sus româna cere „de”: „20 de intrări”. */
export function countNoun(count: number, singular: string, plural: string): string {
  if (count === 1) return `1 ${singular}`;
  if (count < 20) return `${count} ${plural}`;
  return `${count} de ${plural}`;
}

/** `754000` → `12:34`. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** `2834` → `2,8 s`. Virgulă, nu punct: e text românesc, nu cod. */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

/** Inițialele din adresa de email: `ana.pop@…` → `AP`. Membrii n-au nume, doar email. */
export function emailInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return letters.toUpperCase() || "—";
}

/** Fără diacritice și fără majuscule, ca „Băcănia” și „bacania” să fie același lucru. */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
