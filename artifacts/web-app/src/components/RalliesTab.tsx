import { useState } from "react";
import type { Rally } from "../App";
import { calculateRallyResults, formatTime, formatGap, parseTime } from "../App";

type Props = {
  rallies: Rally[];
  setRallies: React.Dispatch<React.SetStateAction<Rally[]>>;
  drivers: string[];
  currentRallyId: number | null;
  setCurrentRallyId: React.Dispatch<React.SetStateAction<number | null>>;
  activeSeason: number;
};

export default function RalliesTab({ rallies, setRallies, drivers, currentRallyId, setCurrentRallyId, activeSeason }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStages, setNewStages] = useState("15");
  const [newQuickRace, setNewQuickRace] = useState(false);

  function formatRallyDate(dateStr: string): string {
    if (!dateStr) return "";
    if (!dateStr.includes("-")) return dateStr;
    const d = new Date(dateStr + "T12:00:00");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  const activeRally = rallies.find((r) => r.id === currentRallyId) ?? null;

  function createRally() {
    if (!newName.trim()) return;
    const stages = parseInt(newStages) || 15;
    const rally: Rally = {
      id: Date.now(),
      name: newName.trim(),
      date: newDate ? formatRallyDate(newDate) : "",
      stages,
      results: {},
      season: activeSeason,
      quickRace: newQuickRace,
    };
    setRallies((prev) => [...prev, rally]);
    setCurrentRallyId(rally.id);
    setShowForm(false);
    setNewName("");
    setNewDate("");
    setNewStages("15");
    setNewQuickRace(false);
  }

  function updateTime(driver: string, stageIndex: number, value: string) {
    setRallies((prev) =>
      prev.map((r) => {
        if (r.id !== currentRallyId) return r;
        const driverTimes = r.results[driver] ? [...r.results[driver]] : new Array(r.stages).fill("");
        driverTimes[stageIndex] = value;
        return { ...r, results: { ...r.results, [driver]: driverTimes } };
      })
    );
  }

  function addStage() {
    setRallies((prev) =>
      prev.map((r) => {
        if (r.id !== currentRallyId) return r;
        const newResults: Record<string, string[]> = {};
        for (const driver of Object.keys(r.results)) {
          newResults[driver] = [...(r.results[driver] || []), ""];
        }
        return { ...r, stages: r.stages + 1, results: newResults };
      })
    );
  }

  function removeStage() {
    if (!activeRally || activeRally.stages <= 1) return;
    const hasData = Object.values(activeRally.results).some(
      (times) => times[activeRally.stages - 1]?.trim()
    );
    if (hasData && !confirm(`Viimases etapis (SS${activeRally.stages}) on andmeid. Kustutada?`)) return;
    setRallies((prev) =>
      prev.map((r) => {
        if (r.id !== currentRallyId) return r;
        const newResults: Record<string, string[]> = {};
        for (const driver of Object.keys(r.results)) {
          newResults[driver] = (r.results[driver] || []).slice(0, -1);
        }
        return { ...r, stages: r.stages - 1, results: newResults };
      })
    );
  }

  function deleteRally(id: number) {
    if (!confirm("Kustutada see ralli?")) return;
    setRallies((prev) => prev.filter((r) => r.id !== id));
    if (currentRallyId === id) setCurrentRallyId(null);
  }

  // Compute best time per stage and results for active rally
  const results = activeRally ? calculateRallyResults(activeRally, drivers) : [];
  const leaderTime = results.length > 0 ? results[0].total : 0;

  function getDriverResult(driver: string) {
    return results.find((d) => d.driver === driver);
  }

  // Fastest time per stage index across all drivers (for highlight)
  const bestStageTimes: number[] = activeRally
    ? Array.from({ length: activeRally.stages }, (_, i) =>
        Math.min(
          ...drivers.map((driver) => {
            const t = (activeRally.results[driver] || [])[i];
            return t ? parseTime(t) : Infinity;
          })
        )
      )
    : [];

  // Completion info: count drivers with all stages filled
  function getRallyCompletion(r: Rally) {
    const complete = drivers.filter((driver) => {
      const times = r.results[driver] || [];
      return times.length >= r.stages && times.every((t) => t.trim());
    });
    return { complete: complete.length, total: drivers.length };
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Rallid</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-xl font-bold transition-colors"
        >
          + Uus ralli
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 w-full max-w-md">
            <h3 className="text-2xl font-bold mb-6">Uus ralli</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Ralli nimi</label>
                <input
                  className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-yellow-400"
                  placeholder="nt Monte Carlo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createRally()}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Kuupäev</label>
                <input
                  type="date"
                  className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-yellow-400 [color-scheme:dark]"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Etappide arv</label>
                <input
                  className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-yellow-400"
                  type="number"
                  min={1}
                  max={30}
                  value={newStages}
                  onChange={(e) => setNewStages(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setNewQuickRace(!newQuickRace)}
                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${newQuickRace ? "bg-orange-500" : "bg-zinc-700"}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${newQuickRace ? "translate-x-6" : "translate-x-0"}`} />
                </div>
                <span className="text-sm">
                  <span className="text-white font-semibold">Quick Race</span>
                  <span className="text-zinc-400 ml-2">— ei lähe hooaja üldarvestusse</span>
                </span>
              </label>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={createRally}
                  className="flex-1 bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-300 transition-colors"
                >
                  Loo ralli
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewQuickRace(false); }}
                  className="flex-1 bg-zinc-700 font-bold py-3 rounded-xl hover:bg-zinc-600 transition-colors"
                >
                  Tühista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {rallies.map((r) => {
          const { complete, total } = getRallyCompletion(r);
          const pct = total > 0 ? (complete / total) * 100 : 0;
          return (
            <div
              key={r.id}
              onClick={() => setCurrentRallyId(r.id)}
              className={`p-6 rounded-3xl border cursor-pointer transition-colors ${
                r.id === currentRallyId
                  ? r.quickRace ? "border-orange-400 bg-zinc-800" : "border-yellow-400 bg-zinc-800"
                  : "border-zinc-700 hover:border-zinc-500"
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-xl">{r.name}</h4>
                    {r.quickRace && (
                      <span className="text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-full">
                        ⚡ Quick Race
                      </span>
                    )}
                  </div>
                  <p className={r.quickRace ? "text-orange-400" : "text-yellow-400"}>{r.date}</p>
                  <p className="text-sm text-zinc-400 mt-2">
                    {r.stages} etappi • {complete}/{total} juhti lõpetanud
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRally(r.id); }}
                  className="text-zinc-600 hover:text-red-500 transition-colors text-lg ml-2 flex-shrink-0"
                >
                  ✕
                </button>
              </div>
              {/* Completion bar */}
              <div className="mt-3 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : r.quickRace ? "bg-orange-400" : "bg-yellow-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {activeRally && (
        <div className={`border rounded-3xl p-6 bg-zinc-900 overflow-x-auto ${activeRally.quickRace ? "border-orange-400" : "border-yellow-400"}`}>
          <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-3xl font-bold">{activeRally.name}</h3>
                {activeRally.quickRace && (
                  <span className="text-sm font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 px-3 py-1 rounded-full">
                    ⚡ Quick Race
                  </span>
                )}
              </div>
              <p className={activeRally.quickRace ? "text-orange-400" : "text-yellow-400"}>{activeRally.date}</p>
            </div>
            <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-4 py-2">
              <span className="text-zinc-400 text-sm">Etapid:</span>
              <button
                onClick={removeStage}
                disabled={activeRally.stages <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                title="Eemalda viimane etapp"
              >
                −
              </button>
              <span className="font-bold text-xl w-8 text-center">{activeRally.stages}</span>
              <button
                onClick={addStage}
                disabled={activeRally.stages >= 30}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                title="Lisa etapp"
              >
                +
              </button>
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-yellow-400 text-black font-bold p-2 text-left min-w-[120px] sticky left-0 z-10">Juht</th>
                {Array.from({ length: activeRally.stages }, (_, i) => (
                  <th key={i} className="bg-yellow-400 text-black font-bold p-2 min-w-[90px] text-center">
                    {i === activeRally.stages - 1 ? `PS${i + 1}` : `SS${i + 1}`}
                  </th>
                ))}
                <th className="bg-yellow-400 text-black font-bold p-2 min-w-[110px] text-center">Koguaeg</th>
                <th className="bg-yellow-400 text-black font-bold p-2 min-w-[100px] text-center">Vahe</th>
                <th className="bg-yellow-400 text-black font-bold p-2 min-w-[60px] text-center">Koht</th>
                {!activeRally.quickRace && (
                  <>
                    <th className="bg-yellow-400 text-black font-bold p-2 min-w-[60px] text-center">Punktid</th>
                    <th className="bg-yellow-400 text-black font-bold p-2 min-w-[60px] text-center">PS</th>
                    <th className="bg-yellow-400 text-black font-bold p-2 min-w-[70px] text-center">Kokku</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                const times = activeRally.results[driver] || new Array(activeRally.stages).fill("");
                const dr = getDriverResult(driver);
                const gap = dr ? dr.total - leaderTime : null;
                return (
                  <tr key={driver} className="border-b border-zinc-700">
                    <td className="font-bold p-2 sticky left-0 bg-zinc-900 z-10">{driver}</td>
                    {Array.from({ length: activeRally.stages }, (_, i) => {
                      const rawTime = times[i] || "";
                      const parsed = rawTime ? parseTime(rawTime) : Infinity;
                      const isBest = parsed !== Infinity && bestStageTimes[i] !== Infinity && parsed === bestStageTimes[i];
                      return (
                        <td key={i} className="p-1">
                          <input
                            type="text"
                            defaultValue={rawTime}
                            key={`${activeRally.id}-${driver}-${i}-${activeRally.stages}`}
                            onBlur={(e) => updateTime(driver, i, e.target.value)}
                            className={`w-full text-center px-1 py-1 rounded border focus:outline-none font-mono text-sm transition-colors ${
                              isBest
                                ? "bg-green-900/40 border-green-600 text-green-300"
                                : "bg-zinc-800 border-zinc-700 text-white focus:border-yellow-400"
                            }`}
                            placeholder="–"
                          />
                        </td>
                      );
                    })}
                    <td className="font-mono text-center p-2">{dr ? formatTime(dr.total) : "–"}</td>
                    <td className={`font-mono text-center p-2 text-sm ${gap !== null && gap === 0 ? "text-yellow-400 font-bold" : "text-zinc-400"}`}>
                      {dr ? (gap === 0 ? "Liider" : formatGap(gap!)) : "–"}
                    </td>
                    <td className="text-center font-bold p-2">{dr ? dr.rank : "–"}</td>
                    {!activeRally.quickRace && (
                      <>
                        <td className="text-center font-bold text-yellow-400 p-2">{dr ? dr.overallPts : "0"}</td>
                        <td className="text-center font-bold text-green-400 p-2">{dr ? dr.psPts : "0"}</td>
                        <td className="text-center font-bold text-xl p-2">{dr ? dr.totalPts : "0"}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {results.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-500">
              <span>🏆 <span className="text-white font-bold">{results[0].driver}</span> · {formatTime(results[0].total)}</span>
              {results[1] && <span>· 2. <span className="text-zinc-300">{results[1].driver}</span> {formatGap(results[1].total - results[0].total)}</span>}
              {results[2] && <span>· 3. <span className="text-zinc-300">{results[2].driver}</span> {formatGap(results[2].total - results[0].total)}</span>}
            </div>
          )}

          <p className="text-sm text-zinc-500 mt-3">
            * Sisesta ajad kujul <span className="font-mono text-zinc-300">m:ss,sss</span> (nt <span className="font-mono text-zinc-300">3:42,150</span>). <span className="text-green-500">Roheline</span> = etapi parim aeg.
          </p>
        </div>
      )}
    </div>
  );
}
