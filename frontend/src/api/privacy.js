import { request } from "./client.js";

const exportData = () => request("/privacy/export", { method: "POST" });
const deleteHistory = () => request("/privacy/history/delete", { method: "POST" });
const requestDelete = () => request("/account/delete/request", { method: "POST" });
const cancelDelete = () => request("/account/delete/cancel", { method: "POST" });

export { exportData, deleteHistory, requestDelete, cancelDelete };
