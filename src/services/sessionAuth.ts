import { apiFetch } from "./apiClient";

const API_BASE = "/ichinichi/api/auth";

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bufferToHex(digest);
}

export async function getSessionStatus(): Promise<boolean> {
  const response = await apiFetch(`${API_BASE}/session`, {
    notifyOnUnauthorized: false,
  });
  if (!response.ok) {
    throw new Error("Failed to verify session");
  }

  const payload = (await response.json()) as { authenticated?: boolean };
  return payload.authenticated === true;
}

export async function verifyPassword(
  password: string,
  rememberMe: boolean,
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  const response = await apiFetch(`${API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ passwordHash, rememberMe }),
    notifyOnUnauthorized: false,
  });

  if (response.status === 401) {
    return false;
  }
  if (!response.ok) {
    throw new Error("Failed to verify password");
  }

  const payload = (await response.json()) as { authenticated?: boolean };
  return payload.authenticated === true;
}

export async function logoutSession(): Promise<void> {
  const response = await apiFetch(`${API_BASE}/logout`, {
    method: "POST",
    notifyOnUnauthorized: false,
  });

  if (!response.ok) {
    throw new Error("Failed to end session");
  }
}
