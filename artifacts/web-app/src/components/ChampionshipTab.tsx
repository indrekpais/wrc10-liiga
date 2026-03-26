import type { Rally } from "../App";
import { calculateRallyResults } from "../App";

type Props = {
  rallies: Rally[];
  drivers: string[];
};

export default function ChampionshipTab({ rallies, drivers }: Props) {
  const standings: Record<string, number> = {};
  drivers.forEach((d) => (standings[d] = 0));

  rallies.forEach((rally) => {
    const results = calculateRallyResults(rally, drivers);
    results.forEach((d) => {
      if (standings[d.driver] !== undefined) {
        standings[d.driver] += d.totalPts;
      }
    });
  });

  const sorted = Object.keys(standings)
    .map((driver) => ({ driver, points: standings[driver] }))
    .sort((a, b) => b.points - a.points);

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Üldarvestus (Championship)</h2>
      {sorted.length === 0 ? (
        <p className="text-zinc-500">Pole andmeid. Lisa juhid ja sisesta ralli tulemused.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="bg-yellow-400 text-black font-bold p-3 text-left rounded-tl-xl w-16">Koht</th>
              <th className="bg-yellow-400 text-black font-bold p-3 text-left">Juht</th>
              <th className="bg-yellow-400 text-black font-bold p-3 text-center rounded-tr-xl w-32">Punktid</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, i) => (
              <tr key={entry.driver} className="border-b border-zinc-700">
                <td className="p-4 font-bold text-lg">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </td>
                <td className="p-4 text-lg">{entry.driver}</td>
                <td className="p-4 text-center text-2xl font-bold text-yellow-400">{entry.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
