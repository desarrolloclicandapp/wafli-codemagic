const { Pool } = require("pg");
const { config } = require("./env");

if (!config.databaseUrl) {
  console.warn("[DB] DATABASE_URL is not configured. DB-backed endpoints will fail until configured.");
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.pgSslMode === "require" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (err) => {
  console.error("[PostgreSQL Pool] Unexpected idle client error:", err.message);
});

async function withRetry(operation, maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const msg = String(error?.message || "");
      const retryable = msg.includes("Connection terminated") || msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || error?.code === "ECONNRESET";
      if (retryable && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw error;
    }
  }
}

module.exports = { pool, withRetry };
