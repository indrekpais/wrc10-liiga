import { useState } from "react";

type Props = {
  drivers: string[];
  setDrivers: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function DriversTab({ drivers, setDrivers }: Props) {
  const [newDriver, setNewDriver] = useState("");

  function addDriver() {
    const name = newDriver.trim();
    if (name && !drivers.includes(name)) {
      setDrivers((prev) => [...prev, name]);
      setNewDriver("");
    }
  }

  function removeDriver(name: string) {
    if (confirm(`Kustutada ${name}?`)) {
      setDrivers((prev) => prev.filter((d) => d !== name));
    }
  }

  return (
    <div>
      <h2 className="wrc-heading text-3xl sm:text-4xl text-white mb-6 pl-3 border-l-4 border-yellow-400">Juhtide Haldus</h2>
      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 bg-zinc-800 text-white px-4 py-3 rounded-2xl border border-zinc-700 focus:outline-none focus:border-yellow-400"
          placeholder="Uue juhi nimi"
          value={newDriver}
          onChange={(e) => setNewDriver(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDriver()}
        />
        <button
          onClick={addDriver}
          className="bg-white text-black px-8 rounded-2xl font-bold hover:bg-zinc-100 transition-colors"
        >
          Lisa
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {drivers.map((driver) => (
          <div
            key={driver}
            className="bg-zinc-800 p-4 rounded-3xl flex justify-between items-center"
          >
            <span className="font-bold">{driver}</span>
            <button
              onClick={() => removeDriver(driver)}
              className="text-zinc-500 hover:text-red-500 text-xl transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {drivers.length === 0 && (
        <p className="text-zinc-500 mt-4">Pole ühtegi juhti. Lisa esimene juht ülaltoodud väljaga.</p>
      )}
    </div>
  );
}
