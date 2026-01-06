const TOKEN_KEY = "bn9.admin.token";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
  window.dispatchEvent(new Event("bn9:token-changed"));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("bn9:token-changed"));
}

// ใส่ Authorization เฉพาะเมื่อมี token เท่านั้น
export function getAuthHeaders(): Record<string, string> {
  const t = localStorage.getItem("BN9_TOKEN");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

