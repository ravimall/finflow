const dbx = require("../config/dropbox");
const { sanitizeSegment } = require("../utils/dropboxPath");

const FEATURE_USE_FOLDER_ID = String(process.env.FEATURE_USE_FOLDER_ID || "true").toLowerCase() !== "false";

function logDropboxAction(action, path, userId) {
  const normalizedAction = action || "unknown";
  const normalizedPath = path || "N/A";
  const normalizedUser = typeof userId === "undefined" ? "unknown" : userId;
  // eslint-disable-next-line no-console
  console.log(
    `[Dropbox] Action: ${normalizedAction}, Path: ${normalizedPath}, User: ${normalizedUser}`
  );
}

function shouldUseFolderId() {
  return FEATURE_USE_FOLDER_ID;
}

function slugify(value, fallback = "customer") {
  const sanitized = sanitizeSegment(value, fallback);
  return sanitized.toLowerCase().replace(/_+/g, "-");
}

function unwrap(result) {
  if (!result) {
    return null;
  }
  return result.result || result;
}

function buildCustomerFolderPath(customer) {
  const slug = slugify(customer?.name, "customer");
  const customerCode = customer?.customer_id || customer?.customerId || "unknown";
  return `/FinFlow/customers/${customerCode}-${slug}`;
}

async function getFolderById(folderId) {
  if (!folderId) {
    return null;
  }
  try {
    const response = await dbx.filesGetMetadata({ path: folderId });
    return unwrap(response);
  } catch (error) {
    const summary = error?.error?.error_summary || "";
    if (error?.status === 409 || summary.includes("not_found")) {
      return null;
    }
    throw error;
  }
}

async function getOrCreateCustomerFolder(customer) {
  const targetPath = buildCustomerFolderPath(customer);
  let created = false;
  let metadata = null;

  try {
    const response = await dbx.filesCreateFolderV2({
      path: targetPath,
      autorename: false,
    });
    metadata = unwrap(response)?.metadata || unwrap(response);
    created = true;
  } catch (error) {
    const summary = error?.error?.error_summary || "";
    if (error?.status === 409 || summary.includes("path/conflict")) {
      const lookup = await dbx.filesGetMetadata({ path: targetPath });
      metadata = unwrap(lookup);
    } else {
      throw error;
    }
  }

  if (!metadata) {
    const lookup = await dbx.filesGetMetadata({ path: targetPath });
    metadata = unwrap(lookup);
  }

  const folderId = metadata?.id || null;
  const sharedFolderId = metadata?.sharing_info?.shared_folder_id || null;
  const pathDisplay = metadata?.path_display || metadata?.path_lower || targetPath;

  logDropboxAction(
    created ? "create-folder" : "lookup-folder",
    pathDisplay,
    customer?.id || "system"
  );

  return {
    folderId,
    sharedFolderId,
    pathDisplay,
    metadata,
    created,
  };
}

async function shareFolderIfNeeded(folderId, sharedFolderId) {
  if (!folderId) {
    return { sharedFolderId: sharedFolderId || null, changed: false };
  }

  if (sharedFolderId) {
    return { sharedFolderId, changed: false };
  }

  try {
    const response = await dbx.sharingShareFolder({ path: folderId });
    const shared = unwrap(response);
    return { sharedFolderId: shared?.shared_folder_id || null, changed: true };
  } catch (error) {
    const summary = error?.error?.error_summary || "";
    if (
      error?.status === 409 &&
      (summary.includes("already_shared") || summary.includes("team_folder"))
    ) {
      const metadata = await getFolderById(folderId);
      return {
        sharedFolderId: metadata?.sharing_info?.shared_folder_id || sharedFolderId || null,
        changed: false,
      };
    }
    throw error;
  }
}

async function listCurrentMembers(sharedFolderId) {
  if (!sharedFolderId) {
    return { byEmail: new Map(), entries: [] };
  }

  const response = await dbx.sharingListFolderMembers({ shared_folder_id: sharedFolderId });
  const result = unwrap(response);
  const allEntries = [
    ...(result?.users || []),
    ...(result?.groups || []),
    ...(result?.invitees || []),
  ];

  const byEmail = new Map();
  for (const entry of allEntries) {
    const tag = entry?.user?.email || entry?.invitee?.email || entry?.group?.group_name;
    if (!tag) {
      continue;
    }
    byEmail.set(tag.toLowerCase(), entry);
  }

  return { byEmail, entries: allEntries };
}

function buildMemberAddRequest({ email, accessType }) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const normalizedAccess = accessType === "viewer" ? "viewer" : "editor";

  return {
    member: { ".tag": "email", email: normalizedEmail },
    access_level: { ".tag": normalizedAccess },
  };
}

async function ensureMembers(folderId, sharedFolderId, desiredMembers = []) {
  if (!Array.isArray(desiredMembers) || desiredMembers.length === 0) {
    return { added: [], removed: [], sharedFolderId: sharedFolderId || null };
  }

  const ensured = await shareFolderIfNeeded(folderId, sharedFolderId);
  const effectiveSharedId = ensured.sharedFolderId;

  if (!effectiveSharedId) {
    return { added: [], removed: [], sharedFolderId: null };
  }

  const { byEmail } = await listCurrentMembers(effectiveSharedId);
  const desiredMap = new Map();
  for (const member of desiredMembers) {
    const normalizedEmail = (member?.email || "").toLowerCase();
    if (!normalizedEmail) {
      continue;
    }
    desiredMap.set(normalizedEmail, member);
  }

  const toAdd = [];
  const toKeep = new Set();

  for (const [email, details] of desiredMap.entries()) {
    const existing = byEmail.get(email);
    if (!existing) {
      const payload = buildMemberAddRequest(details);
      if (payload) {
        toAdd.push(payload);
      }
      continue;
    }
    const currentAccessTag = existing?.access_type?.[".tag"];
    const desiredAccess = details.accessType === "viewer" ? "viewer" : "editor";
    if (currentAccessTag !== desiredAccess) {
      const payload = buildMemberAddRequest(details);
      if (payload) {
        toAdd.push(payload);
      }
    } else {
      toKeep.add(email);
    }
  }

  if (toAdd.length) {
    await dbx.sharingAddFolderMember({
      shared_folder_id: effectiveSharedId,
      members: toAdd,
      quiet: true,
    });
  }

  const removed = [];
  for (const [email, entry] of byEmail.entries()) {
    if (toKeep.has(email)) {
      continue;
    }
    const membership = entry?.access_type?.[".tag"];
    if (membership === "owner") {
      continue;
    }
    await dbx.sharingRemoveFolderMember({
      shared_folder_id: effectiveSharedId,
      member: { ".tag": "email", email },
      leave_a_copy: false,
    });
    removed.push(email);
  }

  return { added: toAdd.map((item) => item.member.email), removed, sharedFolderId: effectiveSharedId };
}

async function resolveFolderPath(folderId) {
  const metadata = await getFolderById(folderId);
  return metadata?.path_display || metadata?.path_lower || null;
}

async function resolveDropboxWebLink(folderId) {
  const metadata = await getFolderById(folderId);
  if (!metadata) {
    return null;
  }
  const pathDisplay = metadata.path_display || metadata.path_lower;
  if (!pathDisplay) {
    return null;
  }
  const encoded = encodeURI(pathDisplay);
  return `https://www.dropbox.com/home${encoded}`;
}

module.exports = {
  FEATURE_USE_FOLDER_ID,
  shouldUseFolderId,
  buildCustomerFolderPath,
  getOrCreateCustomerFolder,
  getFolderById,
  shareFolderIfNeeded,
  ensureMembers,
  resolveFolderPath,
  resolveDropboxWebLink,
};
