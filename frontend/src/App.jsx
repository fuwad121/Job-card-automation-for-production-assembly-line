import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:4000/api";
const UPLOAD_BASE = "http://localhost:4000";

function api(path, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE}${path}`, { ...options, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  });
}

function statusClass(status) {
  return `status status-${status.replace("_", "-")}`;
}

function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ username: "admin", password: "admin123" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(form)
      });
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell login-shell">
      <div className="hero-card">
        <p className="eyebrow">Drone Assembly Job Cards</p>
        <h1>Trace work. Lock stages. Keep admin in control.</h1>
        <p className="muted">
          MVP for job assignment, stage checklist updates, timestamped logs, and role-based access.
        </p>
        <form className="panel form-grid" onSubmit={submit}>
          <label>
            Username
            <input
              value={form.username}
              onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button className="primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function UserCard({ user, onToggle }) {
  const nextStatus = user.status === "active" ? "inactive" : "active";
  return (
    <div className="list-row">
      <div>
        <strong>{user.name}</strong>
        <div className="muted small">
          @{user.username} • {user.role}
        </div>
      </div>
      <div className="row-end">
        <span className={statusClass(user.status)}>{user.status}</span>
        <button className="secondary" onClick={() => onToggle(user.id, nextStatus)}>
          {nextStatus}
        </button>
      </div>
    </div>
  );
}

function JobCard({ job, selected, onSelect }) {
  return (
    <button className={`job-card ${selected ? "selected" : ""}`} onClick={() => onSelect(job.id)}>
      <div className="job-card-top">
        <strong>{job.job_id}</strong>
        <span className={statusClass(job.status)}>{job.status.replace("_", " ")}</span>
      </div>
      <div className="muted">{job.project_id}</div>
      <div className="muted small">
        {job.model} • {job.serial}
      </div>
      <div className="job-progress">
        <div className="bar">
          <div
            className="bar-fill"
            style={{ width: `${(job.completed_stages / Math.max(job.total_stages, 1)) * 100}%` }}
          />
        </div>
        <span>
          {job.completed_stages}/{job.total_stages} stages
        </span>
      </div>
      <div className="muted small">Operator: {job.operator_name}</div>
    </button>
  );
}

function StagePanel({ stage, canEdit, onSubmit }) {
  const [taskState, setTaskState] = useState([]);
  const [images, setImages] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTaskState(stage.tasks.map((task) => ({ taskId: task.id, completed: false, remarks: "" })));
    setImages({});
    setError("");
  }, [stage.id]);

  const completedCount = useMemo(
    () => taskState.filter((task) => task.completed).length,
    [taskState]
  );

  function updateTask(taskId, patch) {
    setTaskState((current) =>
      current.map((task) => (task.taskId === taskId ? { ...task, ...patch } : task))
    );
  }

  async function submitStage() {
    setError("");
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("taskUpdates", JSON.stringify(taskState));
      stage.tasks.forEach((task) => {
        const file = images[task.id];
        if (file) payload.append(`image_${task.id}`, file);
      });
      await onSubmit(stage.id, payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel stage-panel">
      <div className="stage-head">
        <div>
          <div className="eyebrow">Stage {stage.stage_order}</div>
          <h3>{stage.stage_name}</h3>
        </div>
        <span className={statusClass(stage.status)}>{stage.status}</span>
      </div>

      {stage.status === "completed" ? (
        <div className="info-box">
          Completed {stage.completed_at ? new Date(stage.completed_at).toLocaleString() : ""} by{" "}
          {stage.completed_by_name || "operator"}.
        </div>
      ) : null}

      <div className="task-list">
        {stage.tasks.map((task) => {
          const value = taskState.find((item) => item.taskId === task.id) || {
            completed: false,
            remarks: ""
          };
          return (
            <div className="task-card" key={task.id}>
              <label className="task-check">
                <input
                  type="checkbox"
                  checked={value.completed}
                  disabled={!canEdit}
                  onChange={(e) => updateTask(task.id, { completed: e.target.checked })}
                />
                <span>
                  {task.description}
                  {task.required ? <em>Required</em> : <em>Optional</em>}
                </span>
              </label>
              <textarea
                rows="2"
                placeholder="Remarks"
                value={value.remarks}
                disabled={!canEdit}
                onChange={(e) => updateTask(task.id, { remarks: e.target.value })}
              />
              {canEdit ? (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImages((s) => ({ ...s, [task.id]: e.target.files?.[0] }))}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {stage.logs.length ? (
        <div className="log-block">
          <h4>Stage logs</h4>
          {stage.logs.map((log) => (
            <div className="log-row" key={log.id}>
              <div className="muted small">
                {log.operator_name} • {new Date(log.created_at).toLocaleString()}
              </div>
              <div><strong>{log.task_description}</strong></div>
              <div>{log.completed ? "Task checked complete" : "Task left unchecked"}</div>
              {log.remarks ? <div className="muted">{log.remarks}</div> : null}
              {log.image_url ? (
                <a href={`${UPLOAD_BASE}${log.image_url}`} target="_blank" rel="noreferrer">
                  View image
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canEdit ? (
        <div className="stage-actions">
          <div className="muted small">{completedCount} tasks checked.</div>
          {error ? <div className="error">{error}</div> : null}
          <button className="primary" disabled={saving} onClick={submitStage}>
            {saving ? "Submitting..." : "Complete stage"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function JobDetail({ job, currentUser, onStageSubmit }) {
  const editableStageId = useMemo(() => {
    if (currentUser.role !== "operator") return null;
    return job.stages.find((stage) => stage.status !== "completed")?.id || null;
  }, [job, currentUser.role]);

  return (
    <div className="detail-stack">
      <div className="panel">
        <div className="detail-head">
          <div>
            <p className="eyebrow">{job.project_id}</p>
            <h2>{job.job_id}</h2>
          </div>
          <span className={statusClass(job.status)}>{job.status}</span>
        </div>
        <div className="detail-grid">
          <div>
            <span className="muted small">Model</span>
            <strong>{job.model}</strong>
          </div>
          <div>
            <span className="muted small">UAV Serial</span>
            <strong>{job.serial}</strong>
          </div>
          <div>
            <span className="muted small">Assigned operator</span>
            <strong>{job.operator_name}</strong>
          </div>
          <div>
            <span className="muted small">Created</span>
            <strong>{new Date(job.created_at).toLocaleString()}</strong>
          </div>
        </div>
      </div>
      {job.stages.map((stage) => (
        <StagePanel
          key={stage.id}
          stage={stage}
          canEdit={currentUser.role === "operator" && editableStageId === stage.id}
          onSubmit={onStageSubmit}
        />
      ))}
    </div>
  );
}

function AdminView({ session, onLogout }) {
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [operators, setOperators] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [error, setError] = useState("");
  const [userForm, setUserForm] = useState({ name: "", username: "", password: "", role: "operator" });
  const [jobForm, setJobForm] = useState({
    jobId: "",
    projectId: "",
    model: "",
    serial: "",
    assignedOperator: ""
  });

  async function loadAll() {
    const [userData, jobData, operatorData] = await Promise.all([
      api("/users", {}, session.token),
      api("/jobs", {}, session.token),
      api("/operators", {}, session.token)
    ]);
    setUsers(userData);
    setJobs(jobData);
    setOperators(operatorData);
    if (!selectedJobId && jobData[0]) setSelectedJobId(jobData[0].id);
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    api(`/jobs/${selectedJobId}`, {}, session.token)
      .then(setSelectedJob)
      .catch((err) => setError(err.message));
  }, [selectedJobId]);

  async function createUser(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/users", { method: "POST", body: JSON.stringify(userForm) }, session.token);
      setUserForm({ name: "", username: "", password: "", role: "operator" });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleUser(id, status) {
    setError("");
    try {
      await api(`/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, session.token);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createJob(e) {
    e.preventDefault();
    setError("");
    try {
      const created = await api("/jobs", { method: "POST", body: JSON.stringify(jobForm) }, session.token);
      setJobForm({ jobId: "", projectId: "", model: "", serial: "", assignedOperator: "" });
      await loadAll();
      setSelectedJobId(created.id);
    } catch (err) {
      setError(err.message);
    }
  }

  const counts = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter((job) => job.status === "completed").length;
    const pending = jobs.filter((job) => job.status === "pending").length;
    const inProgress = jobs.filter((job) => job.status === "in_progress").length;
    return { total, completed, pending, inProgress };
  }, [jobs]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Admin dashboard</p>
          <h2>{session.user.name}</h2>
          <p className="muted">Users, jobs, monitoring.</p>
        </div>
        <button className="secondary" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="content">
        <section className="metrics">
          <div className="metric"><strong>{counts.total}</strong><span>Total jobs</span></div>
          <div className="metric"><strong>{counts.inProgress}</strong><span>In progress</span></div>
          <div className="metric"><strong>{counts.pending}</strong><span>Pending</span></div>
          <div className="metric"><strong>{counts.completed}</strong><span>Completed</span></div>
        </section>

        {error ? <div className="error">{error}</div> : null}

        <section className="two-col">
          <form className="panel form-grid" onSubmit={createUser}>
            <h3>Create user</h3>
            <label>Name<input value={userForm.name} onChange={(e) => setUserForm((s) => ({ ...s, name: e.target.value }))} /></label>
            <label>Username<input value={userForm.username} onChange={(e) => setUserForm((s) => ({ ...s, username: e.target.value }))} /></label>
            <label>Password<input type="password" value={userForm.password} onChange={(e) => setUserForm((s) => ({ ...s, password: e.target.value }))} /></label>
            <label>Role
              <select value={userForm.role} onChange={(e) => setUserForm((s) => ({ ...s, role: e.target.value }))}>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button className="primary">Create user</button>
          </form>

          <form className="panel form-grid" onSubmit={createJob}>
            <h3>Create job</h3>
            <label>Job ID<input value={jobForm.jobId} onChange={(e) => setJobForm((s) => ({ ...s, jobId: e.target.value }))} /></label>
            <label>Project ID<input value={jobForm.projectId} onChange={(e) => setJobForm((s) => ({ ...s, projectId: e.target.value }))} /></label>
            <label>Model<input value={jobForm.model} onChange={(e) => setJobForm((s) => ({ ...s, model: e.target.value }))} /></label>
            <label>UAV Serial<input value={jobForm.serial} onChange={(e) => setJobForm((s) => ({ ...s, serial: e.target.value }))} /></label>
            <label>Assign Operator
              <select
                value={jobForm.assignedOperator}
                onChange={(e) => setJobForm((s) => ({ ...s, assignedOperator: Number(e.target.value) }))}
              >
                <option value="">Select operator</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary">Create job</button>
          </form>
        </section>

        <section className="three-col">
          <div className="panel">
            <h3>Users</h3>
            <div className="stack">
              {users.map((user) => (
                <UserCard key={user.id} user={user} onToggle={toggleUser} />
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Jobs</h3>
            <div className="stack">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedJobId === job.id}
                  onSelect={setSelectedJobId}
                />
              ))}
            </div>
          </div>

          <div>{selectedJob ? <JobDetail job={selectedJob} currentUser={session.user} onStageSubmit={() => {}} /> : <div className="panel">Select job</div>}</div>
        </section>
      </main>
    </div>
  );
}

function OperatorView({ session, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [error, setError] = useState("");

  async function loadJobs() {
    const jobData = await api("/jobs", {}, session.token);
    setJobs(jobData);
    if (!selectedJobId && jobData[0]) setSelectedJobId(jobData[0].id);
  }

  useEffect(() => {
    loadJobs().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    api(`/jobs/${selectedJobId}`, {}, session.token)
      .then(setSelectedJob)
      .catch((err) => setError(err.message));
  }, [selectedJobId]);

  async function submitStage(stageId, formData) {
    const updated = await api(`/stages/${stageId}/submit`, { method: "POST", body: formData }, session.token);
    setSelectedJob(updated);
    await loadJobs();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Operator dashboard</p>
          <h2>{session.user.name}</h2>
          <p className="muted">Only assigned jobs. One live stage at a time.</p>
        </div>
        <button className="secondary" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="content">
        {error ? <div className="error">{error}</div> : null}
        <section className="two-col-operator">
          <div className="panel">
            <h3>Assigned jobs</h3>
            <div className="stack">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedJobId === job.id}
                  onSelect={setSelectedJobId}
                />
              ))}
              {!jobs.length ? <div className="muted">No jobs assigned.</div> : null}
            </div>
          </div>
          <div>
            {selectedJob ? (
              <JobDetail job={selectedJob} currentUser={session.user} onStageSubmit={submitStage} />
            ) : (
              <div className="panel">Select job to update stages.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    const raw = window.localStorage.getItem("job-card-session");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (session) {
      window.localStorage.setItem("job-card-session", JSON.stringify(session));
    } else {
      window.localStorage.removeItem("job-card-session");
    }
  }, [session]);

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return session.user.role === "admin" ? (
    <AdminView session={session} onLogout={() => setSession(null)} />
  ) : (
    <OperatorView session={session} onLogout={() => setSession(null)} />
  );
}
