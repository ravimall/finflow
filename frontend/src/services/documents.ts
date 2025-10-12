import { api } from "../lib/api.js";

export type Doc = { id: string; title?: string; name?: string; [k: string]: any };

export function normalizeDocuments(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.documents)) return payload.documents;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.files)) return payload.files;
  if (Array.isArray(payload?.entries)) return payload.entries;
  if (payload && typeof payload === "object") {
    return Object.values(payload);
  }
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return normalizeDocuments(parsed);
    } catch (error) {
      return [];
    }
  }
  return [];
}

export async function fetchDocuments() {
  const response = await api.get("/api/documents");
  const body = response.data ?? [];
  // console.debug("[Documents] raw response:", body, {
  //   type: typeof body,
  //   isArray: Array.isArray(body),
  // });
  const docs = normalizeDocuments(body);
  return Array.isArray(docs) ? docs : [];
}

export async function fetchCustomerDropboxDocuments(customerId, params = {}) {
  const response = await api.get(`/api/documents/customer/${customerId}/dropbox`, {
    params,
  });
  const body = response.data ?? {};

  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[Documents] raw response", body, {
      type: typeof body,
      isArray: Array.isArray(body),
    });
  }

  const normalizedBody = body && typeof body === "object" ? body : {};
  const pathFromBody = typeof normalizedBody.path === "string" ? normalizedBody.path : null;
  const filesCandidate =
    Array.isArray(normalizedBody.files) || Array.isArray(normalizedBody.entries)
      ? normalizedBody.files ?? normalizedBody.entries
      : body;
  const files = normalizeDocuments(filesCandidate);
  const existsFlag = typeof normalizedBody.exists === "boolean" ? normalizedBody.exists : Boolean(pathFromBody);
  const paramsPath = typeof params?.path === "string" ? params.path : null;

  return {
    exists: existsFlag,
    path: pathFromBody ?? paramsPath,
    files,
  };
}

export async function createCustomerDropboxFolder(customerId) {
  const response = await api.post(`/api/customers/${customerId}/create-folder`);
  return response.data;
}

export async function uploadCustomerDocuments(customerId, files, options = {}) {
  const formData = new FormData();
  const fileArray = Array.from(files || []);
  if (!fileArray.length) {
    throw new Error("No files selected");
  }

  fileArray.forEach((file) => {
    formData.append("files", file);
  });

  if (options.path) {
    formData.append("path", options.path);
  }

  const response = await api.post(`/api/documents/customer/${customerId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: options.onUploadProgress,
  });

  return response.data;
}

export async function createDropboxSubfolder(customerId, folderName, parentPath) {
  const response = await api.post("/api/documents/folder", {
    customer_id: customerId,
    folder_name: folderName,
    parent_path: parentPath,
  });
  return response.data;
}

export async function deleteDropboxFiles(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("No paths provided");
  }
  const response = await api.delete("/api/documents/delete", {
    data: { paths },
  });
  return response.data;
}

export async function renameDropboxFile(oldPath, newName) {
  const response = await api.post("/api/documents/rename", {
    old_path: oldPath,
    new_name: newName,
  });
  return response.data;
}

export async function getDropboxDownloadLink(path) {
  if (!path) throw new Error("Missing path");
  const response = await api.get("/api/documents/download", {
    params: { path },
  });
  return response.data;
}

export async function getDropboxPreviewLink(path) {
  if (!path) throw new Error("Missing path");
  const response = await api.get("/api/documents/preview", {
    params: { path },
  });
  return response.data;
}
