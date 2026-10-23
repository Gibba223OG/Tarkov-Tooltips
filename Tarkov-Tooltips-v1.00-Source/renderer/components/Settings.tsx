import React, { useEffect, useRef, useState } from "react";
import Chrome from "@uiw/react-color-chrome";
import { UserConfig } from "../../models/UserConfig";

const DEFAULT_BACKGROUND = "#080909";
const DEFAULT_BORDER = "#59605a";
type ColorKey = "popupBackground" | "popupBorder";
type BoolKey = "enableTooltips" | "enableAlwaysOnTop" |
  "usePveMode" | "showOcrDiagnostics" | "showItemName" | "popupPriceBold";

interface Props {
  config: UserConfig;
  onUpdate: (config: UserConfig) => void;
  onClose: () => void;
}

export default function Settings({ config, onUpdate, onClose }: Props) {
  const [openPicker, setOpenPicker] = useState<ColorKey | null>(null);
  const [busy, setBusy] = useState("");
  const [popupTest, setPopupTest] = useState<"small" | "quest" | "ammo" | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingColors = useRef<Partial<UserConfig>>({});
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => () => {
    if (colorTimer.current) clearTimeout(colorTimer.current);
  }, []);

  useEffect(() => {
    let live = true;
    window.electron.getPopupTestMode()
      .then(mode => { if (live) setPopupTest(mode); })
      .catch(e => { if (live) setError("Could not get test popup state: " + String(e)); });
    return () => { live = false; };
  }, []);

  async function toggleTestPopup(mode: "small" | "quest" | "ammo") {
    if (testBusy) return;
    setTestBusy(true);
    setError("");
    try {
      const active = await window.electron.togglePopupTest(mode);
      setPopupTest(active);
    } catch (e) {
      setError("Could not toggle test popup: " + String(e));
    } finally {
      setTestBusy(false);
    }
  }

  async function changeToggle(key: BoolKey) {
    setError("");
    try {
      const value = !Boolean(configRef.current[key]);
      const updated = { ...configRef.current, [key]: value };
      onUpdate(updated);
      await window.electron.setUserConfig(updated);
      if (key === "enableTooltips") await window.electron.toggleTooltips(value);
      if (key === "enableAlwaysOnTop") await window.electron.toggleAlwaysOnTop(value);
      if (key === "usePveMode") {
        setBusy("Refreshing prices…");
        await window.electron.refetchItems();
      }
    } catch (e) {
      setError("Could not apply setting: " + String(e));
    } finally {
      setBusy("");
    }
  }

  function changeAppearance(patch: Partial<UserConfig>) {
    const updated = { ...configRef.current, ...patch };
    configRef.current = updated;
    onUpdate(updated);
    pendingColors.current = { ...pendingColors.current, ...patch };
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(async () => {
      try {
        const pending = pendingColors.current;
        pendingColors.current = {};
        const stored = await window.electron.getUserConfig();
        await window.electron.setUserConfig({ ...stored, ...pending });
      } catch (e) { setError("Could not save popup appearance: " + String(e)); }
    }, 100);
  }

  function changeColor(key: ColorKey, hex: string) {
    if (/^#[0-9a-f]{6}$/i.test(hex)) changeAppearance({ [key]: hex.toLowerCase() });
  }

  function changeScale(key: "popupMainScale" | "popupAmmoScale", value: number) {
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(25, Math.min(100, Math.round(value / 5) * 5));
    changeAppearance({ [key]: clamped });
  }

  function scaleRow(key: "popupMainScale" | "popupAmmoScale",
                    title: string, fallback: number, description: string) {
    const configured = config[key];
    const value = typeof configured === "number" && Number.isFinite(configured)
      && configured >= 25 && configured <= 100 ? configured : fallback;
    return (
      <section className="py-1.5 border-b border-[#424747]">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={key} className="text-[15px] font-medium">{title}</label>
          <span className="text-[15px] tabular-nums text-[#e4e1d6]">{value}%</span>
        </div>
        <p className="text-[13px] text-stone-400 mt-1">{description}</p>
        <input id={key} type="range" min={25} max={100} step={5} value={value}
          onChange={e => changeScale(key, Number(e.currentTarget.value))}
          className="mt-2 w-full accent-[#aab698]" aria-label={title} />
        <div className="flex justify-between text-[13px] text-stone-400">
          <span>25%</span><span>100%</span>
        </div>
      </section>
    );
  }

  function switchRow(title: string, description: string, key: BoolKey) {
    const checked = key === "popupPriceBold" ? (config.popupPriceBold ?? true) : Boolean(config[key]);
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[#424747] min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">{title}</div>
          <p className="text-[13px] text-stone-400 leading-[17px]">{description}</p>
        </div>
        <button type="button" role="switch" aria-label={title} aria-checked={checked}
          onClick={() => void changeToggle(key)}
          className={"relative shrink-0 w-10 h-5 rounded-full transition-colors " +
            (checked ? "bg-[#66705b]" : "bg-[#65625f]")}>
          <span className={"absolute left-1 top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-transform " +
            (checked ? "translate-x-[19px]" : "")} />
        </button>
      </div>
    );
  }

  function colorRow(key: ColorKey, label: string, fallback: string) {
    const selected = (config[key] || fallback);
    const hex = /^#[0-9a-f]{6}$/i.test(selected) ? selected : fallback;
    return (
      <section className="py-1.5 border-b border-[#424747] min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[15px] font-medium">{label}</div>
            <div className="text-[13px] text-stone-400">{hex.toUpperCase()}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => changeColor(key, fallback)}
              className="rounded border border-[#59605a] px-2 py-1 text-[13px] hover:bg-[#424949]">
              Reset
            </button>
            <button type="button" aria-label={"Choose " + label.toLowerCase()} aria-expanded={openPicker === key}
              onClick={() => setOpenPicker(openPicker === key ? null : key)}
              className="h-9 w-11 rounded border-2 border-[#8c9392] p-0.5">
              <span className="block h-full w-full" style={{ backgroundColor: hex }} />
            </button>
          </div>
        </div>
        {openPicker === key && (
          <div className="mt-3 p-2 sm:p-3 bg-[#24282a] border border-[#414748] rounded max-w-full" data-color-mode="dark">
            <Chrome color={hex} showAlpha={false} showEyeDropper={false}
              style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}
              onChange={(next) => changeColor(key, next.hex)}
            />
          </div>
        )}
      </section>
    );
  }

  const bg = /^#[0-9a-f]{6}$/i.test(config.popupBackground || "") ? config.popupBackground : DEFAULT_BACKGROUND;
  const border = /^#[0-9a-f]{6}$/i.test(config.popupBorder || "") ? config.popupBorder : DEFAULT_BORDER;

  return (
    <main className="pricechecker-settings-scroll h-screen w-full overflow-y-auto overflow-x-hidden bg-[#2b2f30] text-[#e4e1d6] px-3 py-2 sm:px-4 sm:py-3">
      <div className="w-full min-w-0">
        <header className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h1 className="text-[19px] font-bold">Tarkov Tooltips Settings</h1>
            <p className="text-[13px] text-stone-400">v1.00</p>
          </div>
          <button type="button" onClick={onClose}
            className="shrink-0 px-3 py-1.5 border border-[#59605a] rounded text-[15px] hover:bg-[#44494a]">
            Hide (F1)
          </button>
        </header>
        {switchRow("Enable Tooltips", "Display in-game price popups.", "enableTooltips")}
        {switchRow("Always on Top", "Keep overlays above the game.", "enableAlwaysOnTop")}
        {switchRow("PvE Mode", "Use PvE flea-market pricing rather than Regular.", "usePveMode")}
        {switchRow("Show Item Name", "Show the matched item's name on the popup. Off by default.", "showItemName")}
        {switchRow("Show OCR Diagnostics", "Show recognized text and inference time on the popup.", "showOcrDiagnostics")}

        <section className="mt-3 p-2.5 border border-[#44494a] bg-[#24282a] rounded">
          <h2 className="text-[15px] font-semibold">Test Popups</h2>
          <p className="mt-1 text-[13px] text-stone-400">
            Display a real popup on your desktop without Tarkov or OCR.
            Click the same button again to hide it. Price samples are illustrative; ammo uses cached Wiki statistics.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {(["small", "quest", "ammo"] as const).map(mode => {
              const active = popupTest === mode;
              return (
                <button key={mode} type="button" disabled={testBusy}
                  aria-pressed={active}
                  onClick={() => void toggleTestPopup(mode)}
                  className={"border rounded px-3 py-1.5 text-[13px] transition-colors " +
                    (active
                      ? "bg-[#66705b] border-[#aab698] text-white"
                      : "border-[#59605a] hover:bg-[#424949]") +
                    (testBusy ? " opacity-60 cursor-wait" : "")}>
                  {active ? "Hide " : "Test "}
                  {mode === "small" ? "Price Popup" : mode === "quest" ? "Quest Popup" : "Ammo Popup"}
                </button>
              );
            })}
          </div>
          {popupTest && <p role="status" className="mt-2 text-[13px] text-[#abd61c]">
            {popupTest === "small" ? "Price" : popupTest === "quest" ? "Quest" : "Ammo"} test popup active.
            Click its button again to hide, or the other button to switch.
          </p>}
          <div className="mt-2 pt-2 border-t border-[#424747]">
            <h3 className="font-semibold text-[15px]">Popup Scaling</h3>
            {scaleRow("popupMainScale", "Main Popup Scale", 55,
              "50% = the original live Price/Quest popup size. At 100% it is twice as large.")}
            {scaleRow("popupAmmoScale", "Ammo Popup Scale", 45,
              "100% = the approved full-size ammo popup. Default: 45%.")}
            <p className="text-[13px] text-stone-400 mt-1">
              Adjust either scale while its Test Popup is open to preview the change.
            </p>
          </div>
        </section>

        <section className="mt-3 p-2.5 border border-[#44494a] bg-[#24282a] rounded">
          <h2 className="font-semibold text-[15px]">Popup Colors & Live Preview</h2>
          <p className="text-[13px] text-stone-400 mt-1">Choose background and border colors; see them immediately in the example below.</p>
          {colorRow("popupBackground", "Background Color", DEFAULT_BACKGROUND)}
          {colorRow("popupBorder", "Border Color", DEFAULT_BORDER)}
          <div className="mt-2">
            <p className="text-[13px] text-stone-400 mb-1">Live preview</p>
            <div className="inline-block max-w-full border p-1.5 font-['Bender_Light'] text-[#e4e1d6]"
              style={{ backgroundColor: bg, borderColor: border, borderRadius: 0 }}>
              {config.showItemName && <div>Example item</div>}
              <div style={{color:"#abd61c"}}><span className="font-['Nunito']">₽</span><span
                style={(config.popupPriceBold ?? true)
                  ? {fontFamily:"Bender",fontWeight:700} : undefined}>40,300</span></div>
              <div><strong style={{fontFamily:"Bender",fontWeight:700}}>M</strong><span
                className="font-['Nunito']">₽</span></div>
              <div><strong style={{fontFamily:"Bender",fontWeight:700}}>3</strong> - Example quest</div>
            </div>
          </div>
        </section>
        <section className="mt-3 p-2.5 border border-[#44494a] bg-[#24282a] rounded">
          <h2 className="font-semibold text-[15px]">Text Styling</h2>
          {switchRow("Bold Main Popup Price", "Use the same Bender Bold font as ammo DMG/PEN for the price number only. Trader initials and quest amounts are always bold.", "popupPriceBold")}
        </section>
        <div className="mt-3 p-2.5 border border-[#44494a] bg-[#24282a] rounded">
          <h2 className="text-[15px] font-semibold">Calibration</h2>
          <p className="text-[13px] mt-1 text-stone-300">Press F2 to calibrate tooltip detection. Follow the instructions shown here; when calibration succeeds, F2 will restart Tarkov Tooltips.</p>
        </div>
        <p className="text-[13px] mt-2 text-stone-400">Keyboard shortcuts: F1 — show/hide Settings · F2 — calibrate</p>
        {busy && <p role="status" className="text-[13px] mt-2 text-[#abd61c]">{busy}</p>}
        {error && <p role="alert" className="text-[13px] mt-2 text-red-300">{error}</p>}
      </div>
    </main>
  );
}
