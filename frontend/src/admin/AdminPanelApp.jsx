import React from "react";
import * as adminApi from "../api/admin.js";

function formatDate(value) {
  if (!value) return "Sin fecha";
  try {
    return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (_) {
    return "Sin fecha";
  }
}

function formatDateTime(value) {
  if (!value) return "Sin registro";
  try {
    return new Date(value).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (_) {
    return "Sin registro";
  }
}

function statusClass(status = "") {
  const key = String(status || "").toLowerCase();
  if (key === "suspended") return "admin-pill admin-pill--danger";
  if (key === "past_due") return "admin-pill admin-pill--warning";
  return "admin-pill admin-pill--ok";
}

function planClass(plan = "") {
  const key = String(plan || "").toLowerCase();
  if (key === "plus") return "admin-pill admin-pill--plus";
  if (key === "plus_trial") return "admin-pill admin-pill--trial";
  return "admin-pill";
}

function NativeBlocked() {
  return (
    <main className="admin-shell admin-shell--center">
      <section className="admin-login-card">
        <div className="admin-logo">WA</div>
        <h1>Adminpanel solo web</h1>
        <p>Este panel no está disponible dentro de la app móvil.</p>
      </section>
    </main>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await adminApi.login(username, password);
      onLogin();
    } catch (apiError) {
      setError(apiError?.message || "No pudimos iniciar sesión admin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-shell admin-shell--center">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-logo">WA</div>
        <h1>Adminpanel WaFli</h1>
        <p>Acceso privado para gestión de usuarios.</p>
        <label>
          Usuario
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Contraseña
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error ? <div className="admin-alert admin-alert--danger">{error}</div> : null}
        <button className="admin-primary-btn" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button>
      </form>
    </main>
  );
}

function ActionModal({ action, onClose, onDone }) {
  const [value, setValue] = React.useState(action?.type === "delete" ? "" : action?.type === "generations" ? "50" : "7");
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  if (!action) return null;

  const user = action.user;
  const labels = {
    trial: {
      title: "Extender trial",
      description: "Agrega días al trial o convierte un usuario Free en trial.",
      input: "Días",
      button: "Extender trial",
    },
    generations: {
      title: "Agregar generaciones",
      description: "Suma generaciones al balance extra del usuario.",
      input: "Cantidad",
      button: "Agregar generaciones",
    },
    suspend: {
      title: "Suspender temporalmente",
      description: "Bloquea el acceso del usuario durante una cantidad de días.",
      input: "Días",
      button: "Suspender usuario",
    },
    delete: {
      title: "Eliminar por completo",
      description: `Acción irreversible. Escribe ${user.email || user.id} para confirmar.`,
      input: "Confirmación",
      button: "Eliminar definitivamente",
    },
  }[action.type];

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      if (action.type === "trial") await adminApi.extendTrial(user.id, Number(value));
      if (action.type === "generations") await adminApi.addGenerations(user.id, Number(value));
      if (action.type === "suspend") await adminApi.suspendUser(user.id, Number(value), reason);
      if (action.type === "delete") await adminApi.deleteUser(user.id, value);
      onDone();
    } catch (apiError) {
      setError(apiError?.message || "No pudimos completar la acción.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true">
        <button className="admin-modal__close" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>{labels.title}</h2>
        <p>{labels.description}</p>
        <div className="admin-user-mini">
          <strong>{user.email || `Usuario #${user.id}`}</strong>
          <span>ID {user.id} · {user.plan?.name || user.defaultPlan}</span>
        </div>
        <label>
          {labels.input}
          <input value={value} onChange={(event) => setValue(event.target.value)} type={action.type === "delete" ? "text" : "number"} min="1" />
        </label>
        {action.type === "suspend" ? (
          <label>
            Motivo opcional
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </label>
        ) : null}
        {error ? <div className="admin-alert admin-alert--danger">{error}</div> : null}
        <div className="admin-modal__actions">
          <button className="admin-secondary-btn" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={action.type === "delete" || action.type === "suspend" ? "admin-danger-btn" : "admin-primary-btn"} onClick={submit} disabled={loading}>
            {loading ? "Procesando..." : labels.button}
          </button>
        </div>
      </section>
    </div>
  );
}

function UsersTable({ users, onAction }) {
  return (
    <div className="admin-table-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Usuario / email</th>
            <th>Plan & estado</th>
            <th>Generaciones actuales</th>
            <th>Pack balance</th>
            <th>Vencimiento trial/plan</th>
            <th>Último login / creado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="admin-user-cell">
                  <strong>{user.email || "Sin email"}</strong>
                  <span>ID {user.id}{user.phone ? ` · ${user.phone}` : ""}</span>
                  <small>WhatsApp: {user.whatsapp?.status || "sin estado"}</small>
                </div>
              </td>
              <td>
                <div className="admin-pill-stack">
                  <span className={planClass(user.plan?.name)}>{user.plan?.name || user.defaultPlan || "free"}</span>
                  <span className={statusClass(user.status)}>{user.status}</span>
                  {user.suspendedUntil ? <small>Hasta {formatDate(user.suspendedUntil)}</small> : null}
                </div>
              </td>
              <td>
                <strong className="admin-metric">{user.plan?.currentGenerations ?? 0}</strong>
                <small>{user.plan?.usedInPeriod ?? 0}/{user.plan?.includedLimit ?? 0} usadas</small>
              </td>
              <td>
                <strong className="admin-metric">{user.plan?.packBalance ?? 0}</strong>
                <small>extras</small>
              </td>
              <td>
                <span>{formatDate(user.plan?.expiresAt)}</span>
                <small>{user.plan?.periodType || "day"}</small>
              </td>
              <td>
                <span>{formatDateTime(user.lastLoginAt)}</span>
                <small>Creado {formatDate(user.createdAt)}</small>
              </td>
              <td>
                <div className="admin-actions">
                  <button onClick={() => onAction("trial", user)}>Trial</button>
                  <button onClick={() => onAction("generations", user)}>+ Gen</button>
                  <button onClick={() => onAction("suspend", user)}>Suspender</button>
                  <button className="admin-action-danger" onClick={() => onAction("delete", user)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {!users.length ? (
            <tr>
              <td colSpan={7} className="admin-empty">No hay usuarios para mostrar.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPanelApp({ nativeBlocked = false }) {
  const [token, setToken] = React.useState(adminApi.getToken());
  const [users, setUsers] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [action, setAction] = React.useState(null);

  const loadUsers = React.useCallback(async () => {
    if (!adminApi.getToken()) return;
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listUsers({ q: query, limit: 50 });
      setUsers(result.users || []);
      setTotal(result.total || 0);
    } catch (apiError) {
      setError(apiError?.message || "No pudimos cargar usuarios.");
      if (apiError?.status === 401) setToken("");
    } finally {
      setLoading(false);
    }
  }, [query]);

  React.useEffect(() => {
    if (!token) return undefined;
    const id = window.setTimeout(loadUsers, 220);
    return () => window.clearTimeout(id);
  }, [loadUsers, token]);

  if (nativeBlocked) return <NativeBlocked />;
  if (!token) return <LoginScreen onLogin={() => setToken(adminApi.getToken())} />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-logo">WA</div>
          <div>
            <h1>Gestión de usuarios</h1>
            <p>{total} usuarios registrados</p>
          </div>
        </div>
        <div className="admin-header__right">
          <span>Admin: {adminApi.getAdminUsername() || "admin"}</span>
          <button className="admin-secondary-btn" onClick={() => { adminApi.clearAdminSession(); setToken(""); }}>Salir</button>
        </div>
      </header>

      <section className="admin-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por email, teléfono, estado o ID..." />
        <button className="admin-primary-btn" onClick={loadUsers} disabled={loading}>{loading ? "Cargando..." : "Actualizar"}</button>
      </section>

      {error ? <div className="admin-alert admin-alert--danger">{error}</div> : null}
      <UsersTable users={users} onAction={(type, user) => setAction({ type, user })} />
      <ActionModal action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); loadUsers(); }} />
    </main>
  );
}
