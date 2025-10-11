import { api } from "../lib/api.js";
import { normalizeDocuments } from "./normalizeDocuments.js";

export { normalizeDocuments } from "./normalizeDocuments.js";

export async function fetchCustomerDropboxDocuments(customerId, params = {}) {
  const response = await api.get(`/api/documents/customer/${customerId}/dropbox`, {
    params,
  });
  const body = response.data;

  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[Documents] raw response", body, {
      type: typeof body,
      isArray: Array.isArray(body),
    });
  }

  const entries = normalizeDocuments(body?.entries ?? body);
  return {
    path: body?.path ?? null,
    entries,
  };
}
