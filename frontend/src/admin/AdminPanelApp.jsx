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
      setError(apiError?.message || "No hemos podido iniciar sesión admin.");
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
        <button className="admin-primary-btn" disabled={loading}>{loading ? "Accediendo..." : "Entrar"}</button>
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
      setError(apiError?.message || "No hemos podido completar la acción.");
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
            <th>Usuario / correo</th>
            <th>Plan & estado</th>
            <th>Generaciones actuales</th>
            <th>Pack balance</th>
            <th>Vencimiento trial/plan</th>
            <th>Último inicio de sesión / creado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="admin-user-cell">
                  <strong>{user.email || "Sin correo"}</strong>
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

function shortText(value = "", max = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Sin texto";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function ReportDetailModal({ report, onClose }) {
  if (!report) return null;
  const metadata = report.metadata || {};
  const flags = [
    ...(Array.isArray(metadata.qualityFlags) ? metadata.qualityFlags : []),
    ...(Array.isArray(metadata.dialectWarnings) ? metadata.dialectWarnings : []),
    ...(Array.isArray(metadata.spanishNaturalnessFlags) ? metadata.spanishNaturalnessFlags : []),
  ];
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true">
        <button className="admin-modal__close" onClick={onClose} aria-label="Cerrar">x</button>
        <h2>Detalle del reporte IA</h2>
        <div className="admin-user-mini">
          <strong>#{report.id} - {report.reason}</strong>
          <span>{report.action} - {formatDateTime(report.createdAt)}</span>
          <span>{report.userEmail || `Usuario #${report.userId || "?"}`} - {shortText(report.chatId, 64)}</span>
        </div>
        <div className="admin-user-mini">
          <strong>Contexto IA</strong>
          <span>Agente: {metadata.agent || "Sin dato"}</span>
          <span>Objetivo: {metadata.objective || "Sin dato"}</span>
          <span>Variante: {metadata.variant || "Sin dato"}</span>
          <span>Score: {metadata.humanReplyScore ?? "Sin dato"}</span>
          <span>Flags: {flags.length ? flags.join(", ") : "Sin flags"}</span>
        </div>
        <label>
          Respuesta generada
          <textarea value={report.generatedText || ""} readOnly rows={6} />
        </label>
        <label>
          Comentario del usuario
          <textarea value={report.note || "Sin comentario escrito"} readOnly rows={4} />
        </label>
        <div className="admin-modal__actions">
          <button className="admin-primary-btn" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </div>
  );
}

function AiReportsTable({ reports, status, onStatusChange, loading, onRefresh, onMark, onOpen }) {
  return (
    <section className="admin-table-card" style={{marginTop: 24}}>
      <div className="admin-toolbar" style={{margin: 0, borderBottom: "1px solid rgba(148, 163, 184, 0.22)"}}>
        <div>
          <h2 style={{margin: 0}}>Reportes de respuestas IA</h2>
          <p style={{margin: "4px 0 0", color: "var(--admin-muted, #64748b)"}}>Opiniones enviadas desde el botón Reportar respuesta IA.</p>
        </div>
        <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="new">Nuevos</option>
          <option value="reviewing">En revision</option>
          <option value="resolved">Resueltos</option>
          <option value="ignored">Ignorados</option>
          <option value="all">Todos</option>
        </select>
        <button className="admin-primary-btn" onClick={onRefresh} disabled={loading}>{loading ? "Cargando..." : "Actualizar reportes"}</button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Reporte</th>
            <th>Usuario / chat</th>
            <th>Respuesta generada</th>
            <th>Opinion</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>
                <div className="admin-user-cell">
                  <strong>#{report.id} - {report.reason}</strong>
                  <span>{report.action} - {formatDateTime(report.createdAt)}</span>
                  <small>Estado: {report.status}</small>
                </div>
              </td>
              <td>
                <div className="admin-user-cell">
                  <strong>{report.userEmail || `Usuario #${report.userId || "?"}`}</strong>
                  <span>{shortText(report.chatId, 48)}</span>
                </div>
              </td>
              <td>
                <span>{shortText(report.generatedText)}</span>
                <small>{report.metadata?.agent ? `Agente: ${report.metadata.agent}` : ""}</small>
                <small>{report.metadata?.variant ? `Variante: ${report.metadata.variant}` : ""}</small>
              </td>
              <td>
                <span>{shortText(report.note || "Sin opinión escrita", 180)}</span>
              </td>
              <td>
                <div className="admin-actions">
                  <button onClick={() => onOpen(report)}>Detalle</button>
                  <button onClick={() => onMark(report.id, "reviewing")}>Revisar</button>
                  <button onClick={() => onMark(report.id, "resolved")}>Resolver</button>
                  <button onClick={() => onMark(report.id, "ignored")}>Ignorar</button>
                </div>
              </td>
            </tr>
          ))}
          {!reports.length ? (
            <tr>
              <td colSpan={5} className="admin-empty">No hay reportes para mostrar.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="admin-table-card" style={{ padding: 16 }}>
      <small style={{ color: "var(--admin-muted, #64748b)" }}>{label}</small>
      <strong className="admin-metric" style={{ display: "block", marginTop: 4 }}>{value ?? 0}</strong>
      {hint ? <span style={{ color: "var(--admin-muted, #64748b)" }}>{hint}</span> : null}
    </div>
  );
}

function TopList({ title, items = [] }) {
  return (
    <div className="admin-table-card" style={{ padding: 16 }}>
      <h3 style={{ margin: "0 0 10px" }}>{title}</h3>
      {items.length ? items.map((item) => (
        <div key={item.key} className="admin-user-cell" style={{ marginBottom: 8 }}>
          <strong>{item.key}</strong>
          <span>{item.count} casos</span>
        </div>
      )) : <span style={{ color: "var(--admin-muted, #64748b)" }}>Sin datos.</span>}
    </div>
  );
}

function AiQualityPanel({ quality, loading, error, onRefresh }) {
  const summary = quality?.summary || {};
  const dataset = quality?.dataset || {};
  const top = quality?.top || {};
  const recent = quality?.recentReports || [];
  return (
    <section className="admin-table-card" style={{ marginTop: 24 }}>
      <div className="admin-toolbar" style={{ margin: 0, borderBottom: "1px solid rgba(148, 163, 184, 0.22)" }}>
        <div>
          <h2 style={{ margin: 0 }}>Calidad IA</h2>
          <p style={{ margin: "4px 0 0", color: "var(--admin-muted, #64748b)" }}>Lectura agregada de reportes, flags, agentes y variantes.</p>
        </div>
        <button className="admin-primary-btn" onClick={onRefresh} disabled={loading}>{loading ? "Cargando..." : "Actualizar calidad"}</button>
      </div>
      {error ? <div className="admin-alert admin-alert--danger" style={{ margin: 16 }}>{error}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, padding: 16 }}>
        <StatCard label="Reportes muestreados" value={summary.total || 0} hint={`Ultimos ${quality?.filters?.days || 30} dias`} />
        <StatCard label="Casos de dataset" value={dataset.total || 0} hint={`${dataset.fromDb || 0} desde DB`} />
        <StatCard label="Bucket bueno" value={summary.byScoreBucket?.good || 0} hint="Score >= 85" />
        <StatCard label="A vigilar" value={(summary.byScoreBucket?.watch || 0) + (summary.byScoreBucket?.weak || 0) + (summary.byScoreBucket?.bad || 0)} hint="watch, weak o bad" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, padding: "0 16px 16px" }}>
        <TopList title="Motivos frecuentes" items={top.reasons || []} />
        <TopList title="Flags frecuentes" items={top.flags || []} />
        <TopList title="Agentes" items={top.agents || []} />
        <TopList title="Movimientos" items={top.responseMoves || []} />
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Reporte reciente</th>
            <th>Calidad</th>
            <th>Decision IA</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((report) => {
            const metadata = report.metadata || {};
            const flags = Array.isArray(metadata.qualityFlags) ? metadata.qualityFlags : [];
            return (
              <tr key={report.id}>
                <td>
                  <div className="admin-user-cell">
                    <strong>#{report.id} - {report.reason}</strong>
                    <span>{report.action} - {formatDateTime(report.createdAt)}</span>
                    <small>{shortText(report.generatedText, 120)}</small>
                  </div>
                </td>
                <td>
                  <div className="admin-user-cell">
                    <strong>Score: {metadata.humanReplyScore ?? "Sin dato"}</strong>
                    <span>{flags.length ? flags.slice(0, 4).join(", ") : "Sin flags"}</span>
                  </div>
                </td>
                <td>
                  <div className="admin-user-cell">
                    <strong>{metadata.agent || "Agente sin dato"} - {metadata.variant || "variante sin dato"}</strong>
                    <span>{metadata.situation || "situacion sin dato"}</span>
                    <small>{metadata.responseMove || "movimiento sin dato"}</small>
                  </div>
                </td>
              </tr>
            );
          })}
          {!recent.length ? (
            <tr>
              <td colSpan={3} className="admin-empty">No hay datos de calidad IA para mostrar.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

export function AdminPanelApp({ nativeBlocked = false }) {
  const [token, setToken] = React.useState(adminApi.getToken());
  const [users, setUsers] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [reports, setReports] = React.useState([]);
  const [aiQuality, setAiQuality] = React.useState(null);
  const [reportStatus, setReportStatus] = React.useState("new");
  const [reportTotal, setReportTotal] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [reportsLoading, setReportsLoading] = React.useState(false);
  const [aiQualityLoading, setAiQualityLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [reportsError, setReportsError] = React.useState("");
  const [aiQualityError, setAiQualityError] = React.useState("");
  const [action, setAction] = React.useState(null);
  const [selectedReport, setSelectedReport] = React.useState(null);

  const loadUsers = React.useCallback(async () => {
    if (!adminApi.getToken()) return;
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.listUsers({ q: query, limit: 50 });
      setUsers(result.users || []);
      setTotal(result.total || 0);
    } catch (apiError) {
      setError(apiError?.message || "No hemos podido cargar usuarios.");
      if (apiError?.status === 401) setToken("");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadReports = React.useCallback(async () => {
    if (!adminApi.getToken()) return;
    setReportsLoading(true);
    setReportsError("");
    try {
      const result = await adminApi.listAiReports({ status: reportStatus, limit: 50 });
      setReports(result.reports || []);
      setReportTotal(result.total || 0);
    } catch (apiError) {
      setReportsError(apiError?.message || "No hemos podido cargar reportes IA.");
      if (apiError?.status === 401) setToken("");
    } finally {
      setReportsLoading(false);
    }
  }, [reportStatus]);

  const loadAiQuality = React.useCallback(async () => {
    if (!adminApi.getToken()) return;
    setAiQualityLoading(true);
    setAiQualityError("");
    try {
      const result = await adminApi.listAiQuality({ status: "all", days: 30, limit: 12 });
      setAiQuality(result || null);
    } catch (apiError) {
      setAiQualityError(apiError?.message || "No hemos podido cargar calidad IA.");
      if (apiError?.status === 401) setToken("");
    } finally {
      setAiQualityLoading(false);
    }
  }, []);

  const markReport = async (reportId, nextStatus) => {
    try {
      await adminApi.updateAiReportStatus(reportId, nextStatus);
      await loadReports();
    } catch (apiError) {
      setReportsError(apiError?.message || "No hemos podido actualizar el reporte.");
    }
  };

  React.useEffect(() => {
    if (!token) return undefined;
    const id = window.setTimeout(loadUsers, 220);
    return () => window.clearTimeout(id);
  }, [loadUsers, token]);

  React.useEffect(() => {
    if (!token) return undefined;
    const id = window.setTimeout(loadReports, 220);
    return () => window.clearTimeout(id);
  }, [loadReports, token]);

  React.useEffect(() => {
    if (!token) return undefined;
    const id = window.setTimeout(loadAiQuality, 220);
    return () => window.clearTimeout(id);
  }, [loadAiQuality, token]);

  if (nativeBlocked) return <NativeBlocked />;
  if (!token) return <LoginScreen onLogin={() => setToken(adminApi.getToken())} />;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-logo">WA</div>
          <div>
            <h1>Gestión de usuarios</h1>
            <p>{total} usuarios registrados - {reportTotal} reportes IA</p>
          </div>
        </div>
        <div className="admin-header__right">
          <span>Admin: {adminApi.getAdminUsername() || "admin"}</span>
          <button className="admin-secondary-btn" onClick={() => { adminApi.clearAdminSession(); setToken(""); }}>Salir</button>
        </div>
      </header>

      <section className="admin-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por correo, teléfono, estado o ID..." />
        <button className="admin-primary-btn" onClick={() => { loadUsers(); loadReports(); loadAiQuality(); }} disabled={loading || reportsLoading || aiQualityLoading}>{loading || reportsLoading || aiQualityLoading ? "Cargando..." : "Actualizar"}</button>
      </section>

      {error ? <div className="admin-alert admin-alert--danger">{error}</div> : null}
      <UsersTable users={users} onAction={(type, user) => setAction({ type, user })} />
      <AiQualityPanel quality={aiQuality} loading={aiQualityLoading} error={aiQualityError} onRefresh={loadAiQuality} />
      {reportsError ? <div className="admin-alert admin-alert--danger" style={{marginTop: 16}}>{reportsError}</div> : null}
      <AiReportsTable reports={reports} status={reportStatus} onStatusChange={setReportStatus} loading={reportsLoading} onRefresh={loadReports} onMark={markReport} onOpen={setSelectedReport} />
      <ActionModal action={action} onClose={() => setAction(null)} onDone={() => { setAction(null); loadUsers(); }} />
      <ReportDetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
    </main>
  );
}
