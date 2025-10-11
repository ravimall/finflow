const FALLBACK_BASE_URL = "https://finflow-backend-80cf.onrender.com";

export const API_BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : FALLBACK_BASE_URL;

