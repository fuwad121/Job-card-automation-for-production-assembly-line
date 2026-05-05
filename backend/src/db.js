import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { stageTemplates } from "./stageTemplates.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'operator')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL,
    model TEXT NOT NULL,
    serial TEXT NOT NULL,
    assigned_operator INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_operator) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    stage_order INTEGER NOT NULL,
    stage_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
    started_at TEXT,
    completed_at TEXT,
    completed_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (completed_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    required INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    operator_id INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    remarks TEXT DEFAULT '',
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id)
  );
`);

const adminExists = db.prepare("SELECT id FROM users WHERE username = ?").get(config.seedAdminUsername);
if (!adminExists) {
  const hash = bcrypt.hashSync(config.seedAdminPassword, 10);
  db.prepare(`
    INSERT INTO users (name, username, password_hash, role, status)
    VALUES (?, ?, ?, 'admin', 'active')
  `).run(config.seedAdminName, config.seedAdminUsername, hash);
}

export function createJobWithStages({ jobId, projectId, model, serial, assignedOperator }) {
  const tx = db.transaction(() => {
    const jobResult = db.prepare(`
      INSERT INTO jobs (job_id, project_id, model, serial, assigned_operator, status, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `).run(jobId, projectId, model, serial, assignedOperator);

    for (const [index, template] of stageTemplates.entries()) {
      const stageResult = db.prepare(`
        INSERT INTO stages (job_id, stage_order, stage_name, status)
        VALUES (?, ?, ?, 'pending')
      `).run(jobResult.lastInsertRowid, index + 1, template.name);

      for (const task of template.tasks) {
        db.prepare(`
          INSERT INTO tasks (stage_id, description, required)
          VALUES (?, ?, ?)
        `).run(stageResult.lastInsertRowid, task.description, task.required);
      }
    }

    return jobResult.lastInsertRowid;
  });

  return tx();
}

