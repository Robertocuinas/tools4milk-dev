const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

// Behavior:
// - If NEXT_PUBLIC_API_URL is undefined: fallback to http://localhost:8000 (local dev)
// - If NEXT_PUBLIC_API_URL is "" (empty string): use same-origin "/" (Docker/Nginx deployment)
// - If NEXT_PUBLIC_API_URL is set to a URL: use that URL
export const API_BASE_URL = (
  configuredApiUrl === undefined ? "http://localhost:8000" : configuredApiUrl
).replace(/\/$/, "");

export const API_V1_URL = `${API_BASE_URL}/api/v1`;

// La identidad y las credenciales nunca se guardan en almacenamiento web.
// La sesión persistente vive únicamente en la cookie HttpOnly del backend.
export const ACTIVE_ZONE_STORAGE_KEY = "t4m_active_zone";
