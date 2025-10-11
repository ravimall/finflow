export function normalizeDocuments(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.entries)) return payload.entries;
  if (Array.isArray(payload?.files)) return payload.files;
  if (Array.isArray(payload?.documents)) return payload.documents;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
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

export default normalizeDocuments;
