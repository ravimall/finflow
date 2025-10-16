const dbx = require("../config/dropbox");
const {
  LEGACY_PATH_PREFIXES,
  sanitizeSegment,
  buildCustomerFolderPath,
  isLegacyDropboxPath,
} = require("./dropboxPath");

function logDropboxAction(action, path, userId) {
  const normalizedAction = action || "unknown";
  const normalizedPath = path || "N/A";
  const normalizedUser = typeof userId === "undefined" ? "unknown" : userId;
  // eslint-disable-next-line no-console
  console.log(
    `[Dropbox] Action: ${normalizedAction}, Path: ${normalizedPath}, User: ${normalizedUser}`
  );
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
  logDropboxAction("create-folder", folderPath, "system");
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

    const mapped = entries.map((entry) => {
      const isFolder = entry[".tag"] === "folder";

      return {
        id: entry.id,
        name: entry.name,
        path_lower: entry.path_lower,
        path_display: entry.path_display,
        is_folder: isFolder,
        size: isFolder ? null : entry.size,
        client_modified: entry.client_modified || null,
        server_modified: entry.server_modified || null,
      };
    });

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
  isLegacyDropboxPath,
  LEGACY_PATH_PREFIXES,
  logDropboxAction,
};
