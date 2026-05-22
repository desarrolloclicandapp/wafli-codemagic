import { API_BASE_URL, ApiClientError } from "./client.js";

const ADMIN_TOKEN_KEY = "wafli:adminToken";
const ADMIN_USERNAME_KEY = "wafli:adminUsername";

function getToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminSession(session = {}) {
  if (session.token) sessionStorage.setItem(ADMIN_TOKEN_KEY, session.token);
  if (session.username) sessionStorage.setItem(ADMIN_USERNAME_KEY, session.username);
}

function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USERNAME_KEY);
}

function getAdminUsername() {
  return sessionStorage.getItem(ADMIN_USERNAME_KEY) || "";
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { message: text };
    }
  }
  if (!response.ok || data.success === false) {
    throw new ApiClientError(response.status, data.error, data.message || response.statusText, data.details);
  }
  return data;
}

async function adminRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body !== undefined && options.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const body = options.body !== undefined && options.body !== null ? JSON.stringify(options.body) : undefined;
  try {
    return await parseResponse(await fetch(`${API_BASE_URL}/admin${path}`, {
      ...options,
      headers,
      body,
      credentials: "include",
    }));
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 401) clearAdminSession();
      throw error;
    }
    throw new ApiClientError(0, "network_error", "No pudimos conectar con el servidor.");
  }
}

async function login(username, password) {
  const result = await adminRequest("/auth/login", { method: "POST", body: { username, password } });
  setAdminSession(result);
  return result;
}

const listUsers = ({ q = "", page = 1, limit = 50 } = {}) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return adminRequest(`/users?${params.toString()}`);
};

const extendTrial = (userId, days) => adminRequest(`/users/${userId}/trial`, { method: "POST", body: { days } });
const addGenerations = (userId, amount) => adminRequest(`/users/${userId}/generations`, { method: "POST", body: { amount } });
const suspendUser = (userId, days, reason) => adminRequest(`/users/${userId}/suspend`, { method: "POST", body: { days, reason } });
const deleteUser = (userId, confirmation) => adminRequest(`/users/${userId}`, { method: "DELETE", body: { confirmation } });

export {
  addGenerations,
  clearAdminSession,
  deleteUser,
  extendTrial,
  getAdminUsername,
  getToken,
  listUsers,
  login,
  suspendUser,
};
