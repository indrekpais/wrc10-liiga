import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

type Proposal = {
  id: number;
  proposedBy: string;
  dateText: string;
  dateISO?: string;
  host?: string;
  rallyName?: string;
  responses: Record<string, string>;
};

function extractTime(dateText: string): string {
  const match = dateText.match(/kell\s+(\d{1,2}:\d{2})/);
  return match ? match[1] : "19:00";
}

function toIcsDate(dateISO: string, timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const d = dateISO.replace(/-/g, "");
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${d}T${hh}${mm}00`;
}

function toIcsDtstamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15) + "Z";
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

router.get("/calendar.ics", async (req, res) => {
  let proposals: Proposal[] = [];

  try {
    const row = await db.select().from(settingsTable).where(eq(settingsTable.key, "appdata")).limit(1);
    proposals = (row[0]?.value as { proposals?: Proposal[] })?.proposals ?? [];
  } catch (_) {}

  const dtstamp = toIcsDtstamp();

  const events = proposals
    .filter((p) => p.dateISO)
    .map((p) => {
      const time = extractTime(p.dateText);
      const dtstart = toIcsDate(p.dateISO!, time);
      const [h, m] = time.split(":").map(Number);
      const endH = String((h + 2) % 24).padStart(2, "0");
      const endM = String(m).padStart(2, "0");
      const dtend = `${p.dateISO!.replace(/-/g, "")}T${endH}${endM}00`;
      const summary = p.rallyName ? `WRC 10 · ${escapeIcs(p.rallyName)}` : "WRC 10 Mänguõhtu";
      const descParts: string[] = [];
      if (p.host) descParts.push(`Majavõõrustaja: ${p.host}`);
      const yesVoters = Object.entries(p.responses)
        .filter(([, r]) => r === "yes")
        .map(([n]) => n);
      if (yesVoters.length > 0) descParts.push(`Tulevad: ${yesVoters.join(", ")}`);
      const description = escapeIcs(descParts.join("\\n"));
      return [
        "BEGIN:VEVENT",
        `UID:wrc10-${p.id}@wrc10liiga`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=Europe/Tallinn:${dtstart}`,
        `DTEND;TZID=Europe/Tallinn:${dtend}`,
        `SUMMARY:${summary}`,
        description ? `DESCRIPTION:${description}` : null,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
    });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WRC 10 Meie Liiga//ET",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:WRC 10 · Meie Liiga",
    "X-WR-CALDESC:WRC 10 eraralli liiga mängukorrad",
    "X-WR-TIMEZONE:Europe/Tallinn",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Tallinn",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0200",
    "TZNAME:EET",
    "DTSTART:19701025T040000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0300",
    "TZNAME:EEST",
    "DTSTART:19700329T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="wrc10-liiga.ics"');
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(ics);
});

export default router;
