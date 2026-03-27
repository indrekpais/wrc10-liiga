import { useState, useEffect, useRef, useCallback } from "react";
import RalliesTab from "./components/RalliesTab";
import DriversTab from "./components/DriversTab";
import ChampionshipTab from "./components/ChampionshipTab";
import CalendarTab from "./components/CalendarTab";
import { useGetAppData, updateAppData } from "@workspace/api-client-react";
import wrcCarImg from "./assets/wrc-car.png";

export type Rally = {
  id: number;
  name: string;
  date: string;
  stages: number;
  results: Record<string, string[]>;
  season?: number;
  quickRace?: boolean;
  lastUpdated?: number;
};

export type RallyNotification = {
  rallyId: number;
  name: string;
  ts: number;
};

export type Proposal = {
  id: number;
  proposedBy: string;
  dateText: string;
  dateISO?: string;
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

export function formatGap(seconds: number): string {
  if (seconds === 0) return "–";
  if (seconds === Infinity || isNaN(seconds)) return "–";
  const min = Math.floor(seconds / 60);
  const sec = (seconds % 60).toFixed(3).replace(".", ",");
  if (min === 0) return `+${sec.padStart(6, "0")}`;
  return `+${min}:${sec.padStart(6, "0")}`;
}

export type DriverResult = {
  driver: string;
  total: number;
  psTime: number;
  rank: number;
  overallPts: number;
  psPts: number;
  totalPts: number;
  completedStages: number;
  isComplete: boolean;
};

export function calculateRallyResults(rally: Rally, drivers: string[]): DriverResult[] {
  const results: DriverResult[] = [];

  drivers.forEach((driver) => {
    const times = rally.results[driver] || [];
    // Count non-empty entries up to rally.stages
    const filled = times.slice(0, rally.stages).filter((t) => t && t.trim());
    if (filled.length === 0) return; // nothing entered — skip

    let total = 0;
    times.slice(0, rally.stages).forEach((t) => {
      if (t && t.trim()) total += parseTime(t);
    });

    const isComplete = filled.length >= rally.stages;
    const lastFilledTime = isComplete ? times[rally.stages - 1] : "";

    results.push({
      driver,
      total,
      psTime: isComplete ? parseTime(lastFilledTime) : Infinity,
      rank: 0,
      overallPts: 0,
      psPts: 0,
      totalPts: 0,
      completedStages: filled.length,
      isComplete,
    });
  });

  // Rank all drivers who have ANY times by their partial total
  results.sort((a, b) => a.total - b.total);
  results.forEach((d, i) => {
    d.rank = i + 1;
    // Points only for fully completed drivers
    d.overallPts = d.isComplete && d.rank < POINTS_TABLE.length ? POINTS_TABLE[d.rank] : 0;
  });

  // Power Stage points only for complete drivers
  const psSorted = [...results].filter((d) => d.isComplete).sort((a, b) => a.psTime - b.psTime);
  psSorted.forEach((d, i) => { d.psPts = i < 5 ? PS_POINTS_TABLE[i] : 0; });

  results.forEach((d) => { d.totalPts = (d.overallPts || 0) + (d.psPts || 0); });
  return results;
}

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_DRIVERS = ["Risto", "Alar", "Kaupo", "Indrek", "Tanel"];
const DEFAULT_RALLIES: Rally[] = [
  { id: 1, name: "Monte Carlo", date: "10/11.04", stages: 15, results: {}, season: CURRENT_YEAR },
];

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const TAB_HASHES = ["rallid", "juhid", "uldarvestus", "kalender"];

function getInitialTab(): number {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  const idx = TAB_HASHES.indexOf(hash);
  return idx >= 0 ? idx : 0;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<number>(getInitialTab);
  const [drivers, setDrivers] = useState<string[]>(DEFAULT_DRIVERS);
  const [rallies, setRallies] = useState<Rally[]>(DEFAULT_RALLIES);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [currentRallyId, setCurrentRallyId] = useState<number | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(CURRENT_YEAR);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [myName, setMyName] = useState<string>(() => localStorage.getItem("wrcCurrentUser") || "");
  const [notifications, setNotifications] = useState<RallyNotification[]>([]);
  const knownRallyUpdates = useRef<Record<number, number>>({});
  const myOwnUpdates = useRef<Set<string>>(new Set());

  function registerMyUpdate(rallyId: number, ts: number) {
    myOwnUpdates.current.add(`${rallyId}-${ts}`);
    knownRallyUpdates.current[rallyId] = ts;
  }

  function dismissNotification(rallyId: number, ts: number) {
    const key = `${rallyId}-${ts}`;
    setNotifications((prev) => prev.filter((n) => !(n.rallyId === rallyId && n.ts === ts)));
    try {
      let dismissed: string[] = JSON.parse(localStorage.getItem("wrcDismissedUpdates") || "[]");
      if (!dismissed.includes(key)) {
        dismissed.push(key);
        // Cap at 200 entries to prevent unbounded growth
        if (dismissed.length > 200) dismissed = dismissed.slice(-200);
        localStorage.setItem("wrcDismissedUpdates", JSON.stringify(dismissed));
      }
    } catch { /* ignore */ }
  }

  function selectMyName(name: string) {
    setMyName(name);
    localStorage.setItem("wrcCurrentUser", name);
  }

  function switchTab(idx: number) {
    setActiveTab(idx);
    window.location.hash = TAB_HASHES[idx];
  }

  // Sync tab when hash changes (e.g. browser back/forward)
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      const idx = TAB_HASHES.indexOf(hash);
      if (idx >= 0) setActiveTab(idx);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const { data: serverData } = useGetAppData({ query: { refetchInterval: 30000 } });
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    if (!serverData) return;
    if (!dataLoaded) {
      if (serverData.drivers?.length) setDrivers(serverData.drivers as string[]);
      if (serverData.rallies?.length) {
        const incomingRallies = serverData.rallies as Rally[];
        setRallies(incomingRallies);
        // Seed known updates on first load — no notifications on initial data
        incomingRallies.forEach((r) => {
          if (r.lastUpdated) knownRallyUpdates.current[r.id] = r.lastUpdated;
        });
      }
      if (serverData.proposals?.length) setProposals(serverData.proposals as Proposal[]);
      setDataLoaded(true);
      return;
    }
    if (!pendingSaveRef.current) {
      const serverStr = JSON.stringify({ d: serverData.drivers, r: serverData.rallies, p: serverData.proposals });
      const localStr = JSON.stringify({ d: drivers, r: rallies, p: proposals });
      if (serverStr !== localStr) {
        if (serverData.drivers?.length) setDrivers(serverData.drivers as string[]);
        if (serverData.rallies) {
          const incomingRallies = serverData.rallies as Rally[];
          setRallies(incomingRallies);
          // Detect new rally updates from other browsers
          try {
            const dismissed: string[] = JSON.parse(localStorage.getItem("wrcDismissedUpdates") || "[]");
            const newNotifications: RallyNotification[] = [];
            incomingRallies.forEach((r) => {
              if (!r.lastUpdated) return;
              const knownTs = knownRallyUpdates.current[r.id];
              if (r.lastUpdated > (knownTs ?? 0)) {
                const key = `${r.id}-${r.lastUpdated}`;
                const isMyUpdate = myOwnUpdates.current.has(key);
                const isDismissed = dismissed.includes(key);
                if (!isMyUpdate && !isDismissed) {
                  newNotifications.push({ rallyId: r.id, name: r.name, ts: r.lastUpdated });
                }
                knownRallyUpdates.current[r.id] = r.lastUpdated;
              }
            });
            if (newNotifications.length > 0) {
              setNotifications((prev) => {
                const existing = new Set(prev.map((n) => `${n.rallyId}-${n.ts}`));
                return [...prev, ...newNotifications.filter((n) => !existing.has(`${n.rallyId}-${n.ts}`))];
              });
            }
          } catch { /* ignore */ }
        }
        if (serverData.proposals) setProposals(serverData.proposals as Proposal[]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverData]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<{ d: string[]; r: Rally[]; p: Proposal[] } | null>(null);

  const saveToServer = useCallback((d: string[], r: Rally[], p: Proposal[]) => {
    latestDataRef.current = { d, r, p };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = true;
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      updateAppData({ drivers: d, rallies: r as never, proposals: p as never })
        .then(() => {
          setSaveStatus("saved");
          pendingSaveRef.current = false;
          setTimeout(() => setSaveStatus("idle"), 2000);
        })
        .catch(() => {
          setSaveStatus("error");
          pendingSaveRef.current = false;
          // Auto-retry after 3s on network error
          setTimeout(() => {
            if (latestDataRef.current) {
              const { d: ld, r: lr, p: lp } = latestDataRef.current;
              updateAppData({ drivers: ld, rallies: lr as never, proposals: lp as never })
                .then(() => setSaveStatus("saved"))
                .catch(() => {});
            }
          }, 3000);
        });
    }, 400);
  }, []);

  // Flush pending saves synchronously when tab is closed
  useEffect(() => {
    function onUnload() {
      if (!pendingSaveRef.current || !latestDataRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const { d, r, p } = latestDataRef.current;
      const body = JSON.stringify({ drivers: d, rallies: r, proposals: p });
      // keepalive: true ensures the request completes even after page unload
      fetch("/api/appdata", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    saveToServer(drivers, rallies, proposals);
  }, [drivers, rallies, proposals, dataLoaded, saveToServer]);

  const availableSeasons: number[] = Array.from(
    new Set([CURRENT_YEAR, ...rallies.map((r) => r.season ?? CURRENT_YEAR)])
  ).sort((a, b) => a - b);

  function addSeason() {
    const year = prompt("Uue hooaja aasta:", String(CURRENT_YEAR + 1));
    if (!year) return;
    const num = parseInt(year);
    if (!isNaN(num) && num > 2000 && num < 2100) setActiveSeason(num);
  }

  function handleSeasonChange(season: number) {
    setActiveSeason(season);
    setCurrentRallyId(null);
  }

  const seasonRallies = rallies.filter((r) => (r.season ?? CURRENT_YEAR) === activeSeason);
  const championshipRallies = seasonRallies.filter((r) => !r.quickRace);

  const tabs = ["RALLID", "JUHID", "ÜLDARVESTUS", "KALENDER"];

  const saveIndicator = {
    saving: { text: "Salvestab...", color: "text-zinc-400" },
    saved: { text: "✓ Salvestatud", color: "text-green-400" },
    error: { text: "✗ Viga!", color: "text-red-400" },
    idle: { text: "", color: "" },
  }[saveStatus];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* WRC-style top accent bar */}
      <div className="h-1 w-full bg-yellow-400" />

      {/* Main header */}
      <header className="bg-zinc-950 border-b border-zinc-800/80 relative overflow-hidden">
        {/* Decorative WRC car image */}
        <div className="absolute inset-0 pointer-events-none hidden sm:block">
          <img
            src={wrcCarImg}
            alt=""
            className="absolute right-0 top-0 h-full object-cover object-left opacity-20"
            style={{ width: "380px", maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.8) 100%)" }}
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="flex items-stretch justify-between gap-4">

            {/* Logo / Branding */}
            <div className="flex items-center gap-3 py-4">
              <div className="flex items-center gap-1">
                <div className="w-1 h-8 bg-yellow-400 skew-x-[-10deg]" />
                <div className="w-1 h-8 bg-yellow-400/40 skew-x-[-10deg] ml-0.5" />
              </div>
              <div>
                <div className="wrc-heading text-2xl sm:text-3xl text-white leading-none tracking-wider">
                  WRC 10 <span className="text-yellow-400">·</span> MEIE LIIGA
                </div>
                <div className="text-xs text-zinc-500 tracking-widest uppercase mt-0.5">Private Rally League</div>
              </div>
              {saveStatus !== "idle" && (
                <span className={`text-xs font-medium hidden sm:block ${saveIndicator.color}`}>{saveIndicator.text}</span>
              )}
            </div>

            {/* Navigation tabs */}
            <nav className="flex items-stretch gap-0 overflow-x-auto">
              {tabs.map((tab, i) => (
                <button
                  key={i}
                  onClick={() => switchTab(i)}
                  className={`wrc-heading px-4 sm:px-5 py-0 text-sm sm:text-base border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === i
                      ? "text-yellow-400 border-yellow-400"
                      : "text-zinc-400 border-transparent hover:text-white hover:border-zinc-600"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Season selector bar */}
      <div className="bg-zinc-900/60 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-zinc-500 text-xs uppercase tracking-widest font-medium mr-1">Hooaeg</span>
          {availableSeasons.map((s) => (
            <button
              key={s}
              onClick={() => handleSeasonChange(s)}
              className={`px-3 py-1 rounded text-xs font-bold tracking-wider transition-colors ${
                activeSeason === s ? "bg-yellow-400 text-black" : "bg-zinc-800 hover:bg-zinc-700 text-white"
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={addSeason}
            className="px-3 py-1 rounded text-xs bg-zinc-800/50 hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"
          >
            + Lisa
          </button>
          {saveStatus !== "idle" && (
            <span className={`text-xs font-medium sm:hidden ml-auto ${saveIndicator.color}`}>{saveIndicator.text}</span>
          )}
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {!dataLoaded && (
          <div className="text-center text-zinc-400 py-20 text-lg animate-pulse">Laen andmeid...</div>
        )}

        {dataLoaded && activeTab === 0 && (
          <RalliesTab
            rallies={seasonRallies}
            setRallies={setRallies}
            drivers={drivers}
            currentRallyId={currentRallyId}
            setCurrentRallyId={setCurrentRallyId}
            activeSeason={activeSeason}
            proposals={proposals}
            setProposals={setProposals}
            myName={myName}
            setMyName={selectMyName}
            onOpenCalendar={() => switchTab(3)}
            notifications={notifications}
            onDismissNotification={dismissNotification}
            onRegisterMyUpdate={registerMyUpdate}
          />
        )}
        {dataLoaded && activeTab === 1 && (
          <DriversTab drivers={drivers} setDrivers={setDrivers} />
        )}
        {dataLoaded && activeTab === 2 && (
          <ChampionshipTab rallies={championshipRallies} drivers={drivers} activeSeason={activeSeason} />
        )}
        {dataLoaded && activeTab === 3 && (
          <CalendarTab
            proposals={proposals}
            setProposals={setProposals}
            drivers={drivers}
            myName={myName}
            setMyName={selectMyName}
          />
        )}
      </div>
    </div>
  );
}
