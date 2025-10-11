const dbx = require("../config/dropbox");

function sanitizeSegment(value, fallback = "unknown") {
  const normalized = (value || fallback)
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .trim();
  const collapsed = normalized.replace(/\s+/g, "_");
  return collapsed || fallback;
}

function buildCustomerFolderPath(agentName, customerName, customerCode) {
  const segments = [
    "finflow",
    sanitizeSegment(agentName, "admin"),
    `${sanitizeSegment(customerName, "customer")}_${customerCode}`,
  ];

  return `/${segments.join("/")}`;
}

async function ensureFolderHierarchy(path) {
  const parts = path
    .split("/")
    .filter(Boolean);

  let currentPath = "";
  let createdAny = false;

  for (const part of parts) {
    currentPath = `${currentPath}/${part}`;
    try {
      await dbx.filesCreateFolderV2({ path: currentPath, autorename: false });
      createdAny = true;
    } catch (error) {
      const summary = error?.error?.error_summary || "";
      if (error?.status === 409 || summary.includes("path/conflict")) {
        continue;
      }
      throw error;
    }
  }

  return { path: currentPath || "/", created: createdAny };
}

async function ensureCustomerFolder(agentName, customerName, customerCode) {
  const folderPath = buildCustomerFolderPath(agentName, customerName, customerCode);
  const result = await ensureFolderHierarchy(folderPath);
  return { ...result, path: folderPath };
}

async function listFolder(path) {
  try {
    const entries = [];
    let cursor = null;
    let response = await dbx.filesListFolder({ path });
    entries.push(...(response.result?.entries || []));
    cursor = response.result?.has_more ? response.result.cursor : null;

    while (cursor) {
      response = await dbx.filesListFolderContinue({ cursor });
      entries.push(...(response.result?.entries || []));
      cursor = response.result?.has_more ? response.result.cursor : null;
    }

    const mapped = await Promise.all(
      entries.map(async (entry) => {
        const isFolder = entry[".tag"] === "folder";
        let downloadUrl = null;
        if (!isFolder) {
          try {
            const linkRes = await dbx.filesGetTemporaryLink({
              path: entry.path_lower || entry.path_display,
            });
            downloadUrl = linkRes.result.link;
          } catch (error) {
            downloadUrl = null;
          }
        }

        return {
          id: entry.id,
          name: entry.name,
          path_lower: entry.path_lower,
          path_display: entry.path_display,
          is_folder: isFolder,
          size: isFolder ? null : entry.size,
          client_modified: entry.client_modified || null,
          server_modified: entry.server_modified || null,
          download_url: downloadUrl,
        };
      })
    );

    return mapped;
  } catch (error) {
    const summary = error?.error?.error_summary || "";
    if (error?.status === 409 || summary.includes("path/not_found")) {
      return [];
    }
    throw error;
  }
}

function combineWithinFolder(basePath, relativePath = "") {
  if (!relativePath) {
    return basePath;
  }

  const trimmed = relativePath.trim();
  if (!trimmed || trimmed === "/") {
    return basePath;
  }

  if (trimmed.includes("..")) {
    const err = new Error("Invalid folder path");
    err.statusCode = 400;
    throw err;
  }

  const normalizedBase = basePath.replace(/\/+$/, "");
  const normalizedRelative = trimmed.replace(/^\/+/, "");
  const candidate = trimmed.startsWith(normalizedBase)
    ? trimmed
    : `${normalizedBase}/${normalizedRelative}`;

  if (!candidate.startsWith(normalizedBase)) {
    const err = new Error("Path outside customer folder");
    err.statusCode = 400;
    throw err;
  }

  return candidate;
}

module.exports = {
  sanitizeSegment,
  buildCustomerFolderPath,
  ensureFolderHierarchy,
  ensureCustomerFolder,
  listFolder,
  combineWithinFolder,
};
