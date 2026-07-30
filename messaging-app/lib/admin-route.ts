const DEFAULT_ADMIN_PATH = "/threadline-ops-9f3c7a2d8e1b4c6f";

export function getAdminBasePath() {
  const configured = String(process.env.THREADLINE_ADMIN_PATH || "").trim().replace(/\/+$/, "");
  return /^\/[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(configured) ? configured : DEFAULT_ADMIN_PATH;
}

export function adminPath(path = "") {
  const suffix = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${getAdminBasePath()}${suffix}`;
}
