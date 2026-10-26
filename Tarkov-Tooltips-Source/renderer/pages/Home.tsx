import React, { useEffect, useState } from "react";
import { UserConfig } from "../../models/UserConfig";
import Settings from "../components/Settings";

type CalStatus = { stage: "preparing" | "ready" | "scanning" | "success" | "error"; message: string };

export function Home() {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [error, setError] = useState("");
  const [calibration, setCalibration] = useState<CalStatus | null>(null);

  useEffect(() => {
    window.electron.getUserConfig().then(setConfig).catch(e => setError(String(e)));
    const unsubscribe = window.electron.onCalibrationStatus((data) => setCalibration(data));
    return () => unsubscribe();
  }, []);

  if (calibration) {
    return <main className="h-screen overflow-y-auto bg-[#191b1c] text-[#e4e1d6] p-3 sm:p-6 flex items-start justify-center">
      <div className="max-w-lg w-full border border-[#44494a] rounded bg-[#2b2f30] p-3 sm:p-5">
        <h1 className="text-lg font-bold mb-3">Tarkov Tooltips Calibration</h1>
        <p className={"text-sm whitespace-normal break-words " +
          (calibration.stage === "error" ? "text-red-300" : calibration.stage === "success" ? "text-[#abd61c]" : "")}>
          {calibration.message}
        </p>
        {calibration.stage === "error" && <p className="mt-3 text-xs text-stone-400">Restart has been cancelled. Press F2 to retry calibration.</p>}
      </div>
    </main>;
  }
  if (!config) return <main className="bg-[#191b1c] p-5 text-[#e4e1d6]">{error || "Loading Settings…"}</main>;
  return <Settings
    config={config}
    onUpdate={setConfig}
    onClose={() => window.electron.hideSettingsWindow()}
  />;
}
