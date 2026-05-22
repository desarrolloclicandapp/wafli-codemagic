import { request } from "./client.js";

const health = () => request("/health");
const extended = () => request("/health/extended");
const status = () => request("/system/status");
const flags = () => request("/system/flags");
const clientContext = () => request("/system/client-context");

export { health, extended, status, flags, clientContext };
