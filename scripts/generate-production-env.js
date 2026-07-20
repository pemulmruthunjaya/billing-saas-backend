const crypto = require("crypto");

const parseArgs = () => {
  const args = {};

  process.argv.slice(2).forEach((arg) => {
    if (!arg.startsWith("--")) return;

    const [key, ...valueParts] = arg.slice(2).split("=");
    args[key] = valueParts.length ? valueParts.join("=") : true;
  });

  return args;
};

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const valueOrPlaceholder = (value, placeholder) =>
  value === undefined || value === "" ? placeholder : value;

const args = parseArgs();
const frontendUrl = trimTrailingSlash(
  valueOrPlaceholder(args["frontend-url"], "https://your-frontend-domain.com")
);
const backendUrl = trimTrailingSlash(
  valueOrPlaceholder(args["backend-url"], "https://your-backend-domain.com")
);
const jwtSecret = crypto.randomBytes(48).toString("hex");

const backendEnv = {
  NODE_ENV: "production",
  PORT: valueOrPlaceholder(args.port, "3000"),
  DB_HOST: valueOrPlaceholder(args["db-host"], "your-live-db-host"),
  DB_PORT: valueOrPlaceholder(args["db-port"], "3306"),
  DB_USER: valueOrPlaceholder(args["db-user"], "your-live-db-user"),
  DB_PASSWORD: valueOrPlaceholder(args["db-password"], "your-live-db-password"),
  DB_NAME: valueOrPlaceholder(args["db-name"], "your-live-db-name"),
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: valueOrPlaceholder(args["jwt-expires-in"], "1d"),
  CORS_ORIGINS: frontendUrl,
  JSON_BODY_LIMIT: valueOrPlaceholder(args["json-body-limit"], "25mb"),
  API_RATE_LIMIT_WINDOW_MS: valueOrPlaceholder(
    args["api-rate-window-ms"],
    "900000"
  ),
  API_RATE_LIMIT_MAX: valueOrPlaceholder(args["api-rate-max"], "1000"),
  LOGIN_RATE_LIMIT_WINDOW_MS: valueOrPlaceholder(
    args["login-rate-window-ms"],
    "900000"
  ),
  LOGIN_RATE_LIMIT_MAX: valueOrPlaceholder(args["login-rate-max"], "20"),
  BACKUP_DIR: valueOrPlaceholder(args["backup-dir"], "backups"),
};

const frontendEnv = {
  VITE_API_BASE_URL: backendUrl,
};

const printEnv = (title, values) => {
  console.log(`\n=== ${title} ===`);
  Object.entries(values).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });
};

console.log("Production environment helper");
console.log("Use these values in your hosting dashboards. Do not commit secrets.");
printEnv("Backend / Railway Variables", backendEnv);
printEnv("Frontend Variables", frontendEnv);

console.log("\n=== After Deploy ===");
console.log(`Backend health check: ${backendUrl}/api/health`);
console.log("Frontend Launch Checklist: open the app, then go to Launch Checklist");
console.log("\nUseful command examples:");
console.log(
  "npm run env:production -- --frontend-url=https://app.example.com --backend-url=https://api.example.com"
);
console.log(
  "npm run audit:production"
);

const warnings = [];
if (frontendUrl.includes("localhost")) {
  warnings.push("Frontend URL is localhost. Use the live frontend domain.");
}
if (backendUrl.includes("localhost")) {
  warnings.push("Backend URL is localhost. Use the live backend domain.");
}

if (warnings.length) {
  console.log("\nWarnings:");
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
