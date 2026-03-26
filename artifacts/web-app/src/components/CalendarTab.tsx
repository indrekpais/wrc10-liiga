import { useState } from "react";
import type { Proposal } from "../App";

type Props = {
  proposals: Proposal[];
  setProposals: React.Dispatch<React.SetStateAction<Proposal[]>>;
  drivers: string[];
};

const RESPONSE_LABELS: Record<string, string> = {
  yes: "✅ Sobib",
  maybe: "🤔 Võib-olla",
  no: "❌ Ei sobi",
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

const DAYS_ET = ["Pühapäev", "Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede", "Laupäev"];
const MONTHS_ET = [
  "jaanuaril", "veebruaril", "märtsil", "aprillil", "mail", "juunil",
  "juulil", "augustil", "septembril", "oktoobril", "novembril", "detsembril",
];

function formatDateDisplay(dateStr: string, timeStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  const day = DAYS_ET[d.getDay()];
  const month = MONTHS_ET[d.getMonth()];
  const date = d.getDate();
  const year = d.getFullYear();
  const time = timeStr ? ` kell ${timeStr}` : "";
  return `${day}, ${date}. ${month} ${year}${time}`;
}

function generateTimes(): string[] {
  const times: string[] = [];
  for (let h = 10; h <= 23; h++) {
    times.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 23) times.push(`${String(h).padStart(2, "0")}:30`);
  }
  return times;
}

const TIME_OPTIONS = generateTimes();

export default function CalendarTab({ proposals, setProposals, drivers }: Props) {
  const [myName, setMyName] = useState<string>(() =>
    localStorage.getItem("wrcCurrentUser") || ""
  );
  const [newDateValue, setNewDateValue] = useState("");
  const [newTimeValue, setNewTimeValue] = useState("19:00");
  const [newHost, setNewHost] = useState("");
  const [newRallyName, setNewRallyName] = useState("");
  const [showForm, setShowForm] = useState(false);

  function selectName(name: string) {
    setMyName(name);
    localStorage.setItem("wrcCurrentUser", name);
  }

  function addProposal() {
    if (!newDateValue || !myName) return;
    const displayText = formatDateDisplay(newDateValue, newTimeValue);
    const proposal: Proposal = {
      id: Date.now(),
      proposedBy: myName,
      dateText: displayText,
      host: newHost.trim() || undefined,
      rallyName: newRallyName.trim() || undefined,
      responses: { [myName]: "yes" },
    };
    setProposals((prev) => [proposal, ...prev]);
    setNewDateValue("");
    setNewTimeValue("19:00");
    setNewHost("");
    setNewRallyName("");
    setShowForm(false);
  }

  function respond(proposalId: number, response: "yes" | "no" | "maybe") {
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

  function deleteProposal(id: number) {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }

  function getRespondedNames(proposal: Proposal, type: "yes" | "no" | "maybe") {
    return Object.entries(proposal.responses)
      .filter(([, r]) => r === type)
      .map(([name]) => name);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="flex justify-between items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold">Kalender</h2>
        {myName && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-xl font-bold transition-colors"
          >
            + Paku aega
          </button>
        )}
      </div>

      {/* Name selector */}
      <div className="mb-8 p-5 bg-zinc-900 rounded-2xl border border-zinc-700">
        <p className="text-zinc-400 text-sm mb-3">Kes sa oled?</p>
        <div className="flex flex-wrap gap-2">
          {drivers.map((d) => (
            <button
              key={d}
              onClick={() => selectName(d)}
              className={`px-5 py-2 rounded-xl font-bold transition-colors ${
                myName === d
                  ? "bg-yellow-400 text-black"
                  : "bg-zinc-800 hover:bg-zinc-700"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        {!myName && (
          <p className="text-zinc-500 text-sm mt-3">
            Vali oma nimi, et saaksid aegadele vastata ja uusi pakkuda.
          </p>
        )}
      </div>

      {/* New proposal modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 w-full max-w-md">
            <h3 className="text-2xl font-bold mb-6">Paku mänguaega</h3>
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Kuupäev</label>
                <input
                  type="date"
                  min={todayStr}
                  className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-yellow-400 [color-scheme:dark]"
                  value={newDateValue}
                  onChange={(e) => setNewDateValue(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Kellaaeg</label>
                <select
                  className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-yellow-400 appearance-none"
                  value={newTimeValue}
                  onChange={(e) => setNewTimeValue(e.target.value)}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Kelle juures mängime? <span className="text-zinc-600">(vabatahtlik)</span>
                </label>
                <input
                  className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-yellow-400"
                  placeholder="nt Risto juures"
                  value={newHost}
                  onChange={(e) => setNewHost(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Mis ralli? <span className="text-zinc-600">(vabatahtlik)</span>
                </label>
                <input
                  className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:outline-none focus:border-yellow-400"
                  placeholder="nt Monte Carlo, Safari Rally..."
                  value={newRallyName}
                  onChange={(e) => setNewRallyName(e.target.value)}
                />
              </div>

              {newDateValue && (
                <div className="bg-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300">
                  <span className="text-zinc-500">Eelvaade: </span>
                  {formatDateDisplay(newDateValue, newTimeValue)}
                  {newHost && <span className="text-zinc-400"> · {newHost}</span>}
                  {newRallyName && <span className="text-zinc-400"> · {newRallyName}</span>}
                </div>
              )}

              <div className="flex gap-3 mt-1">
                <button
                  onClick={addProposal}
                  disabled={!newDateValue}
                  className="flex-1 bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-40"
                >
                  Paku
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewDateValue(""); }}
                  className="flex-1 bg-zinc-700 font-bold py-3 rounded-xl hover:bg-zinc-600 transition-colors"
                >
                  Tühista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposals */}
      {proposals.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-5xl mb-4">📅</p>
          <p className="text-lg">Ühtegi ettepanekut pole veel.</p>
          {myName ? (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors"
            >
              + Paku esimest aega
            </button>
          ) : (
            <p className="mt-2 text-sm">Vali ülalt oma nimi, et hakata ettepanekuid tegema.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {proposals.map((proposal) => {
            const myResponse = myName ? proposal.responses[myName] : undefined;
            const yesNames = getRespondedNames(proposal, "yes");
            const maybeNames = getRespondedNames(proposal, "maybe");
            const noNames = getRespondedNames(proposal, "no");
            const totalDrivers = drivers.length;
            const respondedCount = Object.keys(proposal.responses).length;

            return (
              <div key={proposal.id} className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-bold">{proposal.dateText}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      {proposal.rallyName && (
                        <span className="text-sm bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2.5 py-0.5 rounded-lg font-medium">
                          🏁 {proposal.rallyName}
                        </span>
                      )}
                      {proposal.host && (
                        <span className="text-sm bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-0.5 rounded-lg">
                          🏠 {proposal.host}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-sm mt-1.5">
                      <span className="text-zinc-500">Pakkuja: </span>
                      <span className="text-yellow-400">{proposal.proposedBy}</span>
                      {" · "}{respondedCount}/{totalDrivers} vastanud
                    </p>
                  </div>
                  {myName === proposal.proposedBy && (
                    <button
                      onClick={() => deleteProposal(proposal.id)}
                      className="text-zinc-600 hover:text-red-500 transition-colors text-lg shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Response summary */}
                <div className="flex flex-col gap-1 mb-4 text-sm">
                  {yesNames.length > 0 && (
                    <div>
                      <span className="text-green-400 font-bold">✅ Sobib ({yesNames.length}):</span>{" "}
                      <span className="text-zinc-300">{yesNames.join(", ")}</span>
                    </div>
                  )}
                  {maybeNames.length > 0 && (
                    <div>
                      <span className="text-yellow-400 font-bold">🤔 Võib-olla ({maybeNames.length}):</span>{" "}
                      <span className="text-zinc-300">{maybeNames.join(", ")}</span>
                    </div>
                  )}
                  {noNames.length > 0 && (
                    <div>
                      <span className="text-red-400 font-bold">❌ Ei sobi ({noNames.length}):</span>{" "}
                      <span className="text-zinc-300">{noNames.join(", ")}</span>
                    </div>
                  )}
                  {Object.keys(proposal.responses).length === 0 && (
                    <span className="text-zinc-500">Keegi pole veel vastanud.</span>
                  )}
                </div>

                {/* Voting buttons */}
                {myName && (
                  <div className="flex gap-2 flex-wrap">
                    {(["yes", "maybe", "no"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => respond(proposal.id, r)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${RESPONSE_COLORS[r]} ${
                          myResponse === r ? RESPONSE_ACTIVE[r] : "opacity-70 hover:opacity-100"
                        }`}
                      >
                        {RESPONSE_LABELS[r]}
                        {myResponse === r && " ✓"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Progress bar */}
                {totalDrivers > 0 && (
                  <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-zinc-800">
                    <div
                      className="bg-green-500 transition-all"
                      style={{ width: `${(yesNames.length / totalDrivers) * 100}%` }}
                    />
                    <div
                      className="bg-yellow-500 transition-all"
                      style={{ width: `${(maybeNames.length / totalDrivers) * 100}%` }}
                    />
                    <div
                      className="bg-red-600 transition-all"
                      style={{ width: `${(noNames.length / totalDrivers) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
