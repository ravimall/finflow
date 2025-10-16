import fs from "fs";
import path from "path";

// load .env.production if present, else .env (no libs)
function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  for (const ln of lines) {
    const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1].trim()] ??= v;
  }
}

loadEnv(path.resolve(".env.production"));
loadEnv(path.resolve(".env"));

const base = process.env.API_BASE_URL || "";
if (!base) {
  console.error("API_BASE_URL not found. Add it to .env.production or .env");
  process.exit(1);
}
const url = base.replace(/\/+$/,"") + "/health";
console.log(url);
