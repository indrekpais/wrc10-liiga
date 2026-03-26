import { useState, useEffect } from "react";
import RalliesTab from "./components/RalliesTab";
import DriversTab from "./components/DriversTab";
import ChampionshipTab from "./components/ChampionshipTab";

export type Rally = {
  id: number;
  name: string;
  date: string;
  stages: number;
  results: Record<string, string[]>;
};

const POINTS_TABLE = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const PS_POINTS_TABLE = [5, 4, 3, 2, 1];

export function parseTime(str: string): number {
  if (!str) return Infinity;
  const s = str.replace(",", ".");
  const parts = s.split(":");
  if (parts.length === 1) return parseFloat(parts[0]) || Infinity;
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
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

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [drivers, setDrivers] = useState<string[]>(() =>
    loadFromStorage("wrcDrivers", ["Risto", "Alar", "Kaupo", "Indrek", "Tanel"])
  );
  const [rallies, setRallies] = useState<Rally[]>(() => {
    const saved = loadFromStorage<Rally[]>("wrcRallies", []);
    if (saved.length === 0) {
      return [{ id: 1, name: "Monte Carlo", date: "10/11.04", stages: 15, results: {} }];
    }
    return saved;
  });
  const [currentRallyId, setCurrentRallyId] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem("wrcDrivers", JSON.stringify(drivers));
  }, [drivers]);

  useEffect(() => {
    localStorage.setItem("wrcRallies", JSON.stringify(rallies));
  }, [rallies]);

  const tabs = ["RALLID", "JUHTID", "ÜLDARVESTUS"];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto p-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400">WRC 10 • Meie Liiga</h1>
          <div className="flex gap-2 sm:gap-4">
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

        {activeTab === 0 && (
          <RalliesTab
            rallies={rallies}
            setRallies={setRallies}
            drivers={drivers}
            currentRallyId={currentRallyId}
            setCurrentRallyId={setCurrentRallyId}
          />
        )}
        {activeTab === 1 && (
          <DriversTab drivers={drivers} setDrivers={setDrivers} />
        )}
        {activeTab === 2 && (
          <ChampionshipTab rallies={rallies} drivers={drivers} />
        )}
      </div>
    </div>
  );
}
