import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import multer from "multer";
import { config } from "./config.js";
import { db, createJobWithStages } from "./db.js";
import { issueToken, requireAuth, requireRole } from "./auth.js";
import { getJobDetails, getJobsForUser, getUsers, refreshJobStatus } from "./queries.js";

fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });
const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(config.uploadDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare(`
    SELECT id, name, username, role, status, password_hash
    FROM users
    WHERE username = ?
  `).get(username);

  if (!user || user.status !== "active" || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = issueToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status
    }
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/users", requireAuth, requireRole("admin"), (_req, res) => {
  res.json(getUsers());
});

app.post("/api/users", requireAuth, requireRole("admin"), (req, res) => {
  const { name, username, password, role } = req.body || {};
  if (!name || !username || !password || !["admin", "operator"].includes(role)) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(409).json({ message: "Username already exists" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, username, password_hash, role, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(name, username, hash, role);

  const user = db.prepare(`
    SELECT id, name, username, role, status, created_at
    FROM users
    WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(user);
});

app.patch("/api/users/:id/status", requireAuth, requireRole("admin"), (req, res) => {
  const { status } = req.body || {};
  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, req.params.id);
  const user = db.prepare(`
    SELECT id, name, username, role, status, created_at
    FROM users
    WHERE id = ?
  `).get(req.params.id);

  res.json(user);
});

app.get("/api/operators", requireAuth, requireRole("admin"), (_req, res) => {
  const operators = db.prepare(`
    SELECT id, name, username, role, status
    FROM users
    WHERE role = 'operator' AND status = 'active'
    ORDER BY name ASC
  `).all();
  res.json(operators);
});

app.get("/api/jobs", requireAuth, (req, res) => {
  res.json(getJobsForUser(req.user));
});

app.get("/api/jobs/:id", requireAuth, (req, res) => {
  const job = getJobDetails(req.params.id);
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }
  if (req.user.role === "operator" && job.assigned_operator !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  res.json(job);
});

app.post("/api/jobs", requireAuth, requireRole("admin"), (req, res) => {
  const { jobId, projectId, model, serial, assignedOperator } = req.body || {};
  if (!jobId || !projectId || !model || !serial || !assignedOperator) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const operator = db.prepare(`
    SELECT id FROM users
    WHERE id = ? AND role = 'operator' AND status = 'active'
  `).get(assignedOperator);

  if (!operator) {
    return res.status(400).json({ message: "Assigned operator invalid" });
  }

  try {
    const newJobId = createJobWithStages({ jobId, projectId, model, serial, assignedOperator });
    res.status(201).json(getJobDetails(newJobId));
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return res.status(409).json({ message: "Job ID must be unique" });
    }
    return res.status(500).json({ message: "Failed to create job" });
  }
});

app.post("/api/stages/:id/submit", requireAuth, requireRole("operator"), upload.any(), (req, res) => {
  const stageId = Number(req.params.id);
  const stage = db.prepare(`
    SELECT s.*, j.assigned_operator, j.id AS job_pk
    FROM stages s
    JOIN jobs j ON j.id = s.job_id
    WHERE s.id = ?
  `).get(stageId);

  if (!stage) {
    return res.status(404).json({ message: "Stage not found" });
  }
  if (stage.assigned_operator !== req.user.id) {
    return res.status(403).json({ message: "Not your job" });
  }
  if (stage.status === "completed") {
    return res.status(400).json({ message: "Stage already completed" });
  }

  const previousOpen = db.prepare(`
    SELECT id
    FROM stages
    WHERE job_id = ? AND stage_order < ? AND status != 'completed'
    ORDER BY stage_order ASC
    LIMIT 1
  `).get(stage.job_id, stage.stage_order);

  if (previousOpen) {
    return res.status(400).json({ message: "Complete earlier stages first" });
  }

  let taskInputs = [];
  try {
    taskInputs = JSON.parse(req.body.taskUpdates || "[]");
  } catch {
    return res.status(400).json({ message: "Bad taskUpdates payload" });
  }

  const stageTasks = db.prepare(`
    SELECT id, description, required
    FROM tasks
    WHERE stage_id = ?
    ORDER BY id ASC
  `).all(stageId);

  const imageMap = new Map(
    (req.files || []).map((file) => [
      Number(String(file.fieldname).replace("image_", "")),
      `/uploads/${file.filename}`
    ])
  );

  const inputMap = new Map(taskInputs.map((item) => [Number(item.taskId), item]));
  const hasAction = taskInputs.some((item) => item.completed || (item.remarks || "").trim());
  if (!hasAction) {
    return res.status(400).json({ message: "At least one checkbox or remark required" });
  }

  const incompleteRequired = stageTasks.some((task) => {
    const update = inputMap.get(task.id);
    return task.required === 1 && !update?.completed;
  });
  if (incompleteRequired) {
    return res.status(400).json({ message: "Complete all required tasks first" });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE stages
      SET status = 'completed',
          started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
          completed_at = CURRENT_TIMESTAMP,
          completed_by = ?
      WHERE id = ?
    `).run(req.user.id, stageId);

    for (const task of stageTasks) {
      const update = inputMap.get(task.id) || {};
      db.prepare(`
        INSERT INTO task_logs (stage_id, task_id, operator_id, completed, remarks, image_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        stageId,
        task.id,
        req.user.id,
        update.completed ? 1 : 0,
        (update.remarks || "").trim(),
        imageMap.get(task.id) || null
      );
    }
  });

  tx();
  refreshJobStatus(stage.job_id);

  res.json(getJobDetails(stage.job_id));
});

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
  console.log(`Seed admin: ${config.seedAdminUsername} / ${config.seedAdminPassword}`);
});
