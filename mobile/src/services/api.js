// Mobile API service to communicate with the Python backend

export const DEFAULT_API_URL = 'http://192.168.1.16:8000';
export const LOCALHOST_API_URL = 'http://localhost:8000';

let currentApiUrl = DEFAULT_API_URL;

export const setApiUrl = (url) => {
  if (!url) return;
  // Strip trailing slashes
  currentApiUrl = url.replace(/\/+$/, '');
};

export const getApiUrl = () => currentApiUrl;

export const testConnection = async (targetUrl = currentApiUrl) => {
  const url = targetUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`${url}/`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, error: err.message || 'Connection failed' };
  }
};

export const fetchOverview = async (targetUrl = currentApiUrl) => {
  const url = targetUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(`${url}/api/overview`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};
