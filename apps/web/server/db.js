// apps/web/server/db.js
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL && !process.env.POSTGRES_PASSWORD) {
  console.error("FATAL: POSTGRES_PASSWORD (or DATABASE_URL) is required. Exiting.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || "pp"}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "pricepulse"}`,
});

/** 啟動時驗證連線 + 自動建表 */
export async function initDb() {
  // 驗證連線
  await pool.query("SELECT 1");
  console.log("DB connected.");

  // 執行 schema.sql
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("DB schema applied.");
}

export default pool;
