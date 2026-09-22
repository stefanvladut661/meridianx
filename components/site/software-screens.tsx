import type { CSSProperties, ReactNode } from "react";
import type { SolutionKey } from "./software-content";
import s from "./software-screens.module.css";

/* ============================================================
   Ecranele din „Ce construim” (/software).

   Fiecare tip de aplicație are o schiță de interfață care se
   construiește sub ochii omului: rândurile de comenzi apar, barele
   cresc, pachetele de date circulă între sisteme. Scopul e să arate
   CE face aplicația înainte ca cineva să citească o propoziție.

   Cifrele și numele din ecrane sunt ilustrative (panoul le marchează
   ca atare). Locul ăsta e gândit să primească demo-urile reale de
   aplicații: când vin, înlocuiesc schița din `SCREENS[key]`.

   Toate au 560×330. Culorile vin din tokens-ii lumii software.
   Intrările durează sub 400ms (CLAUDE.md §2); buclele care rămân
   după sunt lente și discrete. Sub prefers-reduced-motion, plasa din
   globals.css duce intrările în starea finală și oprește buclele.
   ============================================================ */

export const SCREENS: Record<SolutionKey, () => ReactNode> = {
  business: Business,
  loyalty: Loyalty,
  dash: Dash,
  sales: Sales,
  saas: Saas,
  mobile: Mobile,
  web: Web,
  integrari: Integrations,
};

const VB = "0 0 560 330";

/** Indexul de cascadă și, opțional, alte variabile citite de CSS. */
function v(i: number, extra: Record<string, string | number> = {}): CSSProperties {
  return { ["--i" as string]: i, ...extra } as CSSProperties;
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={VB} className={s.svg} aria-hidden>
      {children}
    </svg>
  );
}

/* ---------- 1. Aplicații interne: comenzile, pe etape ---------- */
function Business() {
  const rows = [
    ["#1042", 128, "Aprobat", true],
    ["#1043", 96, "Producție", false],
    ["#1044", 140, "Producție", false],
    ["#1045", 110, "Livrare", true],
    ["#1046", 84, "Aprobat", true],
    ["#1047", 120, "Livrat", false],
  ] as const;
  return (
    <Svg>
      <rect x="0" y="0" width="120" height="330" className={s.soft} />
      {[60, 48, 66, 40, 54].map((w, i) => (
        <rect
          key={i}
          x="18"
          y={30 + i * 30}
          width={w}
          height="8"
          rx="4"
          className={`${s.in} ${i === 0 ? s.acc : s.softer}`}
          style={v(i)}
        />
      ))}
      <text x="148" y="38" className={`${s.tb} ${s.in}`} style={v(0)}>
        Comenzi · azi
      </text>
      <g className={s.pop} style={v(2)}>
        <rect x="446" y="20" width="94" height="28" rx="7" className={s.acc} />
        <text x="462" y="38" className={s.tInv}>
          + Comandă
        </text>
      </g>
      {[
        ["NR.", 148],
        ["CLIENT", 212],
        ["ETAPĂ", 378],
        ["TERMEN", 480],
      ].map(([t, x]) => (
        <text key={t} x={x} y="76" className={s.t}>
          {t}
        </text>
      ))}
      <rect
        x="128"
        y="88"
        width="432"
        height="38"
        className={s.scan}
      />
      {rows.map(([nr, w, stage, on], i) => {
        const y = 88 + i * 38;
        return (
          <g key={nr} className={s.in} style={v(i + 2)}>
            <line x1="140" x2="548" y1={y + 38} y2={y + 38} className={s.hair} />
            <text x="148" y={y + 23} className={s.tDark}>
              {nr}
            </text>
            <rect x="212" y={y + 15} width={w} height="8" rx="4" className={s.softer} />
            <rect
              x="374"
              y={y + 9}
              width="80"
              height="20"
              rx="10"
              className={on ? s.accSoft : s.soft}
            />
            <text x="386" y={y + 23} className={on ? s.tAcc : s.t}>
              {stage}
            </text>
            <text x="480" y={y + 23} className={s.t}>
              {`${12 + i}.10`}
            </text>
          </g>
        );
      })}
    </Svg>
  );
}

/* ---------- 2. Fidelizare: cardul care se umple ---------- */
function Loyalty() {
  const qr = [
    1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1,
  ];
  return (
    <Svg>
      <g className={s.pop} style={v(0)}>
        <rect x="36" y="34" width="268" height="164" rx="16" className={s.acc} />
        <text x="58" y="64" className={s.tInv}>
          CARD CLIENT
        </text>
        <text x="58" y="110" className={s.bigInv}>
          1 240 pct
        </text>
        <text x="58" y="136" className={s.tInv}>
          Argint → Aur
        </text>
        <rect x="58" y="160" width="224" height="6" rx="3" className={s.inv30} />
        <rect
          x="58"
          y="160"
          width="168"
          height="6"
          rx="3"
          className={`${s.inv} ${s.growX}`}
          style={v(3)}
        />
        {qr.map((q, i) =>
          q ? (
            <rect
              key={i}
              x={236 + (i % 5) * 9}
              y={52 + Math.floor(i / 5) * 9}
              width="7"
              height="7"
              rx="1"
              className={s.inv}
            />
          ) : null
        )}
      </g>

      {Array.from({ length: 8 }, (_, i) => (
        <circle
          key={i}
          cx={52 + i * 34}
          cy="238"
          r="11"
          className={
            i < 5 ? `${s.acc} ${s.pop}` : i === 5 ? `${s.ring} ${s.pulse}` : s.ring
          }
          style={v(i + 4)}
        />
      ))}
      <text x="40" y="284" className={`${s.t} ${s.in}`} style={v(8)}>
        Încă 3 vizite până la cafeaua gratuită
      </text>

      <g className={s.in} style={v(2)}>
        <rect x="332" y="34" width="196" height="260" rx="12" className={s.panel} />
        <text x="350" y="62" className={s.tb}>
          Campanii automate
        </text>
      </g>
      {["Revino în 30 de zile", "Aniversare −15%", "Treci la Aur"].map((c, i) => {
        const y = 82 + i * 58;
        const last = i === 2;
        return (
          <g key={c} className={s.in} style={v(i + 3)}>
            <rect x="346" y={y} width="168" height="46" rx="8" className={s.soft} />
            <text x="358" y={y + 27} className={s.tDark}>
              {c}
            </text>
            <rect
              x="480"
              y={y + 16}
              width="24"
              height="14"
              rx="7"
              className={last ? `${s.accSoft} ${s.toggleTrack}` : s.acc}
            />
            <circle
              cx="497"
              cy={y + 23}
              r="5"
              className={last ? `${s.inv} ${s.toggleKnob}` : s.inv}
            />
          </g>
        );
      })}
      <text x="350" y="276" className={`${s.tAcc} ${s.in}`} style={v(7)}>
        Trimis azi: 312 clienți
      </text>
    </Svg>
  );
}

/* ---------- 3. Dashboard: cifrele care contează ---------- */
function Dash() {
  const bars = [52, 74, 60, 96, 82, 118, 104, 140];
  const pts = bars.map((h, i) => `${55 + i * 38},${286 - h - 18}`).join(" ");
  return (
    <Svg>
      {[
        ["VÂNZĂRI AZI", "48.320", "+12%"],
        ["COMENZI", "126", "+8"],
        ["MARJĂ", "31,4%", "+1,2"],
      ].map(([l, n, d], i) => (
        <g key={l} className={s.in} style={v(i)}>
          <rect x={20 + i * 180} y="18" width="160" height="72" rx="10" className={s.panel} />
          <text x={36 + i * 180} y="42" className={s.t}>
            {l}
          </text>
          <text x={36 + i * 180} y="74" className={s.big}>
            {n}
          </text>
          <text x={128 + i * 180} y="74" className={s.tAcc}>
            {d}
          </text>
        </g>
      ))}
      <rect x="20" y="106" width="340" height="206" rx="10" className={`${s.panel} ${s.in}`} style={v(1)} />
      {bars.map((h, i) => (
        <rect
          key={i}
          x={44 + i * 38}
          y={286 - h}
          width="22"
          height={h}
          rx="3"
          className={`${i === bars.length - 1 ? s.acc : s.accSoft} ${s.grow}`}
          style={v(i + 2)}
        />
      ))}
      <polyline
        points={pts}
        className={`${s.line} ${s.draw}`}
        style={v(6, { "--len": 420 })}
      />
      <g className={s.in} style={v(3)}>
        <rect x="376" y="106" width="164" height="206" rx="10" className={s.panel} />
        <text x="392" y="132" className={s.tb}>
          Alerte
        </text>
      </g>
      {["Stoc sub prag", "Factură restantă", "Comandă mare"].map((a, i) => (
        <g key={a} className={s.in} style={v(i + 5)}>
          <circle
            cx="398"
            cy={164 + i * 40}
            r="5"
            className={i === 0 ? `${s.acc} ${s.blink}` : s.softDot}
          />
          <text x="412" y={168 + i * 40} className={s.tDark}>
            {a}
          </text>
        </g>
      ))}
    </Svg>
  );
}

/* ---------- 4. Ofertare: de la linie la semnătură ---------- */
function Sales() {
  const items = [150, 120, 170, 96];
  const stages = ["Trimisă", "Văzută", "Negociere", "Semnată"];
  return (
    <Svg>
      <rect x="30" y="14" width="300" height="302" rx="8" className={`${s.panel} ${s.in}`} style={v(0)} />
      <text x="52" y="44" className={`${s.t} ${s.in}`} style={v(1)}>
        OFERTĂ #2026-118
      </text>
      <rect x="52" y="58" width="130" height="10" rx="5" className={`${s.softer} ${s.in}`} style={v(1)} />
      {items.map((w, i) => (
        <g key={i} className={s.in} style={v(i + 2)}>
          <rect x="52" y={96 + i * 34} width={w} height="8" rx="4" className={s.softer} />
          <text x="258" y={104 + i * 34} className={s.tDark}>
            {["4.200", "2.800", "7.600", "3.800"][i]}
          </text>
          <line x1="52" x2="308" y1={118 + i * 34} y2={118 + i * 34} className={s.hair} />
        </g>
      ))}
      <g className={s.in} style={v(6)}>
        <text x="52" y="258" className={s.tb}>
          Total
        </text>
        <text x="216" y="258" className={s.tb}>
          18.400 lei
        </text>
      </g>
      <g className={s.stamp} style={v(8)}>
        <rect x="170" y="272" width="120" height="30" rx="6" className={s.stampBox} />
        <text x="196" y="292" className={s.tAccBold}>
          SEMNAT
        </text>
      </g>

      {stages.map((st, i) => (
        <g key={st} className={s.in} style={v(i + 1)}>
          <rect x="360" y={30 + i * 72} width="176" height="56" rx="10" className={s.soft} />
          <text x="376" y={52 + i * 72} className={s.t}>
            {st.toUpperCase()}
          </text>
        </g>
      ))}
      <g className={s.pipeCard}>
        <rect x="376" y="60" width="144" height="18" rx="5" className={s.acc} />
        <text x="386" y="73" className={s.tInvSmall}>
          Ofertă #118
        </text>
      </g>
    </Svg>
  );
}

/* ---------- 5. SaaS: mai multe firme, un singur nucleu ---------- */
function Saas() {
  const tenants = [
    ["Firma A", "Lunar", s.acc],
    ["Firma B", "Anual", s.acc3],
    ["Firma C", "Lunar", s.fgBar],
  ] as const;
  return (
    <Svg>
      {tenants.map(([name, plan, bar], i) => {
        const x = 26 + i * 176;
        const cx = x + 80;
        return (
          <g key={name}>
            <line
              x1={cx}
              x2={cx}
              y1="150"
              y2="248"
              className={`${s.line2} ${s.draw}`}
              style={v(i + 4, { "--len": 100 })}
            />
            <circle
              cx={cx}
              cy="248"
              r="4"
              className={`${s.acc} ${s.packet}`}
              style={v(i, { "--dx": "0px", "--dy": "-98px" })}
            />
            <g className={s.in} style={v(i)}>
              <rect x={x} y="28" width="160" height="122" rx="10" className={s.panel} />
              <rect x={x} y="28" width="160" height="8" rx="4" className={bar} />
              <text x={x + 16} y="62" className={s.tb}>
                {name}
              </text>
              <rect x={x + 16} y="78" width="96" height="7" rx="3.5" className={s.softer} />
              <rect x={x + 16} y="94" width="120" height="7" rx="3.5" className={s.softer} />
              <rect x={x + 16} y="118" width="54" height="18" rx="9" className={s.accSoft} />
              <text x={x + 26} y="131" className={s.tAccSmall}>
                {plan}
              </text>
            </g>
          </g>
        );
      })}
      <g className={s.pop} style={v(6)}>
        <rect x="80" y="248" width="400" height="54" rx="12" className={s.acc} />
        <text x="104" y="272" className={s.tInvBold}>
          Nucleul produsului
        </text>
        <text x="104" y="290" className={s.tInvSmall}>
          conturi · abonamente · facturare · roluri
        </text>
      </g>
    </Svg>
  );
}

/* ---------- 6. Mobil: notificarea și lucrul fără semnal ---------- */
function Mobile() {
  return (
    <Svg>
      <g className={s.in} style={v(0)}>
        <rect x="120" y="8" width="160" height="314" rx="28" className={s.panel} />
        <rect x="176" y="18" width="48" height="8" rx="4" className={s.softer} />
        <text x="140" y="50" className={s.t}>
          iOS
        </text>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="136" y={110 + i * 50} width="128" height="40" rx="8" className={s.soft} />
            <rect x="148" y={124 + i * 50} width={70 - i * 8} height="7" rx="3.5" className={s.softer} />
          </g>
        ))}
      </g>
      <g className={s.toast}>
        <rect x="132" y="62" width="136" height="38" rx="10" className={s.acc} />
        <text x="144" y="79" className={s.tInvSmall}>
          Comandă nouă
        </text>
        <text x="144" y="92" className={s.tInvSmall}>
          #1042 · acum
        </text>
      </g>

      <g className={s.in} style={v(2)}>
        <rect x="310" y="28" width="146" height="290" rx="22" className={s.panel} />
        <circle cx="383" cy="42" r="4" className={s.softer} />
        <text x="328" y="70" className={s.t}>
          Android
        </text>
        {[0, 1, 2].map((i) => (
          <rect key={i} x="324" y={96 + i * 56} width="118" height="44" rx="8" className={s.soft} />
        ))}
      </g>
      <g className={s.swapA}>
        <rect x="324" y="272" width="118" height="26" rx="13" className={s.softDark} />
        <text x="338" y="289" className={s.tInvSmall}>
          Offline · salvat
        </text>
      </g>
      <g className={s.swapB}>
        <rect x="324" y="272" width="118" height="26" rx="13" className={s.acc} />
        <text x="344" y="289" className={s.tInvSmall}>
          Sincronizat ✓
        </text>
      </g>
    </Svg>
  );
}

/* ---------- 7. Site-uri care vând: vizite → cereri ---------- */
function Web() {
  const drops = [362, 392, 426, 458, 494, 518];
  return (
    <Svg>
      <g className={s.in} style={v(0)}>
        <rect x="24" y="16" width="286" height="298" rx="10" className={s.panel} />
        <rect x="46" y="44" width="200" height="14" rx="4" className={s.fgBar} />
        <rect x="46" y="66" width="150" height="14" rx="4" className={s.fgBar} />
        <rect x="46" y="94" width="220" height="7" rx="3.5" className={s.softer} />
        <rect x="46" y="120" width="96" height="26" rx="6" className={s.acc} />
      </g>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={46 + i * 76}
          y="166"
          width="66"
          height="50"
          rx="6"
          className={`${s.soft} ${s.in}`}
          style={v(i + 1)}
        />
      ))}
      <g className={s.in} style={v(4)}>
        <rect x="46" y="234" width="130" height="24" rx="5" className={s.field} />
        <rect x="46" y="266" width="130" height="24" rx="5" className={s.field} />
        <rect x="188" y="234" width="100" height="56" rx="6" className={s.acc} />
        <text x="202" y="266" className={s.tInvSmall}>
          Cere ofertă
        </text>
      </g>

      <path
        d="M340 36 H540 L468 206 H412 Z"
        className={`${s.line2} ${s.draw}`}
        style={v(2, { "--len": 620 })}
      />
      {drops.map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy="44"
          r="4"
          className={`${s.acc} ${s.packet}`}
          style={v(i * 0.7, { "--dx": `${440 - x}px`, "--dy": "170px" })}
        />
      ))}
      <g className={s.pop} style={v(5)}>
        <rect x="364" y="232" width="152" height="70" rx="10" className={s.panel} />
        <text x="380" y="258" className={s.t}>
          CERERI NOI
        </text>
        <text x="380" y="288" className={s.big}>
          +1
        </text>
      </g>
      <circle cx="494" cy="266" r="6" className={`${s.acc} ${s.blink}`} />
    </Svg>
  );
}

/* ---------- 8. Integrări: sistemele care vorbesc între ele ---------- */
function Integrations() {
  const hub = { x: 280, y: 165 };
  const nodes = [
    ["Facturare", 80, 70],
    ["e-Factura", 80, 165],
    ["Plăți", 80, 260],
    ["Curieri", 480, 70],
    ["ERP", 480, 165],
    ["Magazin", 480, 260],
  ] as const;
  return (
    <Svg>
      {nodes.map(([label, x, y], i) => {
        const edge = x < hub.x ? x + 60 : x - 60;
        const dx = hub.x - edge;
        const dy = hub.y - y;
        const len = Math.round(Math.hypot(dx, dy));
        return (
          <g key={label}>
            <line
              x1={edge}
              y1={y}
              x2={hub.x}
              y2={hub.y}
              className={`${s.line2} ${s.draw}`}
              style={v(i + 2, { "--len": len })}
            />
            <circle
              cx={edge}
              cy={y}
              r="4"
              className={`${s.acc} ${s.packet}`}
              style={v(i * 0.6, { "--dx": `${dx}px`, "--dy": `${dy}px` })}
            />
            <g className={s.in} style={v(i)}>
              <rect x={x - 60} y={y - 18} width="120" height="36" rx="18" className={s.panel} />
              <text x={x} y={y + 4} textAnchor="middle" className={s.tDark}>
                {label}
              </text>
            </g>
          </g>
        );
      })}
      <g className={s.pop} style={v(1)}>
        <circle cx={hub.x} cy={hub.y} r="54" className={s.acc} />
        <text x={hub.x} y={hub.y - 2} textAnchor="middle" className={s.tInvBold}>
          Aplicația
        </text>
        <text x={hub.x} y={hub.y + 16} textAnchor="middle" className={s.tInvBold}>
          ta
        </text>
      </g>
      <g className={s.in} style={v(8)}>
        <circle cx="226" cy="318" r="4" className={`${s.acc} ${s.blink}`} />
        <text x="238" y="322" className={s.t}>
          sincronizat acum 12s
        </text>
      </g>
    </Svg>
  );
}
