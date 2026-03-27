import type { Handler, HandlerEvent } from "@netlify/functions";
import { Client } from "pg";

const DEFAULT_DATA = {
  drivers: ["Risto", "Alar", "Kaupo", "Indrek", "Tanel"],
  rallies: [
    {
      id: 1,
      name: "Monte Carlo",
      date: "10/11.04",
      stages: 15,
      results: {},
      season: new Date().getFullYear(),
    },
  ],
  proposals: [],
};

async function getClient(): Promise<Client> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )
  `);
  return client;
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (!process.env.DATABASE_URL) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "DATABASE_URL not configured" }),
    };
  }

  const client = await getClient().catch((err) => {
    console.error("DB connect error:", err);
    return null;
  });

  if (!client) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: "Database unavailable" }),
    };
  }

  try {
    if (event.httpMethod === "GET") {
      const result = await client.query(
        "SELECT value FROM settings WHERE key = 'appdata'"
      );
      const data = result.rows[0]?.value ?? DEFAULT_DATA;
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === "PUT") {
      const data = JSON.parse(event.body || "{}");
      await client.query(
        `INSERT INTO settings (key, value)
         VALUES ('appdata', $1::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = $1::jsonb`,
        [JSON.stringify(data)]
      );
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (err) {
    console.error("Handler error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
};
