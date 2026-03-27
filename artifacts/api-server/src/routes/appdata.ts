import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_DATA = {
  drivers: ["Risto", "Alar", "Kaupo", "Indrek", "Tanel"],
  rallies: [{ id: 1, name: "Monte Carlo", date: "10/11.04", stages: 15, results: {}, season: 2026 }],
  proposals: [],
};

router.get("/appdata", async (req, res) => {
  try {
    const row = await db.select().from(settingsTable).where(eq(settingsTable.key, "appdata")).limit(1);
    if (row.length === 0) {
      res.json(DEFAULT_DATA);
      return;
    }
    res.json(row[0].value);
  } catch (err) {
    req.log.error({ err }, "Failed to get appdata");
    res.status(500).json({ error: "Failed to load data" });
  }
});

router.put("/appdata", async (req, res) => {
  try {
    const data = req.body;
    await db
      .insert(settingsTable)
      .values({ key: "appdata", value: data })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: data } });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to save appdata");
    res.status(500).json({ error: "Failed to save data" });
  }
});

export default router;
