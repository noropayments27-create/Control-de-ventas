import { createFileRoute } from "@tanstack/react-router";
import {
  Calculator,
  CalendarDays,
  Camera,
  ChartColumn,
  Clock3,
  Coins,
  CreditCard,
  Croissant,
  MessageSquareText,
  Package,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PRICE = 3000;
const HECHA_ROWS = 4;
const BOLD_ROWS = 6;
const BOLD_N = BOLD_ROWS * 2;
const STORAGE_KEY = "control-ventas-v1";

const PRODUCTS = [
  "Agua grande",
  "Agua pequeña",
  "Gaseosa 400ml",
  "Hit 500ml",
  "Gaseosa 250ml",
  "Pony 350ml",
  "Pony mini",
  "Agua Gas",
  "Agua Gas pequeña",
  "Huevos",
] as const;

type ProductRow = {
  inicio: string;
  ingresos: string;
  final: string;
  vendido: string;
  monto: string;
};

type Flavor = {
  hechas: string[];
  quedaron: string;
};

type Turno = "" | "manana" | "tarde";

type Sheet = {
  fecha: string;
  base: string;
  nombre: string;
  turno: Turno;
  products: ProductRow[];
  pollo: Flavor;
  carne: Flavor;
  bold: string[];
  notas: string;
};

type FlavorMath = {
  hechas: number;
  closed: boolean;
  over: boolean;
  sold: number | null;
  monto: number | null;
};

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const sheetRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [sheet, setSheet] = useState<Sheet>(blankSheet);
  const [today, setToday] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [askClear, setAskClear] = useState(false);

  useEffect(() => {
    const now = todayISO();
    const loaded = loadSheet();
    setSheet(loaded ? { ...loaded, fecha: loaded.fecha || now } : { ...blankSheet(), fecha: now });
    setToday(now);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
    } catch {
      /* the sheet still works for this visit */
    }
  }, [sheet, ready]);

  useEffect(() => {
    if (!msg) return;
    const timer = window.setTimeout(() => setMsg(""), 3500);
    return () => window.clearTimeout(timer);
  }, [msg]);

  useEffect(() => {
    if (!askClear) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAskClear(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [askClear]);

  const pollo = flavorMath(sheet.pollo);
  const carne = flavorMath(sheet.carne);
  const resumenListo =
    !((pollo.hechas > 0 && !pollo.closed) || (carne.hechas > 0 && !carne.closed)) &&
    (pollo.closed || carne.closed);
  const minDate = today ? (sheet.fecha && sheet.fecha < today ? sheet.fecha : today) : undefined;

  function patchProduct(index: number, key: keyof ProductRow, value: string) {
    setSheet((prev) => ({
      ...prev,
      products: prev.products.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
  }

  function clearSheet() {
    const next = { ...blankSheet(), fecha: todayISO() };
    setSheet(next);
    setAskClear(false);
    setMsg("Planilla limpia.");
  }

  async function onCapture() {
    const node = sheetRef.current;
    if (!node || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(node, {
        backgroundColor: "#fff7f1",
        scale: 2,
      });
      const name = `ventas-${sheet.fecha || todayISO()}-${sheet.turno || "turno"}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const canShare =
        typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (canShare) {
        try {
          await navigator.share({ files: [file], title: "Control de ventas" });
          setMsg("Captura lista para compartir.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      setMsg("Captura guardada.");
    } catch {
      setMsg("No se pudo tomar la captura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="page" ref={sheetRef}>
        <header className="top">
          <ChartColumn strokeWidth={2.4} aria-hidden="true" />
          <span className="rule" aria-hidden="true" />
          <h1>Control de ventas</h1>
        </header>

        <section className="card meta" aria-label="Datos del turno">
          <label className="field-block" htmlFor="fecha">
            <span className="field-label">
              <CalendarDays strokeWidth={2.4} aria-hidden="true" /> Fecha
            </span>
            <input
              id="fecha"
              className="field"
              type="date"
              value={sheet.fecha}
              min={minDate}
              onChange={(event) => setSheet((prev) => ({ ...prev, fecha: event.target.value }))}
            />
          </label>
          <label className="field-block" htmlFor="base">
            <span className="field-label">
              <Coins strokeWidth={2.4} aria-hidden="true" /> Base
            </span>
            <span className="money">
              <span aria-hidden="true">$</span>
              <DigitsInput
                id="base"
                className="field"
                label="Base en pesos"
                value={sheet.base}
                max={8}
                onChange={(base) => setSheet((prev) => ({ ...prev, base }))}
              />
            </span>
          </label>
          <label className="field-block" htmlFor="nombre">
            <span className="field-label">
              <UserRound strokeWidth={2.4} aria-hidden="true" /> Nombre
            </span>
            <input
              id="nombre"
              className="field"
              type="text"
              maxLength={40}
              autoComplete="name"
              autoCapitalize="words"
              value={sheet.nombre}
              onChange={(event) => setSheet((prev) => ({ ...prev, nombre: event.target.value }))}
            />
          </label>
          <label className="field-block" htmlFor="turno">
            <span className="field-label">
              <Clock3 strokeWidth={2.4} aria-hidden="true" /> Turno
            </span>
            <select
              id="turno"
              className="field"
              value={sheet.turno}
              onChange={(event) =>
                setSheet((prev) => ({ ...prev, turno: event.target.value as Turno }))
              }
            >
              <option value="">Elegir</option>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </label>
        </section>

        <section className="card" aria-label="Productos">
          <h2 className="section-head">
            <Package strokeWidth={2.4} aria-hidden="true" /> Productos
          </h2>
          <div className="prod-head">
            <span>Productos</span>
            <span>Inicio</span>
            <span>Ingresos</span>
            <span>Final</span>
            <span>Total vendido</span>
            <span>Monto total</span>
          </div>
          <div className="prod-body">
            {PRODUCTS.map((name, index) => {
              const row = sheet.products[index] ?? emptyProduct();
              return (
                <div className="prod-row" key={name}>
                  <span className="prod-name">{name}</span>
                  <DigitsInput
                    label={`${name} inicio`}
                    value={row.inicio}
                    max={4}
                    onChange={(value) => patchProduct(index, "inicio", value)}
                  />
                  <DigitsInput
                    label={`${name} ingresos`}
                    value={row.ingresos}
                    max={4}
                    onChange={(value) => patchProduct(index, "ingresos", value)}
                  />
                  <DigitsInput
                    label={`${name} final`}
                    value={row.final}
                    max={4}
                    onChange={(value) => patchProduct(index, "final", value)}
                  />
                  <DigitsInput
                    label={`${name} total vendido`}
                    value={row.vendido}
                    max={4}
                    onChange={(value) => patchProduct(index, "vendido", value)}
                  />
                  <DigitsInput
                    label={`${name} monto total en pesos`}
                    value={row.monto}
                    max={7}
                    onChange={(value) => patchProduct(index, "monto", value)}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <div className="split">
          <section className="card" aria-label="Empanadas">
              <h2 className="section-head">
                <Croissant strokeWidth={2.4} aria-hidden="true" /> Empanada
                <em className="price-pill">$3.000</em>
              </h2>
              <div className="subhead">
                <span>Pollo</span>
                <span>Carne</span>
              </div>
              <div className="pad">
                <p className="caption">HECHAS</p>
                {Array.from({ length: HECHA_ROWS }, (_, row) => (
                  <div className="pair" key={row}>
                    <DigitsInput
                      label={`Pollo hechas ${row + 1}`}
                      value={sheet.pollo.hechas[row] ?? ""}
                      max={4}
                      onChange={(value) =>
                        setSheet((prev) => ({
                          ...prev,
                          pollo: {
                            ...prev.pollo,
                            hechas: prev.pollo.hechas.map((item, i) => (i === row ? value : item)),
                          },
                        }))
                      }
                    />
                    <DigitsInput
                      label={`Carne hechas ${row + 1}`}
                      value={sheet.carne.hechas[row] ?? ""}
                      max={4}
                      onChange={(value) =>
                        setSheet((prev) => ({
                          ...prev,
                          carne: {
                            ...prev.carne,
                            hechas: prev.carne.hechas.map((item, i) => (i === row ? value : item)),
                          },
                        }))
                      }
                    />
                  </div>
                ))}
                <div className="pair">
                  <div className="sum-mini" aria-label={`Total hechas de pollo ${pollo.hechas}`}>
                    <small>TOTAL</small>
                    {pollo.hechas}
                  </div>
                  <div className="sum-mini" aria-label={`Total hechas de carne ${carne.hechas}`}>
                    <small>TOTAL</small>
                    {carne.hechas}
                  </div>
                </div>
                <p className="caption">SIN VENDER</p>
                <div className="pair">
                  <DigitsInput
                    className={pollo.over ? "cell warn" : "cell"}
                    label="Pollo sin vender"
                    value={sheet.pollo.quedaron}
                    max={4}
                    onChange={(quedaron) =>
                      setSheet((prev) => ({ ...prev, pollo: { ...prev.pollo, quedaron } }))
                    }
                  />
                  <DigitsInput
                    className={carne.over ? "cell warn" : "cell"}
                    label="Carne sin vender"
                    value={sheet.carne.quedaron}
                    max={4}
                    onChange={(quedaron) =>
                      setSheet((prev) => ({ ...prev, carne: { ...prev.carne, quedaron } }))
                    }
                  />
                </div>
                {(pollo.over || carne.over) && (
                  <p className="warn-note">Quedaron más de las hechas. Revisa el número.</p>
                )}
                <div className="pair">
                  <Stat label="Total vendido" value={showCount(pollo.sold)} warn={pollo.over} />
                  <Stat label="Total vendido" value={showCount(carne.sold)} warn={carne.over} />
                </div>
                <div className="pair">
                  <Stat label="Monto total" value={showMoney(pollo.monto)} />
                  <Stat label="Monto total" value={showMoney(carne.monto)} />
                </div>
              </div>
            </section>

            <section className="card pago" aria-label="Forma de pago Bold">
            <h2 className="section-head">
              <CreditCard strokeWidth={2.4} aria-hidden="true" /> Forma de pago
            </h2>
            <div className="subhead solo">
              <span>Bold</span>
            </div>
            <div className="pad">
              {Array.from({ length: BOLD_ROWS }, (_, row) => (
                <div className="pair" key={row}>
                  {[0, 1].map((col) => {
                    const index = row * 2 + col;
                    return (
                      <DigitsInput
                        key={col}
                        label={`Bold columna ${col + 1} fila ${row + 1}`}
                        value={sheet.bold[index] ?? ""}
                        max={7}
                        onChange={(value) =>
                          setSheet((prev) => {
                            const bold = prev.bold.slice();
                            bold[index] = value;
                            return { ...prev, bold };
                          })
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="total-bar">
              <span>TOTAL BOLD</span>
              <strong>{money(sheet.bold.reduce((sum, value) => sum + toInt(value), 0))}</strong>
            </div>
          </section>
        </div>

        <section className="card resumen" aria-label="Resumen de empanadas">
          <span className="icon-badge">
            <Calculator strokeWidth={2.4} aria-hidden="true" />
          </span>
          <div className="resumen-lines">
            <label>
              Hechas
              <input className="field lock" readOnly tabIndex={-1} value={String(pollo.hechas + carne.hechas)} />
            </label>
            <label>
              Vendidas
              <input
                className="field lock"
                readOnly
                tabIndex={-1}
                value={resumenListo ? String((pollo.sold ?? 0) + (carne.sold ?? 0)) : "—"}
              />
            </label>
            <label>
              Monto
              <input
                className="field lock"
                readOnly
                tabIndex={-1}
                value={resumenListo ? money((pollo.monto ?? 0) + (carne.monto ?? 0)) : "—"}
              />
            </label>
          </div>
        </section>

        <section className="card notes">
          <label className="field-label" htmlFor="notas">
            <MessageSquareText strokeWidth={2.4} aria-hidden="true" /> Observaciones:
          </label>
          <textarea
            id="notas"
            className="field"
            rows={2}
            maxLength={400}
            value={sheet.notas}
            onChange={(event) => setSheet((prev) => ({ ...prev, notas: event.target.value }))}
          />
        </section>
      </div>

      <div className="actions">
        {msg ? (
          <p className="status" role="status">
            {msg}
          </p>
        ) : null}
        <div className="action-row">
          <button type="button" className="capture" onClick={onCapture} disabled={busy}>
            <Camera strokeWidth={2.4} aria-hidden="true" />
            {busy ? "Tomando…" : "Tomar captura"}
          </button>
          <button
            type="button"
            className="wipe"
            aria-label="Borrar planilla"
            onClick={() => setAskClear(true)}
          >
            <Trash2 strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>

      {askClear ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="clear-title">
          <div className="modal-card">
            <h2 id="clear-title">Borrar la planilla</h2>
            <p>Se limpia todo lo anotado en este turno.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                ref={cancelRef}
                onClick={() => setAskClear(false)}
              >
                Cancelar
              </button>
              <button type="button" className="danger" onClick={clearSheet}>
                Borrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DigitsInput({
  value,
  onChange,
  max,
  label,
  className = "cell",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  max: number;
  label: string;
  className?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      className={className}
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      value={value ? group(value) : ""}
      onChange={(event) => onChange(digits(event.target.value, max))}
    />
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={warn ? "stat warn" : "stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function emptyProduct(): ProductRow {
  return { inicio: "", ingresos: "", final: "", vendido: "", monto: "" };
}

function emptyFlavor(): Flavor {
  return { hechas: Array.from({ length: HECHA_ROWS }, () => ""), quedaron: "" };
}

function blankSheet(): Sheet {
  return {
    fecha: "",
    base: "",
    nombre: "",
    turno: "",
    products: PRODUCTS.map(() => emptyProduct()),
    pollo: emptyFlavor(),
    carne: emptyFlavor(),
    bold: Array.from({ length: BOLD_N }, () => ""),
    notas: "",
  };
}

function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function digits(raw: string, max: number): string {
  return raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, max);
}

function asDigits(value: unknown, max: number): string {
  return typeof value === "string" ? digits(value, max) : "";
}

function toInt(value: string): number {
  if (!value) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function group(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const moneyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function money(value: number): string {
  return moneyFmt.format(value);
}

function flavorMath(flavor: Flavor): FlavorMath {
  const hechas = flavor.hechas.reduce((sum, value) => sum + toInt(value), 0);
  const closed = flavor.quedaron !== "";
  if (!closed) return { hechas, closed, over: false, sold: null, monto: null };
  const quedaron = toInt(flavor.quedaron);
  const over = quedaron > hechas;
  const sold = Math.max(0, hechas - quedaron);
  return { hechas, closed, over, sold, monto: sold * PRICE };
}

function showCount(value: number | null): string {
  return value === null ? "—" : String(value);
}

function showMoney(value: number | null): string {
  return value === null ? "—" : money(value);
}

function coerceFlavor(value: unknown): Flavor {
  const hechas = Array.from({ length: HECHA_ROWS }, () => "");
  if (!value || typeof value !== "object") return { hechas, quedaron: "" };
  const row = value as Record<string, unknown>;
  if (Array.isArray(row.hechas)) {
    for (let i = 0; i < HECHA_ROWS; i += 1) hechas[i] = asDigits(row.hechas[i], 4);
  }
  return { hechas, quedaron: asDigits(row.quedaron, 4) };
}

function coerce(raw: unknown): Sheet {
  if (!raw || typeof raw !== "object") return blankSheet();
  const row = raw as Record<string, unknown>;
  const productsIn = Array.isArray(row.products) ? row.products : [];
  const boldIn = Array.isArray(row.bold) ? row.bold : [];
  const turno: Turno = row.turno === "manana" || row.turno === "tarde" ? row.turno : "";
  return {
    fecha: typeof row.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha) ? row.fecha : "",
    base: asDigits(row.base, 8),
    nombre: typeof row.nombre === "string" ? row.nombre.slice(0, 40) : "",
    turno,
    products: PRODUCTS.map((_, index) => {
      const item = productsIn[index];
      if (!item || typeof item !== "object") return emptyProduct();
      const product = item as Record<string, unknown>;
      return {
        inicio: asDigits(product.inicio, 4),
        ingresos: asDigits(product.ingresos, 4),
        final: asDigits(product.final, 4),
        vendido: asDigits(product.vendido, 4),
        monto: asDigits(product.monto, 7),
      };
    }),
    pollo: coerceFlavor(row.pollo),
    carne: coerceFlavor(row.carne),
    bold: Array.from({ length: BOLD_N }, (_, index) => asDigits(boldIn[index], 7)),
    notas: typeof row.notas === "string" ? row.notas.slice(0, 400) : "",
  };
}

function loadSheet(): Sheet | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return coerce(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}
