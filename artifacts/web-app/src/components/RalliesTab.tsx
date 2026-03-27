import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Rally, Proposal, RallyNotification } from "../App";
import { calculateRallyResults, formatTime, formatGap, parseTime } from "../App";

function smartFormatTime(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/[:.,]/.test(trimmed)) return trimmed;
  if (!/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed.length < 3) return trimmed;
  const min = trimmed[0];
  const sec = trimmed.slice(1, 3);
  const ms = trimmed.slice(3);
  return ms ? `${min}:${sec},${ms}` : `${min}:${sec},0`;
}

type Props = {
  rallies: Rally[];
  setRallies: React.Dispatch<React.SetStateAction<Rally[]>>;
  drivers: string[];
  currentRallyId: number | null;
  setCurrentRallyId: React.Dispatch<React.SetStateAction<number | null>>;
  activeSeason: number;
  proposals: Proposal[];
  setProposals: React.Dispatch<React.SetStateAction<Proposal[]>>;
  myName: string;
  setMyName: (name: string) => void;
  onOpenCalendar: () => void;
  notifications: RallyNotification[];
  onDismissNotification: (rallyId: number, ts: number) => void;
  onRegisterMyUpdate: (rallyId: number, ts: number) => void;
};

const RESPONSE_COLORS: Record<string, string> = {
  yes: "bg-green-600 hover:bg-green-500",
  maybe: "bg-yellow-600 hover:bg-yellow-500",
  no: "bg-red-700 hover:bg-red-600",
};
const RESPONSE_ACTIVE: Record<string, string> = {
  yes: "ring-2 ring-green-400",
  maybe: "ring-2 ring-yellow-300",
  no: "ring-2 ring-red-400",
};

export default function RalliesTab({ rallies, setRallies, drivers, currentRallyId, setCurrentRallyId, activeSeason, proposals, setProposals, myName, setMyName, onOpenCalendar, notifications, onDismissNotification, onRegisterMyUpdate }: Props) {
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

  // Auto-migrate stored raw-number times (e.g. "125689") to formatted ("1:25,689")
  useEffect(() => {
    if (!activeRally) return;
    let needsSave = false;
    const newResults: Record<string, string[]> = {};
    for (const driver of Object.keys(activeRally.results)) {
      const times = activeRally.results[driver] || [];
      const formatted = times.map((t) => {
        const f = smartFormatTime(t);
        if (f !== t) needsSave = true;
        return f;
      });
      newResults[driver] = formatted;
    }
    if (!needsSave) return;
    setRallies((prev) =>
      prev.map((r) =>
        r.id === activeRally.id ? { ...r, results: newResults } : r
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRallyId]);

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
    if (currentRallyId == null) return;
    setRallies((prev) =>
      prev.map((r) => {
        if (r.id !== currentRallyId) return r;
        const driverTimes = r.results[driver] ? [...r.results[driver]] : new Array(r.stages).fill("");
        const existing = driverTimes[stageIndex] ?? "";
        if (existing === value) return r; // no change — skip update
        driverTimes[stageIndex] = value;
        const ts = Date.now();
        onRegisterMyUpdate(currentRallyId, ts);
        return { ...r, results: { ...r.results, [driver]: driverTimes }, lastUpdated: ts };
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

  // Upcoming events: proposals with future dateISO or no dateISO, sorted ascending
  const todayISO = new Date().toISOString().split("T")[0];
  const upcomingProposals = [...proposals]
    .filter((p) => !p.dateISO || p.dateISO >= todayISO)
    .sort((a, b) => {
      if (a.dateISO && b.dateISO) return a.dateISO.localeCompare(b.dateISO);
      if (a.dateISO) return -1;
      if (b.dateISO) return 1;
      return b.id - a.id;
    })
    .slice(0, 3);

  function respondToProposal(proposalId: number, response: "yes" | "no" | "maybe") {
    if (!myName) return;
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== proposalId) return p;
        const current = p.responses[myName];
        if (current === response) {
          const updated = { ...p.responses };
          delete updated[myName];
          return { ...p, responses: updated };
        }
        return { ...p, responses: { ...p.responses, [myName]: response } };
      })
    );
  }

  return (
    <div>
      {/* Results update notifications */}
      <AnimatePresence>
        {notifications.map((n) => {
          const timeStr = new Date(n.ts).toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit" });
          return (
            <motion.div
              key={`${n.rallyId}-${n.ts}`}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="mb-3 flex items-center justify-between gap-3 bg-green-900/30 border border-green-600/50 rounded-2xl px-4 py-3"
            >
              <span className="text-sm">
                🏁 <span className="font-bold text-green-300">{n.name}</span>
                <span className="text-green-400"> tulemused on uuendatud!</span>
                <span className="text-zinc-500 ml-2 text-xs">{timeStr}</span>
              </span>
              <button
                onClick={() => onDismissNotification(n.rallyId, n.ts)}
                className="text-zinc-400 hover:text-white transition-colors text-lg leading-none flex-shrink-0"
                aria-label="Sulge"
              >
                ✕
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Upcoming events widget */}
      {upcomingProposals.length > 0 && (
        <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">📅 Järgmised mängukorrad</h3>
            <button
              onClick={onOpenCalendar}
              className="text-sm text-zinc-400 hover:text-yellow-400 transition-colors"
            >
              Vaata kõiki →
            </button>
          </div>

          {/* Name selector if not set */}
          {!myName && (
            <div className="mb-4 flex flex-wrap gap-2 items-center">
              <span className="text-zinc-500 text-sm">Kes sa oled?</span>
              {drivers.map((d) => (
                <button
                  key={d}
                  onClick={() => setMyName(d)}
                  className="px-3 py-1 rounded-lg text-sm font-bold bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {upcomingProposals.map((proposal) => {
              const myResponse = myName ? proposal.responses[myName] : undefined;
              const yesCount = Object.values(proposal.responses).filter((r) => r === "yes").length;
              const maybeCount = Object.values(proposal.responses).filter((r) => r === "maybe").length;
              return (
                <div key={proposal.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-zinc-800 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{proposal.dateText}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {yesCount > 0 && <span className="text-green-400">✅ {yesCount}</span>}
                      {maybeCount > 0 && <span className="text-yellow-400 ml-2">🤔 {maybeCount}</span>}
                      {proposal.rallyName && <span className="ml-2 text-zinc-400">· {proposal.rallyName}</span>}
                      {proposal.host && <span className="ml-2 text-zinc-400">· {proposal.host}</span>}
                    </p>
                  </div>
                  {myName && (
                    <div className="flex gap-1.5 shrink-0">
                      {(["yes", "maybe", "no"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => respondToProposal(proposal.id, r)}
                          title={r === "yes" ? "Sobib" : r === "maybe" ? "Võib-olla" : "Ei sobi"}
                          className={`w-9 h-9 rounded-lg text-base transition-all ${RESPONSE_COLORS[r]} ${
                            myResponse === r ? RESPONSE_ACTIVE[r] : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          {r === "yes" ? "✅" : r === "maybe" ? "🤔" : "❌"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="wrc-heading text-3xl sm:text-4xl text-white pl-3 border-l-4 border-yellow-400">Rallid</h2>
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
                <h3 className="wrc-heading text-3xl sm:text-4xl text-white">{activeRally.name}</h3>
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
                            defaultValue={smartFormatTime(rawTime)}
                            key={`${activeRally.id}-${driver}-${i}-${activeRally.stages}`}
                            onBlur={(e) => {
                              const formatted = smartFormatTime(e.target.value);
                              if (formatted !== e.target.value) e.target.value = formatted;
                              updateTime(driver, i, formatted);
                            }}
                            className={`w-full text-center px-1 py-1 rounded border focus:outline-none font-mono text-sm transition-colors ${
                              isBest
                                ? "bg-green-900/40 border-green-600 text-green-300"
                                : "bg-zinc-800 border-zinc-700 text-white focus:border-yellow-400"
                            }`}
                            placeholder="nt 342150"
                          />
                        </td>
                      );
                    })}
                    <td className="font-mono text-center p-2">
                      {dr ? (
                        <span className={dr.isComplete ? "" : "text-zinc-400"}>
                          {formatTime(dr.total)}
                          {!dr.isComplete && (
                            <span className="ml-1 text-xs text-zinc-500 font-sans">{dr.completedStages}/{activeRally.stages}</span>
                          )}
                        </span>
                      ) : "–"}
                    </td>
                    <td className={`font-mono text-center p-2 text-sm ${gap !== null && gap === 0 ? "text-yellow-400 font-bold" : dr && !dr.isComplete ? "text-zinc-500" : "text-zinc-400"}`}>
                      {dr ? (gap === 0 ? "Liider" : formatGap(gap!)) : "–"}
                    </td>
                    <td className={`text-center font-bold p-2 ${dr && !dr.isComplete ? "text-zinc-500" : ""}`}>
                      {dr ? dr.rank : "–"}
                    </td>
                    {!activeRally.quickRace && (
                      <>
                        <td className="text-center font-bold text-yellow-400 p-2">
                          {dr ? (dr.isComplete ? dr.overallPts : "–") : "–"}
                        </td>
                        <td className="text-center font-bold text-green-400 p-2">
                          {dr ? (dr.isComplete ? dr.psPts : "–") : "–"}
                        </td>
                        <td className="text-center font-bold text-xl p-2">
                          {dr ? (dr.isComplete ? dr.totalPts : "–") : "–"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Podium display */}
          {(() => {
            const finishers = results.filter((r) => r.isComplete);
            if (finishers.length < 3) return null;
            const [first, second, third] = [finishers[0], finishers[1], finishers[2]];
            const podiumEntries = [
              { entry: second, pos: 2, color: "text-zinc-300", bg: "bg-zinc-700/60 border-zinc-500", height: "h-20", label: "🥈", delay: 0.1 },
              { entry: first,  pos: 1, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-500", height: "h-32", label: "🥇", delay: 0 },
              { entry: third,  pos: 3, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-600", height: "h-14", label: "🥉", delay: 0.2 },
            ];
            return (
              <div className="mt-8 mb-2">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Poodiumi</p>
                <div className="flex items-end justify-center gap-3">
                  {podiumEntries.map(({ entry, pos, color, bg, height, label, delay }) => (
                    <motion.div
                      key={pos}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 18, delay }}
                      className={`flex-1 max-w-[180px] border rounded-2xl p-3 flex flex-col items-center justify-end ${bg} ${height}`}
                    >
                      <span className="text-2xl mb-1">{label}</span>
                      <p className={`font-bold text-sm text-center leading-tight ${color}`}>{entry.driver}</p>
                      <p className="font-mono text-xs text-zinc-400 mt-0.5">{formatTime(entry.total)}</p>
                      {!activeRally.quickRace && (
                        <p className={`text-xs font-bold mt-0.5 ${color}`}>{entry.totalPts}p</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })()}

          <p className="text-sm text-zinc-500 mt-4">
            * Sisesta ajad kujul <span className="font-mono text-zinc-300">m:ss,sss</span> (nt <span className="font-mono text-zinc-300">3:42,150</span>) või kiirelt <span className="font-mono text-zinc-300">342150</span>. <span className="text-green-500">Roheline</span> = etapi parim aeg.
          </p>
        </div>
      )}
    </div>
  );
}
