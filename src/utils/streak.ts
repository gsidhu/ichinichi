import { apiFetch } from "../services/apiClient";

const API_BASE = "/ichinichi/api";

export interface CurrentStreak {
  length: number;
}

export interface LongestStreak {
  length: number;
  startDate: string | null;
}

export async function getCurrentStreak(): Promise<CurrentStreak> {
  const response = await apiFetch(`${API_BASE}/streak/current`);
  if (!response.ok) {
    throw new Error("Failed to fetch current streak");
  }

  return (await response.json()) as CurrentStreak;
}

export async function getLongestStreak(): Promise<LongestStreak> {
  const response = await apiFetch(`${API_BASE}/streak/longest`);
  if (!response.ok) {
    throw new Error("Failed to fetch longest streak");
  }

  return (await response.json()) as LongestStreak;
}
