const dbx = require("../config/dropbox");

async function ensureSharedLink(path) {
  if (!path) {
    return null;
  }

  try {
    const existing = await dbx.sharingListSharedLinks({ path, direct_only: true });
    const link = existing?.result?.links?.[0]?.url;
    if (link) {
      return link.replace("?dl=0", "?dl=1");
    }
  } catch (error) {
    const summary = error?.error?.error_summary || "";
    if (!summary.includes("not_found")) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️ Dropbox shared link lookup failed for ${path}: ${summary || error.message}`);
    }
  }

  try {
    const created = await dbx.sharingCreateSharedLinkWithSettings({ path });
    return created?.result?.url?.replace("?dl=0", "?dl=1") || null;
  } catch (error) {
    const summary = error?.error?.error_summary || "";
    if (summary.includes("shared_link_already_exists")) {
      try {
        const existing = await dbx.sharingListSharedLinks({ path, direct_only: true });
        const link = existing?.result?.links?.[0]?.url;
        return link ? link.replace("?dl=0", "?dl=1") : null;
      } catch (inner) {
        const innerSummary = inner?.error?.error_summary || inner?.message || "unknown error";
        // eslint-disable-next-line no-console
        console.error(`❌ Dropbox shared link recovery failed for ${path}: ${innerSummary}`);
        return null;
      }
    }

    const message = summary || error?.message || "unknown error";
    // eslint-disable-next-line no-console
    console.error(`❌ Dropbox shared link creation failed for ${path}: ${message}`);
    return null;
  }
}

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
        const sharedLink = !isFolder
          ? await ensureSharedLink(entry.path_lower || entry.path_display)
          : null;

        return {
          id: entry.id,
          name: entry.name,
          path_lower: entry.path_lower,
          path_display: entry.path_display,
          is_folder: isFolder,
          size: isFolder ? null : entry.size,
          client_modified: entry.client_modified || null,
          server_modified: entry.server_modified || null,
          download_url: sharedLink,
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
  ensureSharedLink,
};
