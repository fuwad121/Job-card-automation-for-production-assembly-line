import { db } from "./db.js";

export function getUsers() {
  return db.prepare(`
    SELECT id, name, username, role, status, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();
}

export function getJobsForUser(user) {
  const whereClause = user.role === "admin" ? "" : "WHERE j.assigned_operator = @userId";
  return db.prepare(`
    SELECT
      j.id,
      j.job_id,
      j.project_id,
      j.model,
      j.serial,
      j.status,
      j.created_at,
      j.updated_at,
      u.name AS operator_name,
      u.id AS operator_id,
      COUNT(s.id) AS total_stages,
      SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS completed_stages
    FROM jobs j
    JOIN users u ON u.id = j.assigned_operator
    LEFT JOIN stages s ON s.job_id = j.id
    ${whereClause}
    GROUP BY j.id
    ORDER BY j.created_at DESC
  `).all({ userId: user.id });
}

export function getJobDetails(jobId) {
  const job = db.prepare(`
    SELECT
      j.id,
      j.job_id,
      j.project_id,
      j.model,
      j.serial,
      j.status,
      j.assigned_operator,
      j.created_at,
      j.updated_at,
      u.name AS operator_name
    FROM jobs j
    JOIN users u ON u.id = j.assigned_operator
    WHERE j.id = ?
  `).get(jobId);

  if (!job) return null;

  const stages = db.prepare(`
    SELECT
      s.id,
      s.stage_order,
      s.stage_name,
      s.status,
      s.started_at,
      s.completed_at,
      s.completed_by,
      cu.name AS completed_by_name
    FROM stages s
    LEFT JOIN users cu ON cu.id = s.completed_by
    WHERE s.job_id = ?
    ORDER BY s.stage_order ASC
  `).all(jobId);

  const taskStmt = db.prepare(`
    SELECT
      t.id,
      t.stage_id,
      t.description,
      t.required
    FROM tasks t
    WHERE t.stage_id = ?
    ORDER BY t.id ASC
  `);

  const logStmt = db.prepare(`
    SELECT
      tl.id,
      tl.task_id,
      tl.operator_id,
      tl.completed,
      tl.remarks,
      tl.image_url,
      tl.created_at,
      u.name AS operator_name,
      t.description AS task_description
    FROM task_logs tl
    JOIN users u ON u.id = tl.operator_id
    JOIN tasks t ON t.id = tl.task_id
    WHERE tl.stage_id = ?
    ORDER BY tl.created_at DESC, tl.id DESC
  `);

  return {
    ...job,
    stages: stages.map((stage) => ({
      ...stage,
      tasks: taskStmt.all(stage.id),
      logs: logStmt.all(stage.id)
    }))
  };
}

export function refreshJobStatus(jobId) {
  const counts = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS done
    FROM stages
    WHERE job_id = ?
  `).get(jobId);

  let nextStatus = "pending";
  if (counts.done > 0 && counts.done < counts.total) nextStatus = "in_progress";
  if (counts.done === counts.total) nextStatus = "completed";

  db.prepare(`
    UPDATE jobs
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextStatus, jobId);

  return nextStatus;
}
