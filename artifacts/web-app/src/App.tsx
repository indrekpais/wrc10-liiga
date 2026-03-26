import { useState, useEffect } from "react";
import RalliesTab from "./components/RalliesTab";
import DriversTab from "./components/DriversTab";
import ChampionshipTab from "./components/ChampionshipTab";
import CalendarTab from "./components/CalendarTab";

export type Rally = {
  id: number;
  name: string;
  date: string;
  stages: number;
  results: Record<string, string[]>;
  season?: number;
  quickRace?: boolean;
};

export type Proposal = {
  id: number;
  proposedBy: string;
  dateText: string;
  host?: string;
  rallyName?: string;
  responses: Record<string, "yes" | "no" | "maybe">;
};

const POINTS_TABLE = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const PS_POINTS_TABLE = [5, 4, 3, 2, 1];

export function parseTime(str: string): number {
  if (!str || !str.trim()) return Infinity;
  const parts = str.trim().split(/[.,:]+/).filter((p) => p.length > 0);
  const nums = parts.map((p) => parseFloat(p.replace(",", ".")));
  if (nums.some(isNaN)) return Infinity;
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length >= 3) return nums[0] * 60 + nums[1] + nums[2] / 1000;
  return Infinity;
}

export function formatTime(seconds: number): string {
  if (seconds === Infinity || isNaN(seconds)) return "–";
  const min = Math.floor(seconds / 60);
  const sec = (seconds % 60).toFixed(3).replace(".", ",");
  return `${min}:${sec.padStart(6, "0")}`;
}

export type DriverResult = {
  driver: string;
  total: number;
  psTime: number;
  rank: number;
  overallPts: number;
  psPts: number;
  totalPts: number;
};

export function calculateRallyResults(rally: Rally, drivers: string[]): DriverResult[] {
  const results: DriverResult[] = [];

  drivers.forEach((driver) => {
    const times = rally.results[driver] || [];
    if (times.length < rally.stages || times.some((t) => !t)) return;

    let total = 0;
    times.forEach((t) => { total += parseTime(t); });

    results.push({
      driver,
      total,
      psTime: parseTime(times[rally.stages - 1]),
      rank: 0,
      overallPts: 0,
      psPts: 0,
      totalPts: 0,
    });
  });

  results.sort((a, b) => a.total - b.total);
  results.forEach((d, i) => {
    const rank = i + 1;
    d.rank = rank;
    d.overallPts = rank < POINTS_TABLE.length ? POINTS_TABLE[rank] : 0;
  });

  const psSorted = [...results].sort((a, b) => a.psTime - b.psTime);
  psSorted.forEach((d, i) => {
    d.psPts = i < 5 ? PS_POINTS_TABLE[i] : 0;
  });

  results.forEach((d) => {
    d.totalPts = (d.overallPts || 0) + (d.psPts || 0);
  });

  return results;
}

function loadFromStorage<T>(key: string, defaultVal: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultVal;
  } catch {
    return defaultVal;
  }
}

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [drivers, setDrivers] = useState<string[]>(() =>
    loadFromStorage("wrcDrivers", ["Risto", "Alar", "Kaupo", "Indrek", "Tanel"])
  );
  const [rallies, setRallies] = useState<Rally[]>(() => {
    const saved = loadFromStorage<Rally[]>("wrcRallies", []);
    if (saved.length === 0) {
      return [{ id: 1, name: "Monte Carlo", date: "10/11.04", stages: 15, results: {}, season: CURRENT_YEAR }];
    }
    return saved;
  });
  const [proposals, setProposals] = useState<Proposal[]>(() =>
    loadFromStorage("wrcProposals", [])
  );
  const [currentRallyId, setCurrentRallyId] = useState<number | null>(null);

  // Seasons derived from existing rallies + current year
  const availableSeasons: number[] = Array.from(
    new Set([
      CURRENT_YEAR,
      ...rallies.map((r) => r.season ?? CURRENT_YEAR),
    ])
  ).sort((a, b) => a - b);

  const [activeSeason, setActiveSeason] = useState<number>(() => {
    const saved = localStorage.getItem("wrcActiveSeason");
    return saved ? parseInt(saved) : CURRENT_YEAR;
  });

  useEffect(() => {
    localStorage.setItem("wrcDrivers", JSON.stringify(drivers));
  }, [drivers]);

  useEffect(() => {
    localStorage.setItem("wrcRallies", JSON.stringify(rallies));
  }, [rallies]);

  useEffect(() => {
    localStorage.setItem("wrcProposals", JSON.stringify(proposals));
  }, [proposals]);

  useEffect(() => {
    localStorage.setItem("wrcActiveSeason", String(activeSeason));
  }, [activeSeason]);

  function addSeason() {
    const year = prompt("Uue hooaja aasta:", String(CURRENT_YEAR + 1));
    if (!year) return;
    const num = parseInt(year);
    if (!isNaN(num) && num > 2000 && num < 2100) {
      setActiveSeason(num);
    }
  }

  function handleSeasonChange(season: number) {
    setActiveSeason(season);
    setCurrentRallyId(null);
  }

  const seasonRallies = rallies.filter((r) => (r.season ?? CURRENT_YEAR) === activeSeason);

  const tabs = ["RALLID", "JUHID", "ÜLDARVESTUS", "KALENDER"];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto p-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400">WRC 10 • Meie Liiga</h1>
          <div className="flex gap-2 sm:gap-4 flex-wrap">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-bold transition-colors text-sm sm:text-base ${
                  activeTab === i
                    ? "bg-yellow-400 text-black"
                    : "text-white hover:bg-zinc-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        {/* Season selector */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          <span className="text-zinc-500 text-sm">Hooaeg:</span>
          {availableSeasons.map((s) => (
            <button
              key={s}
              onClick={() => handleSeasonChange(s)}
              className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-colors ${
                activeSeason === s
                  ? "bg-yellow-400 text-black"
                  : "bg-zinc-800 hover:bg-zinc-700 text-white"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={addSeason}
            className="px-3 py-1.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            + Lisa hooaeg
          </button>
        </div>

        {activeTab === 0 && (
          <RalliesTab
            rallies={seasonRallies}
            setRallies={setRallies}
            drivers={drivers}
            currentRallyId={currentRallyId}
            setCurrentRallyId={setCurrentRallyId}
            activeSeason={activeSeason}
          />
        )}
        {activeTab === 1 && (
          <DriversTab drivers={drivers} setDrivers={setDrivers} />
        )}
        {activeTab === 2 && (
          <ChampionshipTab rallies={seasonRallies} drivers={drivers} activeSeason={activeSeason} />
        )}
        {activeTab === 3 && (
          <CalendarTab proposals={proposals} setProposals={setProposals} drivers={drivers} />
        )}
      </div>
    </div>
  );
}
