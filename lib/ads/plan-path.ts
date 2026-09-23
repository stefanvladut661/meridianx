/**
 * Citire și scriere pe planul BRUT (ce a lipit omul, încă nevalidat).
 *
 * Previzualizarea și corecturile lucrează pe datele brute, nu pe planul
 * validat: un plan cu o greșeală trebuie să se vadă în continuare, cu
 * greșeala marcată la locul ei — altfel omul ar vedea doar o listă de
 * erori și niciun context.
 *
 * Căile sunt cu puncte: `creative.primary_texts.1`.
 */

export type PathKey = string | number;

export function toPath(path: string): PathKey[] {
  if (path === "") return [];
  return path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

export function pathString(path: ReadonlyArray<PropertyKey>): string {
  return path.map((part) => String(part)).join(".");
}

export function getIn(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const key of toPath(path)) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PathKey, unknown>)[key];
  }
  return current;
}

/**
 * Copie cu valoarea schimbată. `undefined` șterge cheia (sau elementul din
 * listă), ca un câmp golit să dispară din JSON, nu să rămână `""`.
 */
export function setIn(root: unknown, path: string, value: unknown): Record<string, unknown> {
  const keys = toPath(path);
  const base = (root && typeof root === "object" ? root : {}) as Record<string, unknown>;
  if (keys.length === 0) return base;

  const write = (node: unknown, index: number): unknown => {
    const key = keys[index];
    const isLast = index === keys.length - 1;
    const container: Record<PathKey, unknown> | unknown[] = Array.isArray(node)
      ? [...node]
      : node && typeof node === "object"
        ? { ...(node as Record<string, unknown>) }
        : typeof key === "number"
          ? []
          : {};

    if (isLast) {
      if (value === undefined) {
        if (Array.isArray(container) && typeof key === "number") {
          container.splice(key, 1);
        } else {
          delete (container as Record<PathKey, unknown>)[key];
        }
      } else {
        (container as Record<PathKey, unknown>)[key] = value;
      }
      return container;
    }

    (container as Record<PathKey, unknown>)[key] = write(
      (container as Record<PathKey, unknown>)[key],
      index + 1
    );
    return container;
  };

  return write(base, 0) as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asStringList(value: unknown): string[] {
  return asArray(value).flatMap((item) => {
    const text = asString(item);
    return text ? [text] : [];
  });
}
