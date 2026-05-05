import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "change-me-super-secret",
  seedAdminName: process.env.SEED_ADMIN_NAME || "System Admin",
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME || "admin",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "admin123",
  dbPath: path.join(rootDir, "..", "data", "app.db"),
  uploadDir: path.join(rootDir, "..", "uploads")
};

