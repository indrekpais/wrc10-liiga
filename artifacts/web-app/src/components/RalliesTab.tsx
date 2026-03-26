import { useState } from "react";
import type { Rally } from "../App";
import { calculateRallyResults, formatTime, parseTime } from "../App";

type Props = {
  rallies: Rally[];
  setRallies: React.Dispatch<React.SetStateAction<Rally[]>>;
  drivers: string[];
  currentRallyId: number | null;
  setCurrentRallyId: React.Dispatch<React.SetStateAction<number | null>>;
};

export default function RalliesTab({ rallies, setRallies, drivers, currentRallyId, setCurrentRallyId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStages, setNewStages] = useState("15");

  const activeRally = rallies.find((r) => r.id === currentRallyId) ?? null;

  function createRally() {
    if (!newName.trim()) return;
    const stages = parseInt(newStages) || 15;
    const rally: Rally = {
      id: Date.now(),
      name: newName.trim(),
      date: newDate.trim(),
      stages,
      results: {},
    };
    setRallies((prev) => [...prev, rally]);
    setCurrentRallyId(rally.id);
    setShowForm(false);
    setNewName("");
    setNewDate("");
    setNewStages("15");
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

  const results = activeRally ? calculateRallyResults(activeRally, drivers) : [];

  function getDriverResult(driver: string) {
    return results.find((d) => d.driver === driver);
  }

  function deleteRally(id: number) {
    if (!confirm("Kustutada see ralli?")) return;
    setRallies((prev) => prev.filter((r) => r.id !== id));
    if (currentRallyId === id) setCurrentRallyId(null);
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
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Kuupäev</label>
                <input
                  className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-yellow-400"
                  placeholder="nt 10/11.04"
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
              <div className="flex gap-3 mt-2">
                <button
                  onClick={createRally}
                  className="flex-1 bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-300 transition-colors"
                >
                  Loo ralli
                </button>
                <button
                  onClick={() => setShowForm(false)}
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
        {rallies.map((r) => (
          <div
            key={r.id}
            onClick={() => setCurrentRallyId(r.id)}
            className={`p-6 rounded-3xl border cursor-pointer transition-colors ${
              r.id === currentRallyId
                ? "border-yellow-400 bg-zinc-800"
                : "border-zinc-700 hover:border-zinc-500"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-xl">{r.name}</h4>
                <p className="text-yellow-400">{r.date}</p>
                <p className="text-sm text-zinc-400 mt-2">
                  {r.stages} etappi • {Object.keys(r.results || {}).length}/{drivers.length} juhti
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteRally(r.id); }}
                className="text-zinc-600 hover:text-red-500 transition-colors text-lg ml-2"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeRally && (
        <div className="border border-yellow-400 rounded-3xl p-6 bg-zinc-900 overflow-x-auto">
          <div className="flex justify-between items-center mb-6 gap-4">
            <div>
              <h3 className="text-3xl font-bold">{activeRally.name}</h3>
              <p className="text-yellow-400">{activeRally.date}</p>
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
                <th className="bg-yellow-400 text-black font-bold p-2 min-w-[60px] text-center">Koht</th>
                <th className="bg-yellow-400 text-black font-bold p-2 min-w-[60px] text-center">Punktid</th>
                <th className="bg-yellow-400 text-black font-bold p-2 min-w-[60px] text-center">PS</th>
                <th className="bg-yellow-400 text-black font-bold p-2 min-w-[70px] text-center">Kokku</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                const times = activeRally.results[driver] || new Array(activeRally.stages).fill("");
                const dr = getDriverResult(driver);
                return (
                  <tr key={driver} className="border-b border-zinc-700">
                    <td className="font-bold p-2 sticky left-0 bg-zinc-900 z-10">{driver}</td>
                    {Array.from({ length: activeRally.stages }, (_, i) => (
                      <td key={i} className="p-1">
                        <input
                          type="text"
                          defaultValue={times[i] || ""}
                          onBlur={(e) => updateTime(driver, i, e.target.value)}
                          className="w-full bg-zinc-800 text-white text-center px-1 py-1 rounded border border-zinc-700 focus:outline-none focus:border-yellow-400 font-mono text-sm"
                          placeholder="–"
                        />
                      </td>
                    ))}
                    <td className="font-mono text-center p-2">{dr ? formatTime(dr.total) : "–"}</td>
                    <td className="text-center font-bold p-2">{dr ? dr.rank : "–"}</td>
                    <td className="text-center font-bold text-yellow-400 p-2">{dr ? dr.overallPts : "0"}</td>
                    <td className="text-center font-bold text-green-400 p-2">{dr ? dr.psPts : "0"}</td>
                    <td className="text-center font-bold text-xl p-2">{dr ? dr.totalPts : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="text-sm text-zinc-500 mt-4">
            * Tulemused arvutatakse automaatselt. Sisesta ajad kujul <span className="font-mono text-zinc-300">m:ss,sss</span> (nt <span className="font-mono text-zinc-300">3:42,150</span>). Tulemused salvestatakse automaatselt.
          </p>
        </div>
      )}
    </div>
  );
}
