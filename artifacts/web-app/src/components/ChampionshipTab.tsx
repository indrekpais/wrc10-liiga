import type { Rally } from "../App";
import { calculateRallyResults } from "../App";

type Props = {
  rallies: Rally[];
  drivers: string[];
  activeSeason: number;
};

export default function ChampionshipTab({ rallies, drivers, activeSeason }: Props) {
  // Calculate total and per-rally points for each driver
  const driverTotals: Record<string, number> = {};
  drivers.forEach((d) => (driverTotals[d] = 0));

  const rallyPoints: Record<string, Record<string, number>> = {};
  rallies.forEach((rally) => {
    rallyPoints[rally.id] = {};
    const results = calculateRallyResults(rally, drivers);
    results.forEach((d) => {
      rallyPoints[rally.id][d.driver] = d.totalPts;
      if (driverTotals[d.driver] !== undefined) {
        driverTotals[d.driver] += d.totalPts;
      }
    });
  });

  const sorted = Object.keys(driverTotals)
    .map((driver) => ({ driver, total: driverTotals[driver] }))
    .sort((a, b) => b.total - a.total);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Üldarvestus</h2>
      <p className="text-zinc-500 text-sm mb-6">Hooaeg {activeSeason} · {rallies.length} rallit</p>

      {sorted.length === 0 || rallies.length === 0 ? (
        <p className="text-zinc-500 mt-4">Pole andmeid. Lisa juhid ja sisesta ralli tulemused.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-yellow-400 text-black font-bold p-3 text-left rounded-tl-xl sticky left-0 z-10 w-10">#</th>
                <th className="bg-yellow-400 text-black font-bold p-3 text-left sticky left-10 z-10 min-w-[120px]">Juht</th>
                {rallies.map((r) => (
                  <th
                    key={r.id}
                    className="bg-yellow-400 text-black font-bold p-3 text-center min-w-[90px] whitespace-nowrap"
                    title={r.date}
                  >
                    <div className="text-xs font-bold">{r.name}</div>
                    {r.date && <div className="text-xs font-normal opacity-70">{r.date}</div>}
                  </th>
                ))}
                <th className="bg-yellow-400 text-black font-bold p-3 text-center rounded-tr-xl min-w-[80px]">Kokku</th>
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
                        <span className="ml-2 text-xs text-zinc-500 font-normal">−{gap}</span>
                      )}
                    </td>
                    {rallies.map((r) => {
                      const pts = rallyPoints[r.id]?.[entry.driver];
                      return (
                        <td key={r.id} className="p-3 text-center">
                          {pts !== undefined ? (
                            <span className={`font-bold ${pts > 0 ? "text-yellow-400" : "text-zinc-600"}`}>
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
      )}

      {/* Points legend */}
      <div className="mt-8 p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
        <p className="text-zinc-400 text-xs font-bold mb-2 uppercase tracking-wider">Punktisüsteem</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-zinc-400">Üldpunktid:</span>
          {[1,2,3,4,5,6,7,8,9,10].map((place, i) => {
            const pts = [25,18,15,12,10,8,6,4,2,1][i];
            return (
              <span key={place} className="text-zinc-300">
                <span className="text-zinc-500">{place}.</span> {pts}p
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mt-1">
          <span className="text-zinc-400">Power Stage:</span>
          {[1,2,3,4,5].map((place, i) => {
            const pts = [5,4,3,2,1][i];
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
