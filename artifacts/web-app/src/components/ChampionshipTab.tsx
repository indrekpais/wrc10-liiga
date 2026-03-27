import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Rally } from "../App";
import { calculateRallyResults } from "../App";

type Props = {
  rallies: Rally[];
  drivers: string[];
  activeSeason: number;
};

const DRIVER_COLORS = [
  "#f472b6", // pink
  "#facc15", // yellow
  "#34d399", // green
  "#60a5fa", // blue
  "#fb923c", // orange
  "#a78bfa", // violet
  "#f87171", // red
  "#2dd4bf", // teal
  "#e879f9", // fuchsia
  "#94a3b8", // slate
];

export default function ChampionshipTab({ rallies, drivers, activeSeason }: Props) {
  const driverTotals: Record<string, number> = {};
  drivers.forEach((d) => (driverTotals[d] = 0));

  const rallyPoints: Record<number, Record<string, { total: number; ps: number; rank: number }>> = {};
  rallies.forEach((rally) => {
    rallyPoints[rally.id] = {};
    const results = calculateRallyResults(rally, drivers);
    results.forEach((d) => {
      rallyPoints[rally.id][d.driver] = {
        total: d.totalPts,
        ps: d.psPts,
        rank: d.rank,
      };
      if (d.isComplete && driverTotals[d.driver] !== undefined) {
        driverTotals[d.driver] += d.totalPts;
      }
    });
  });

  const sorted = Object.keys(driverTotals)
    .map((driver) => ({ driver, total: driverTotals[driver] }))
    .sort((a, b) => b.total - a.total);

  // --- Chart data: cumulative points per rally ---
  const chartData = rallies.map((rally, idx) => {
    const entry: Record<string, string | number> = {
      name: rally.name.length > 10 ? rally.name.slice(0, 10) + "…" : rally.name,
    };
    drivers.forEach((driver) => {
      let cum = 0;
      for (let i = 0; i <= idx; i++) {
        cum += rallyPoints[rallies[i].id]?.[driver]?.total ?? 0;
      }
      entry[driver] = cum;
    });
    return entry;
  });

  // --- Statistics per driver ---
  type DriverStat = {
    driver: string;
    wins: number;
    podiums: number;
    avgRank: number;
    psPoints: number;
    bestRallyPts: number;
    finishedRallies: number;
  };

  const stats: DriverStat[] = drivers.map((driver) => {
    let wins = 0;
    let podiums = 0;
    let rankSum = 0;
    let psPoints = 0;
    let bestRallyPts = 0;
    let finishedRallies = 0;

    rallies.forEach((rally) => {
      const results = calculateRallyResults(rally, drivers);
      const dr = results.find((r) => r.driver === driver);
      if (dr && dr.isComplete) {
        finishedRallies++;
        if (dr.rank === 1) wins++;
        if (dr.rank <= 3) podiums++;
        rankSum += dr.rank;
        psPoints += dr.psPts;
        if (dr.totalPts > bestRallyPts) bestRallyPts = dr.totalPts;
      }
    });

    return {
      driver,
      wins,
      podiums,
      avgRank: finishedRallies > 0 ? rankSum / finishedRallies : 0,
      psPoints,
      bestRallyPts,
      finishedRallies,
    };
  }).sort((a, b) => {
    const ta = driverTotals[a.driver] ?? 0;
    const tb = driverTotals[b.driver] ?? 0;
    return tb - ta;
  });

  const medals = ["🥇", "🥈", "🥉"];

  const hasAnyData = rallies.some((r) =>
    drivers.some((d) => {
      const res = calculateRallyResults(r, drivers);
      return res.some((dr) => dr.driver === d && dr.isComplete);
    })
  );

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Üldarvestus</h2>
      <p className="text-zinc-500 text-sm mb-6">
        Hooaeg {activeSeason} · {rallies.length} rallit
      </p>

      {sorted.length === 0 || rallies.length === 0 ? (
        <p className="text-zinc-500 mt-4">
          Pole andmeid. Lisa juhid ja sisesta ralli tulemused.
        </p>
      ) : (
        <>
          {/* Standings table */}
          <div className="overflow-x-auto mb-10">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-yellow-400 text-black font-bold p-3 text-left rounded-tl-xl sticky left-0 z-10 w-10">
                    #
                  </th>
                  <th className="bg-yellow-400 text-black font-bold p-3 text-left sticky left-10 z-10 min-w-[120px]">
                    Juht
                  </th>
                  {rallies.map((r) => (
                    <th
                      key={r.id}
                      className="bg-yellow-400 text-black font-bold p-3 text-center min-w-[90px] whitespace-nowrap"
                      title={r.date}
                    >
                      <div className="text-xs font-bold">{r.name}</div>
                      {r.date && (
                        <div className="text-xs font-normal opacity-70">{r.date}</div>
                      )}
                    </th>
                  ))}
                  <th className="bg-yellow-400 text-black font-bold p-3 text-center rounded-tr-xl min-w-[80px]">
                    Kokku
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => {
                  const isLeader = i === 0;
                  const gap = sorted[0].total - entry.total;
                  return (
                    <tr
                      key={entry.driver}
                      className={`border-b border-zinc-800 transition-colors hover:bg-zinc-900 ${
                        isLeader ? "bg-zinc-900/50" : ""
                      }`}
                    >
                      <td className="p-3 font-bold text-lg sticky left-0 bg-zinc-950 z-10">
                        {i < 3 ? medals[i] : `${i + 1}.`}
                      </td>
                      <td className="p-3 font-bold sticky left-10 bg-zinc-950 z-10">
                        {entry.driver}
                        {!isLeader && gap > 0 && (
                          <span className="ml-2 text-xs text-zinc-500 font-normal">
                            −{gap}
                          </span>
                        )}
                      </td>
                      {rallies.map((r) => {
                        const pts = rallyPoints[r.id]?.[entry.driver]?.total;
                        return (
                          <td key={r.id} className="p-3 text-center">
                            {pts !== undefined ? (
                              <span
                                className={`font-bold ${
                                  pts > 0 ? "text-yellow-400" : "text-zinc-600"
                                }`}
                              >
                                {pts}
                              </span>
                            ) : (
                              <span className="text-zinc-700">–</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center">
                        <span
                          className={`text-xl font-bold ${
                            isLeader ? "text-yellow-400" : "text-white"
                          }`}
                        >
                          {entry.total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Championship progression chart */}
          {hasAnyData && rallies.length >= 1 && (
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-1">Punktide areng</h3>
              <p className="text-zinc-500 text-sm mb-4">
                Kumulatiivsed punktid hooaja jooksul
              </p>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      axisLine={{ stroke: "#52525b" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#a1a1aa", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={35}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: "12px",
                        color: "#fff",
                      }}
                      labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
                    />
                    <Legend
                      wrapperStyle={{ color: "#a1a1aa", fontSize: 13, paddingTop: 12 }}
                    />
                    {drivers.map((driver, i) => (
                      <Line
                        key={driver}
                        type="monotone"
                        dataKey={driver}
                        stroke={DRIVER_COLORS[i % DRIVER_COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Statistics grid */}
          {hasAnyData && (
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-1">Statistika</h3>
              <p className="text-zinc-500 text-sm mb-4">Lõpetatud rallide põhjal</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.map((s, i) => (
                  <div
                    key={s.driver}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{i < 3 ? medals[i] : `${i + 1}.`}</span>
                      <span
                        className="font-bold text-base"
                        style={{ color: DRIVER_COLORS[drivers.indexOf(s.driver) % DRIVER_COLORS.length] }}
                      >
                        {s.driver}
                      </span>
                      <span className="ml-auto text-zinc-500 text-xs">
                        {s.finishedRallies}/{rallies.length} rallit
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-zinc-800 rounded-xl px-3 py-2">
                        <p className="text-zinc-500 text-xs">Võite</p>
                        <p className="font-bold text-xl text-yellow-400">{s.wins}</p>
                      </div>
                      <div className="bg-zinc-800 rounded-xl px-3 py-2">
                        <p className="text-zinc-500 text-xs">Poodiumit</p>
                        <p className="font-bold text-xl text-orange-400">{s.podiums}</p>
                      </div>
                      <div className="bg-zinc-800 rounded-xl px-3 py-2">
                        <p className="text-zinc-500 text-xs">Kesk. koht</p>
                        <p className="font-bold text-xl">
                          {s.finishedRallies > 0 ? s.avgRank.toFixed(1) : "–"}
                        </p>
                      </div>
                      <div className="bg-zinc-800 rounded-xl px-3 py-2">
                        <p className="text-zinc-500 text-xs">Power Stage</p>
                        <p className="font-bold text-xl text-green-400">{s.psPoints}p</p>
                      </div>
                    </div>
                    {s.bestRallyPts > 0 && (
                      <p className="text-xs text-zinc-500 mt-2">
                        Parim ralli: <span className="text-zinc-300 font-bold">{s.bestRallyPts} punkti</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Points legend */}
      <div className="mt-4 p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
        <p className="text-zinc-400 text-xs font-bold mb-2 uppercase tracking-wider">
          Punktisüsteem
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-zinc-400">Üldpunktid:</span>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((place, i) => {
            const pts = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][i];
            return (
              <span key={place} className="text-zinc-300">
                <span className="text-zinc-500">{place}.</span> {pts}p
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-1">
          <span className="text-zinc-400">Power Stage:</span>
          {[1, 2, 3, 4, 5].map((place, i) => {
            const pts = [5, 4, 3, 2, 1][i];
            return (
              <span key={place} className="text-zinc-300">
                <span className="text-zinc-500">{place}.</span> {pts}p
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
