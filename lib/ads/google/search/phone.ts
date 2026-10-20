/**
 * Numărul de telefon al butonului de apel, verificat înainte de Google.
 *
 * România: 9 cifre după prefixul de țară (+40) sau după 0 — mobil (07…),
 * fix (02…, 03…) sau gratuit (08…). Numerele cu tarif special (09…) le
 * refuză politica Google pentru anunțuri, deci le refuzăm și noi. Pentru
 * alte țări verificăm doar că sunt între 6 și 15 cifre: regulile lor le
 * aplică Google la verificare (`validateOnly`).
 */

export type PhoneCheck =
  | { ok: true; /** Cum se trimite (`CallAsset.phoneNumber`): cifrele naționale. */ national: string; display: string }
  | { ok: false; message: string };

export function checkPhone(country: string, input: string): PhoneCheck {
  const compact = input.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) {
    return { ok: false, message: "poate conține doar cifre, spații, cratime și + la început." };
  }

  if (country === "RO") {
    const national = compact.startsWith("+40")
      ? `0${compact.slice(3)}`
      : compact.startsWith("0040")
        ? `0${compact.slice(4)}`
        : compact;
    if (!/^0\d{9}$/.test(national)) {
      return { ok: false, message: `„${input}” nu e un număr românesc: 10 cifre care încep cu 0 (0721 234 567) sau +40 urmat de 9 cifre.` };
    }
    if (national.startsWith("09")) {
      return { ok: false, message: "e un număr cu tarif special (09…), pe care Google nu-l acceptă în anunțuri." };
    }
    if (!/^0[2378]/.test(national)) {
      return { ok: false, message: `„${input}” nu e un număr românesc valid: după 0 vine 2 sau 3 (fix), 7 (mobil) sau 8 (gratuit).` };
    }
    const display = national.startsWith("07") || national.startsWith("08")
      ? `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`
      : `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
    return { ok: true, national, display };
  }

  const digits = compact.replace(/^\+/, "");
  if (digits.length < 6 || digits.length > 15) {
    return { ok: false, message: `„${input}” are ${digits.length} cifre; un număr de telefon are între 6 și 15.` };
  }
  return { ok: true, national: compact, display: input.trim() };
}
