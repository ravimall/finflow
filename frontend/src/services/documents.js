import { api } from "../lib/api.js";
import { normalizeDocuments } from "./normalizeDocuments.js";

export { normalizeDocuments } from "./normalizeDocuments.js";

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

  const files = normalizeDocuments(body?.files ?? body?.entries ?? body);
  const existsFlag =
    typeof body?.exists === "boolean" ? body.exists : Boolean(body?.path);

  return {
    exists: existsFlag,
    path: body?.path ?? params?.path ?? null,
    files,
  };
}

export async function createCustomerDropboxFolder(customerId) {
  const response = await api.post(`/api/customers/${customerId}/create-folder`);
  return response.data;
}

export async function uploadCustomerDocuments(customerId, files, { path, onUploadProgress } = {}) {
  if (!customerId) {
    throw new Error("customerId is required");
  }
  const formData = new FormData();
  const fileArray = Array.from(files || []);
  if (!fileArray.length) {
    throw new Error("No files selected");
  }

  fileArray.forEach((file) => {
    formData.append("files", file);
  });

  formData.append("customerId", customerId);
  if (path) {
    formData.append("path", path);
  }

  const response = await api.post(
    "/api/documents/upload",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    }
  );

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

export async function fetchDocuments(customerId, { fileType, uploadedBy, sort, order } = {}) {
  if (!customerId) {
    throw new Error("customerId is required");
  }

  const params = {
    customerId,
    type: fileType,
    uploadedBy,
    sort,
    order,
  };

  const response = await api.get("/api/documents", { params });
  return response.data;
}

export async function uploadDocuments(customerId, files, options = {}) {
  return uploadCustomerDocuments(customerId, files, options);
}

export async function renameDocument(id, name) {
  if (!id) throw new Error("Document id is required");
  const response = await api.put(`/api/documents/${id}/rename`, { name });
  return response.data;
}

export async function deleteDocument(id) {
  if (!id) throw new Error("Document id is required");
  const response = await api.delete(`/api/documents/${id}`);
  return response.data;
}

export async function bulkDeleteDocuments(ids) {
  if (!Array.isArray(ids) || !ids.length) {
    throw new Error("ids array is required");
  }
  const response = await api.delete("/api/documents", { data: { ids } });
  return response.data;
}

export async function downloadDocument(id) {
  if (!id) throw new Error("Document id is required");
  const response = await api.get(`/api/documents/${id}/download`);
  return response.data;
}

export async function previewDocument(id) {
  if (!id) throw new Error("Document id is required");
  const response = await api.get(`/api/documents/${id}/preview`);
  return response.data;
}

export async function batchDownloadDocuments(ids) {
  if (!Array.isArray(ids) || !ids.length) {
    throw new Error("ids array is required");
  }
  const response = await api.post("/api/documents/batch-download", { ids });
  return response.data;
}
