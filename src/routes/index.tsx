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
  Moon,
  Package,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const PRICE = 3000;
const HECHA_ROWS = 4;
const BOLD_ROWS = 11;
const BOLD_N = BOLD_ROWS * 2;
const STORAGE_KEY = "control-ventas-v1";
const THEME_KEY = "control-ventas-theme";
const HISTORY_KEY = "control-ventas-historial";

const PRODUCTS = [
  { name: "Agua grande", price: 2500 },
  { name: "Agua pequeña", price: 1000 },
  { name: "Gaseosa 400ml", price: 3500 },
  { name: "Hit 500ml", price: 3500 },
  { name: "Gaseosa 240ml", price: 2500 },
  { name: "Pony Malta 350ml", price: 3000 },
  { name: "Pony mini", price: 2000 },
  { name: "Agua con gas", price: 2500 },
  { name: "Agua con gas pequeña", price: 1500 },
  { name: "Huevos", price: 4000 },
] as const;

type ProductRow = {
  inicio: string;
  ingresos: string;
  final: string;
};

type Flavor = {
  hechas: string[];
  quedaron: string;
};

type Turno = "" | "manana" | "tarde";
type ThemeName = "light" | "dark";

type Sheet = {
  fecha: string;
  base: string;
  nombre: string;
  turno: Turno;
  products: ProductRow[];
  pollo: Flavor;
  carne: Flavor;
  bold: string[];
  consumo: string;
  notas: string;
};

type FlavorMath = {
  hechas: number;
  closed: boolean;
  over: boolean;
  sold: number | null;
  monto: number | null;
};

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const posterRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [sheet, setSheet] = useState<Sheet>(blankSheet);
  const [today, setToday] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [askClear, setAskClear] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("light");
  const [standalone, setStandalone] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPrompt | null>(null);
  const [installHelp, setInstallHelp] = useState(false);

  useLayoutEffect(() => {
    const saved = readTheme();
    applyTheme(saved);
    setTheme(saved);
  }, []);

  useEffect(() => {
    const now = todayISO();
    const loaded = loadSheet();
    setSheet(loaded ? { ...loaded, fecha: loaded.fecha || now } : { ...blankSheet(), fecha: now });
    setToday(now);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const save = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
      } catch {
        /* the sheet still works for this visit */
      }
    };
    save();
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [sheet, ready]);

  useEffect(() => {
    if (!msg) return;
    const timer = window.setTimeout(() => setMsg(""), 3500);
    return () => window.clearTimeout(timer);
  }, [msg]);

  useEffect(() => {
    if (!askClear && !installHelp) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAskClear(false);
        setInstallHelp(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [askClear, installHelp]);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const sync = () => {
      const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setStandalone(mq.matches || ios);
    };
    sync();
    mq.addEventListener("change", sync);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const pollo = flavorMath(sheet.pollo);
  const carne = flavorMath(sheet.carne);
  const productos = productsTotal(sheet.products);
  const empanadasListas = flavorReady(pollo) && flavorReady(carne);
  const empanadasMonto = (pollo.monto ?? 0) + (carne.monto ?? 0);
  const boldTotal = sheet.bold.reduce((sum, value) => sum + toInt(value), 0);
  const venta = productos.amount + empanadasMonto;
  const efectivo = venta - boldTotal - toInt(sheet.consumo);
  const minDate = today ? (sheet.fecha && sheet.fecha < today ? sheet.fecha : today) : undefined;
  const captureHechasRows = Array.from({ length: HECHA_ROWS }, (_, row) => ({
    pollo: sheet.pollo.hechas[row] ?? "",
    carne: sheet.carne.hechas[row] ?? "",
  })).filter((row) => row.pollo !== "" || row.carne !== "");
  const captureHasPolloHechas = sheet.pollo.hechas.some((value) => value !== "");
  const captureHasCarneHechas = sheet.carne.hechas.some((value) => value !== "");
  const captureHasPolloQuedaron = sheet.pollo.quedaron !== "";
  const captureHasCarneQuedaron = sheet.carne.quedaron !== "";
  const captureHasEmpanadas =
    captureHasPolloHechas ||
    captureHasCarneHechas ||
    captureHasPolloQuedaron ||
    captureHasCarneQuedaron;
  const captureBoldRows = Array.from({ length: BOLD_ROWS }, (_, row) => ({
    left: sheet.bold[row * 2] ?? "",
    right: sheet.bold[row * 2 + 1] ?? "",
  })).filter((row) => row.left !== "" || row.right !== "");

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
    setMsg("Planilla limpia. Lo anterior sigue en este dispositivo.");
  }

  function toggleTheme() {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  async function onInstall() {
    if (installEvent) {
      await installEvent.prompt();
      setInstallEvent(null);
      return;
    }
    setInstallHelp(true);
  }

  async function onCapture() {
    const node = posterRef.current;
    if (!node || busy) return;
    setBusy(true);
    setMsg("");
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const themeNow = readTheme();
      node.dataset.theme = themeNow;
      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(node, {
        backgroundColor: getComputedStyle(node).backgroundColor,
        scale: 1,
        width: 1080,
        height: 1920,
      });
      rememberCapture(sheet);
      const name = `ventas-${sheet.fecha || todayISO()}-${sheet.turno || "turno"}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const canShare =
        typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      const title = ["Control de ventas", formatFecha(sheet.fecha), sheet.nombre]
        .filter(Boolean)
        .join(" · ");
      if (canShare) {
        try {
          await navigator.share({ files: [file], title });
          setMsg("Captura 9:16 lista. Fecha y datos quedaron guardados.");
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
      setMsg("Captura 9:16 guardada, con fecha y todo lo anotado.");
    } catch {
      setMsg("No se pudo tomar la captura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="page">
        <header className="top">
          <ChartColumn strokeWidth={2.4} aria-hidden="true" />
          <span className="rule" aria-hidden="true" />
          <h1>Control de ventas</h1>
          <div className="top-actions">
            {standalone ? null : (
              <button type="button" className="icon-btn" aria-label="Instalar aplicación" onClick={onInstall}>
                <Smartphone strokeWidth={2.4} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
              onClick={toggleTheme}
            >
              <Moon className="icon-moon" strokeWidth={2.4} aria-hidden="true" />
              <Sun className="icon-sun" strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
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
            {PRODUCTS.map((product, index) => {
              const row = sheet.products[index] ?? emptyProduct();
              const math = productMath(row, product.price);
              return (
                <div className="prod-row" key={product.name}>
                  <span className="prod-name">{product.name}</span>
                  <DigitsInput
                    label={`${product.name} inicio`}
                    value={row.inicio}
                    max={4}
                    onChange={(value) => patchProduct(index, "inicio", value)}
                  />
                  <DigitsInput
                    label={`${product.name} ingresos`}
                    value={row.ingresos}
                    max={4}
                    onChange={(value) => patchProduct(index, "ingresos", value)}
                  />
                  <DigitsInput
                    label={`${product.name} final`}
                    value={row.final}
                    max={4}
                    className={math.over ? "cell warn" : "cell"}
                    onChange={(value) => patchProduct(index, "final", value)}
                  />
                  <div
                    className={math.over ? "cell calc warn" : "cell calc"}
                    aria-label={`${product.name} total vendido`}
                  >
                    {math.sold === null ? "" : String(math.sold)}
                  </div>
                  <div className="cell calc" aria-label={`${product.name} monto total`}>
                    {math.amount === null ? "" : group(String(math.amount))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="total-bar">
            <span>TOTAL PRODUCTOS</span>
            <strong>{money(productos.amount)}</strong>
          </div>
        </section>

        <div className="split">
          <section className="card" aria-label="Empanadas">
            <h2 className="section-head">
              <Croissant strokeWidth={2.4} aria-hidden="true" /> Empanadas
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
              <p className="caption">TOTAL HECHAS</p>
              <div className="pair">
                <div className="sum-mini" aria-label={`Total hechas de pollo ${pollo.hechas}`}>
                  {pollo.hechas}
                </div>
                <div className="sum-mini" aria-label={`Total hechas de carne ${carne.hechas}`}>
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
              <div className="total-bar in-pad">
                <span>MONTO TOTAL</span>
                <strong>{empanadasListas ? money(empanadasMonto) : "—"}</strong>
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
              <strong>{money(boldTotal)}</strong>
            </div>
          </section>
        </div>

        <section className="card resumen" aria-label="Desglose">
          <div className="desglose">
            <h2 className="desglose-title">
              <Calculator strokeWidth={2.4} aria-hidden="true" /> Desglose
            </h2>
            <div className="resumen-lines">
              <label>
                Consumo
                <DigitsInput
                  label="Consumo en pesos"
                  value={sheet.consumo}
                  max={8}
                  className="cell"
                  onChange={(consumo) => setSheet((prev) => ({ ...prev, consumo }))}
                />
              </label>
              <label>
                Venta
                <input
                  className="field lock"
                  readOnly
                  tabIndex={-1}
                  value={empanadasListas ? money(venta) : "—"}
                  aria-label="Venta"
                />
              </label>
              <label>
                Total efectivo
                <input
                  className="field lock"
                  readOnly
                  tabIndex={-1}
                  value={empanadasListas ? money(efectivo) : "—"}
                  aria-label="Total efectivo"
                />
              </label>
            </div>
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
      </div>

      <div className="shot-frame" aria-hidden="true">
        <div className="shot" ref={posterRef} data-theme={theme}>
          <span className="shot-blob shot-blob-tr" />
          <span className="shot-blob shot-blob-bl" />
          <header className="shot-top">
            <ChartColumn strokeWidth={2.4} />
            <span className="shot-rule" />
            <h1>Control de ventas</h1>
          </header>

          <section className="shot-card shot-meta">
            <div>
              <div className="shot-label">
                <CalendarDays strokeWidth={2.4} /> Fecha
              </div>
              <div className="shot-value">{formatFecha(sheet.fecha)}</div>
            </div>
            <div>
              <div className="shot-label">
                <Coins strokeWidth={2.4} /> Base
              </div>
              <div className="shot-value">{sheet.base ? `$ ${group(sheet.base)}` : ""}</div>
            </div>
            <div>
              <div className="shot-label">
                <UserRound strokeWidth={2.4} /> Nombre
              </div>
              <div className="shot-value">{sheet.nombre}</div>
            </div>
            <div>
              <div className="shot-label">
                <Clock3 strokeWidth={2.4} /> Turno
              </div>
              <div className="shot-value">{turnoLabel(sheet.turno)}</div>
            </div>
          </section>

          <section className="shot-card">
            <h2 className="shot-head">
              <Package strokeWidth={2.4} /> Productos
            </h2>
            <div className="shot-cols">
              <span>Productos</span>
              <span>Inicio</span>
              <span>Ingresos</span>
              <span>Final</span>
              <span>Total vendido</span>
              <span>Monto total</span>
            </div>
            <div className="shot-prows">
              {PRODUCTS.map((product, index) => {
                const row = sheet.products[index] ?? emptyProduct();
                const math = productMath(row, product.price);
                return (
                  <div className="shot-prow" key={product.name}>
                    <span className="shot-pname">{product.name}</span>
                    <span className="shot-box">{showDigits(row.inicio)}</span>
                    <span className="shot-box">{showDigits(row.ingresos)}</span>
                    <span className="shot-box">{showDigits(row.final)}</span>
                    <span className="shot-box calc">{math.sold === null ? "" : String(math.sold)}</span>
                    <span className="shot-box calc">
                      {math.amount === null ? "" : group(String(math.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="shot-total">
              <span>TOTAL PRODUCTOS</span>
              <strong>{money(productos.amount)}</strong>
            </div>
          </section>

          <div className="shot-split">
            <div className="shot-col">
              <section className="shot-card shot-empanada">
                <h2 className="shot-head">
                  <Croissant strokeWidth={2.4} /> Empanadas
                </h2>
                <div className="shot-sub">
                  <span>Pollo</span>
                  <span>Carne</span>
                </div>
                <div className="shot-pad">
                  {captureHechasRows.length > 0 ? (
                    <>
                      <p className="shot-cap">HECHAS</p>
                      {captureHechasRows.map(({ pollo: polloHecho, carne: carneHecha }, row) => (
                        <div className="shot-pair hecho-row" key={row}>
                          {polloHecho ? <span className="shot-box">{showDigits(polloHecho)}</span> : null}
                          {carneHecha ? (
                            <span className={`shot-box${!polloHecho ? " shot-box-right" : ""}`}>
                              {showDigits(carneHecha)}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </>
                  ) : null}
                  {captureHasPolloHechas || captureHasCarneHechas ? (
                    <>
                      <p className="shot-cap">TOTAL HECHAS</p>
                      <div className="shot-pair">
                        {captureHasPolloHechas ? <span className="shot-box calc">{pollo.hechas}</span> : null}
                        {captureHasCarneHechas ? (
                          <span className={`shot-box calc${!captureHasPolloHechas ? " shot-box-right" : ""}`}>
                            {carne.hechas}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  {captureHasPolloQuedaron || captureHasCarneQuedaron ? (
                    <>
                      <p className="shot-cap">SIN VENDER</p>
                      <div className="shot-pair">
                        {captureHasPolloQuedaron ? (
                          <span className="shot-box">{showDigits(sheet.pollo.quedaron)}</span>
                        ) : null}
                        {captureHasCarneQuedaron ? (
                          <span className={`shot-box${!captureHasPolloQuedaron ? " shot-box-right" : ""}`}>
                            {showDigits(sheet.carne.quedaron)}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  {pollo.closed || carne.closed ? (
                    <>
                      <p className="shot-cap">TOTAL VENDIDO</p>
                      <div className="shot-pair">
                        {pollo.closed ? <span className="shot-box calc">{showCount(pollo.sold)}</span> : null}
                        {carne.closed ? (
                          <span className={`shot-box calc${!pollo.closed ? " shot-box-right" : ""}`}>
                            {showCount(carne.sold)}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                  {captureHasEmpanadas ? (
                    <div className="shot-total">
                      <span>MONTO TOTAL</span>
                      <strong>{empanadasListas ? money(empanadasMonto) : "—"}</strong>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <section className="shot-card shot-bold">
              <h2 className="shot-head">
                <CreditCard strokeWidth={2.4} /> Forma de pago
              </h2>
              <div className="shot-sub solo">
                <span>Bold</span>
              </div>
              <div className="shot-bold-list">
                {captureBoldRows.map(({ left, right }, row) => (
                  <div className="shot-pair" key={row}>
                    {left ? <span className="shot-box">{showDigits(left)}</span> : null}
                    {right ? (
                      <span className={`shot-box${!left ? " shot-box-right" : ""}`}>
                        {showDigits(right)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="shot-total">
                <span>TOTAL BOLD</span>
                <strong>{money(boldTotal)}</strong>
              </div>
            </section>
          </div>

          <section className="shot-card shot-desglose">
            <div className="shot-label">
              <Calculator strokeWidth={2.4} /> Desglose
            </div>
            <div className="shot-mini">
              <span>Consumo</span>
              <span className="shot-box">{sheet.consumo ? group(sheet.consumo) : ""}</span>
            </div>
            <div className="shot-mini">
              <span>Venta</span>
              <span className="shot-box calc">{empanadasListas ? money(venta) : "—"}</span>
            </div>
            <div className="shot-mini">
              <span>Total efectivo</span>
              <span className="shot-box calc">{empanadasListas ? money(efectivo) : "—"}</span>
            </div>
          </section>

          <section className="shot-card shot-notes">
            <div className="shot-label">
              <MessageSquareText strokeWidth={2.4} /> Observaciones
            </div>
            <p>{sheet.notas}</p>
          </section>
        </div>
      </div>

      {askClear ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="clear-title">
          <div className="modal-card">
            <h2 id="clear-title">Borrar la planilla</h2>
            <p>Se limpia lo anotado en este turno. Las capturas anteriores siguen en este dispositivo.</p>
            <div className="modal-actions">
              <button type="button" className="ghost" ref={cancelRef} onClick={() => setAskClear(false)}>
                Cancelar
              </button>
              <button type="button" className="danger" onClick={clearSheet}>
                Borrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {installHelp ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="install-title">
          <div className="modal-card">
            <h2 id="install-title">Instalar la app</h2>
            <p>
              En el menú del navegador elige Instalar app o Agregar a la pantalla de inicio. En iPhone:
              Compartir, luego Agregar a inicio. Después abre sin conexión.
            </p>
            <div className="modal-actions">
              <button type="button" className="danger" ref={cancelRef} onClick={() => setInstallHelp(false)}>
                Listo
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
  return { inicio: "", ingresos: "", final: "" };
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
    consumo: "",
    notas: "",
  };
}

function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatFecha(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function turnoLabel(turno: Turno): string {
  if (turno === "manana") return "Mañana";
  if (turno === "tarde") return "Tarde";
  return "";
}

function showDigits(value: string): string {
  return value ? group(value) : "";
}

function digits(raw: string, max: number): string {
  return raw
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, max);
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

function productMath(row: ProductRow, price: number) {
  const ready = row.inicio !== "" && row.final !== "";
  if (!ready) return { sold: null as number | null, amount: null as number | null, over: false };
  const stock = toInt(row.inicio) + toInt(row.ingresos);
  const left = toInt(row.final);
  const over = left > stock;
  const sold = Math.max(0, stock - left);
  return { sold, amount: sold * price, over };
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

function productsTotal(rows: ProductRow[]) {
  let amount = 0;
  for (let index = 0; index < PRODUCTS.length; index += 1) {
    const math = productMath(rows[index] ?? emptyProduct(), PRODUCTS[index].price);
    if (math.amount !== null) amount += math.amount;
  }
  return { amount };
}

function flavorReady(flavor: FlavorMath): boolean {
  return flavor.hechas === 0 || flavor.closed;
}

function showCount(value: number | null): string {
  return value === null ? "—" : String(value);
}

function readTheme(): ThemeName {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* theme still applies this visit */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#1c1410" : "#fff7f1");
}

function rememberCapture(sheet: Sheet) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const prev = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(prev) ? prev : [];
    list.unshift({ at: new Date().toISOString(), sheet });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* current sheet is already stored */
  }
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
      };
    }),
    pollo: coerceFlavor(row.pollo),
    carne: coerceFlavor(row.carne),
    bold: Array.from({ length: BOLD_N }, (_, index) => asDigits(boldIn[index], 7)),
    consumo: asDigits(row.consumo, 8),
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
