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
    path: body?.path ?? null,
    files,
  };
}

export async function createCustomerDropboxFolder(customerId) {
  const response = await api.post(`/api/customers/${customerId}/create-folder`);
  return response.data;
}

export async function uploadCustomerDocuments(customerId, files, { path, onUploadProgress } = {}) {
  const formData = new FormData();
  const fileArray = Array.from(files || []);
  if (!fileArray.length) {
    throw new Error("No files selected");
  }

  fileArray.forEach((file) => {
    formData.append("files", file);
  });

  if (path) {
    formData.append("path", path);
  }

  const response = await api.post(
    `/api/documents/customer/${customerId}/upload`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    }
  );

  return response.data;
}
