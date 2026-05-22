const rawArgs = process.argv.slice(2);

function resolveRuntimeMode() {
  const argMode = rawArgs.includes("--worker") ? "worker" : rawArgs.includes("--api") ? "api" : rawArgs.includes("--combined") ? "combined" : null;
  const envMode = String(process.env.WA_RUNTIME_MODE || "").trim().toLowerCase();
  const mode = argMode || envMode || "combined";
  return ["combined", "api", "worker"].includes(mode) ? mode : "combined";
}

const RUNTIME_MODE = resolveRuntimeMode();
const shouldAcceptHttpTraffic = () => RUNTIME_MODE !== "worker";
const shouldRunSessionRuntime = () => RUNTIME_MODE !== "api";
const isApiOnly = () => RUNTIME_MODE === "api";
const isWorkerOnly = () => RUNTIME_MODE === "worker";

module.exports = { RUNTIME_MODE, shouldAcceptHttpTraffic, shouldRunSessionRuntime, isApiOnly, isWorkerOnly };
