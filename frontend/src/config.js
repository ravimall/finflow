const FALLBACK_BASE_URL = "https://finflow-backend-80cf.onrender.com";

let runtimeBaseUrl;
if (typeof import.meta !== "undefined") {
  runtimeBaseUrl =
    import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL;
}

export const API_BASE_URL = runtimeBaseUrl || FALLBACK_BASE_URL;

