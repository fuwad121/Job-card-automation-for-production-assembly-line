import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { db } from "./db.js";

export function issueToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username, name: user.name },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare(`
      SELECT id, name, username, role, status
      FROM users
      WHERE id = ?
    `).get(payload.sub);

    if (!user || user.status !== "active") {
      return res.status(401).json({ message: "User inactive or missing" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

