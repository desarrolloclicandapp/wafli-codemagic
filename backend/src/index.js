require("dotenv").config();
const http = require("http");
const dns = require("dns");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { config } = require("./config/env");
const { initDb } = require("./db/init");
const { requestId } = require("./middleware/requestId");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { shouldAcceptHttpTraffic, shouldRunSessionRuntime, RUNTIME_MODE } = require("./services/runtimeModeService");
const { startJobs, stopJobs } = require("./jobs");
const billingController = require("./controllers/billingController");
const systemController = require("./controllers/systemController");
const { asyncHandler } = require("./utils/asyncHandler");

const authRoutes = require("./routes/authRoutes");
const meRoutes = require("./routes/meRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const chatRoutes = require("./routes/chatRoutes");
const aiRoutes = require("./routes/aiRoutes");
const aiReportRoutes = require("./routes/aiReportRoutes");
const billingRoutes = require("./routes/billingRoutes");
const pushRoutes = require("./routes/pushRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const privacyRoutes = require("./routes/privacyRoutes");
const systemRoutes = require("./routes/systemRoutes");
const adminRoutes = require("./routes/adminRoutes");

let processSafetyHandlersInstalled = false;

function isTransientRuntimeStreamError(error) {
  const code = String(error?.code || error?.cause?.code || "").toUpperCase();
  const causeCode = String(error?.cause?.code || error?.cause?.name || "").toUpperCase();
  const message = String(`${error?.message || ""} ${error?.cause?.message || ""}`).toLowerCase();
  const retryableCodes = new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "UND_ERR_SOCKET",
    "UND_ERR_ABORTED",
    "ERR_STREAM_PREMATURE_CLOSE"
  ]);

  return (
    retryableCodes.has(code) ||
    retryableCodes.has(causeCode) ||
    message.includes("terminated") ||
    message.includes("other side closed") ||
    message.includes("aborted") ||
    message.includes("premature close")
  );
}

function logRuntimeProcessError(level, label, error) {
  const payload = {
    message: error?.message || String(error || ""),
    code: error?.code || null,
    causeCode: error?.cause?.code || error?.cause?.name || null,
    causeMessage: error?.cause?.message || null
  };
  const line = `[runtime] ${label}: ${JSON.stringify(payload)}`;
  if (level === "warn") console.warn(line);
  else console.error(line);
}

function bindProcessSafetyHandlers() {
  if (processSafetyHandlersInstalled) return;
  processSafetyHandlersInstalled = true;

  process.on("uncaughtException", (error) => {
    if (isTransientRuntimeStreamError(error)) {
      logRuntimeProcessError("warn", "Ignored transient stream error", error);
      return;
    }

    logRuntimeProcessError("error", "Fatal uncaught exception", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    if (isTransientRuntimeStreamError(reason)) {
      logRuntimeProcessError("warn", "Ignored transient async stream error", reason);
      return;
    }

    logRuntimeProcessError("error", "Fatal unhandled rejection", reason);
    process.exit(1);
  });
}

bindProcessSafetyHandlers();

function applyDnsResultOrder() {
  const value = String(config.whatsapp.dnsResultOrder || "").trim().toLowerCase();
  if (!value) return;
  if (!["ipv4first", "verbatim", "ipv6first"].includes(value)) {
    console.warn(`[runtime] Ignoring unsupported WA_DNS_RESULT_ORDER=${value}`);
    return;
  }
  try {
    dns.setDefaultResultOrder(value);
    console.log(`[runtime] DNS result order set to ${value}`);
  } catch (error) {
    console.warn(`[runtime] Could not set DNS result order: ${error.message}`);
  }
}

function parseOrigin(value) {
  try {
    return new URL(value);
  } catch (_) {
    return null;
  }
}

function isEasyPanelSiblingOrigin(origin) {
  const parsedOrigin = parseOrigin(origin);
  if (!parsedOrigin || !parsedOrigin.hostname.endsWith(".easypanel.host")) return false;

  const configuredOrigins = [...config.corsOrigins, config.appPublicUrl, config.apiPublicUrl];
  return configuredOrigins.some((configuredOrigin) => {
    const parsedConfiguredOrigin = parseOrigin(configuredOrigin);
    return parsedConfiguredOrigin?.protocol === parsedOrigin.protocol && parsedConfiguredOrigin.hostname.endsWith(".easypanel.host");
  });
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const safeOrigin = String(origin).replace(/\/$/, "");
  const parsedOrigin = parseOrigin(safeOrigin);
  const isLocalOrigin = ["localhost", "127.0.0.1"].includes(parsedOrigin?.hostname);
  const isEasyPanelOrigin = parsedOrigin?.hostname.endsWith(".easypanel.host");
  if (config.env === "production") {
    const allowSiblingEasyPanel = ["true", "1", "yes", "on"].includes(String(process.env.ALLOW_EASYPANEL_SIBLING_ORIGINS || "").toLowerCase());
    return (
      config.corsOrigins.includes("*") ||
      config.corsOrigins.includes(safeOrigin) ||
      (allowSiblingEasyPanel && isEasyPanelSiblingOrigin(safeOrigin))
    );
  }
  return (
    config.corsOrigins.includes("*") ||
    config.corsOrigins.includes(safeOrigin) ||
    isEasyPanelSiblingOrigin(safeOrigin) ||
    isEasyPanelOrigin ||
    isLocalOrigin
  );
}

function applyCorsHeaders(req, res, next) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    const requestedHeaders = req.headers["access-control-request-headers"];
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", requestedHeaders || "Content-Type, Authorization, X-Request-Id");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
}

function corsOptions() {
  return {
    origin(origin, cb) {
      return cb(null, isAllowedOrigin(origin));
    },
    credentials: true
  };
}

function bindShutdown(handler) {
  let shuttingDown = false;
  const wrapped = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await handler();
  };
  process.on("SIGINT", wrapped);
  process.on("SIGTERM", wrapped);
}

async function main() {
  applyDnsResultOrder();
  await initDb();

  if (!shouldAcceptHttpTraffic()) {
    if (shouldRunSessionRuntime()) startJobs();
    let workerHealthServer = null;
    if (config.whatsapp.workerHealthEnabled) {
      const healthApp = express();
      healthApp.set("trust proxy", config.trustProxy);
      healthApp.use(requestId);
      healthApp.use(applyCorsHeaders);
      healthApp.use(cors(corsOptions()));
      healthApp.get("/health", asyncHandler(systemController.health));
      healthApp.get("/health/extended", asyncHandler(systemController.extended));
      healthApp.use(notFound);
      healthApp.use(errorHandler);
      workerHealthServer = healthApp.listen(config.port, () => {
        console.log(`[runtime] ${RUNTIME_MODE} mode started with health HTTP on :${config.port}`);
      });
    } else {
      console.log(`[runtime] ${RUNTIME_MODE} mode started without HTTP traffic`);
    }
    bindShutdown(async () => {
      stopJobs();
      if (workerHealthServer) workerHealthServer.close(() => process.exit(0));
      else process.exit(0);
    });
    return;
  }

  const app = express();
  app.set("trust proxy", config.trustProxy);
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin(origin, cb) {
        cb(null, isAllowedOrigin(origin));
      },
      credentials: true
    }
  });
  app.set("io", io);

  app.use(requestId);
  app.use(applyCorsHeaders);
  app.use(cors(corsOptions()));

  app.post("/webhooks/stripe", express.raw({ type: "application/json" }), asyncHandler(billingController.webhook));
  app.use(express.json({ limit: "8mb" }));
  app.post("/webhooks/revenuecat", asyncHandler(billingController.revenueCatWebhook));

  app.get("/favicon.ico", (_req, res) => res.status(204).end());
  app.use(systemRoutes);
  app.use("/admin", adminRoutes);
  app.use("/auth", authRoutes);
  app.use("/me", meRoutes);
  app.use("/whatsapp", whatsappRoutes);
  app.use("/chats", chatRoutes);
  app.use("/ai/reports", aiReportRoutes);
  app.use("/ai", aiRoutes);
  app.use("/billing", billingRoutes);
  app.use("/push", pushRoutes);
  app.use("/notifications", notificationRoutes);
  app.use(privacyRoutes);

  app.use(notFound);
  app.use(errorHandler);

  io.on("connection", (socket) => {
    socket.emit("hello", { app: "wafli-backend" });
  });

  if (shouldRunSessionRuntime()) startJobs();
  server.listen(config.port, () => console.log(`[api] WaFli backend listening on :${config.port} (${RUNTIME_MODE})`));

  bindShutdown(async () => {
    stopJobs();
    server.close(() => process.exit(0));
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal bootstrap error", error);
    process.exit(1);
  });
}

module.exports = { main };



