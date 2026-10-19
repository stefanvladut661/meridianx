/**
 * Alegerea contului Google (formular GET, fără JavaScript): id-ul scris sau
 * ales din conturile pe care le vede cheia. Același pe „Cont” și „Termeni”.
 */
export function AccountChooser({
  action,
  value,
  accounts,
  hidden = {},
}: {
  action: string;
  value: string;
  accounts: Array<{ id: string; name: string; currency: string }>;
  /** Parametrii care se păstrează la schimbarea contului (vederea, perioada). */
  hidden?: Record<string, string>;
}) {
  return (
    <form method="get" action={action} className="mt-8 flex flex-col gap-3 rounded-panel-lg border border-hair bg-char/60 px-5 py-4 sm:flex-row sm:items-end sm:px-6">
      <div className="min-w-0 flex-1">
        <label htmlFor="cont-ales" className="eyebrow block !text-[11.5px]">
          Contul Google Ads
        </label>
        <input
          id="cont-ales"
          name="cont"
          list="conturi"
          defaultValue={value}
          inputMode="numeric"
          autoComplete="off"
          placeholder="123-456-7890"
          className="mt-2 block w-full rounded-panel-sm border border-hair bg-ink/60 px-3.5 py-2.5 font-md-mono text-[14px] text-bone placeholder:text-dim focus:border-hair-strong"
        />
        <datalist id="conturi">
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.currency}
            </option>
          ))}
        </datalist>
      </div>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className="btn btn-light shrink-0">
        Deschide contul
      </button>
    </form>
  );
}

/** „1234567890” → „123-456-7890”. */
export function formatCustomerId(id: string): string {
  return id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
}
