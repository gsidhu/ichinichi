import {
  LOCATION_KIND_KEY,
  LOCATION_LABEL_KEY,
  LOCATION_LAT_KEY,
  LOCATION_LON_KEY,
  MANUAL_TEMP_KEY,
  MANUAL_ICON_KEY,
  SHOW_WEATHER_KEY,
  TEMP_UNIT_KEY,
} from "../../utils/constants";

export type UnitPreference = "auto" | "C" | "F";
export type LocationKind = "approx" | "precise" | "manual";

export function getShowWeatherPreference(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(SHOW_WEATHER_KEY);
  if (stored === null) return true;
  return stored !== "false";
}

export function setShowWeatherPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHOW_WEATHER_KEY, String(enabled));
}

export function getUnitPreference(): UnitPreference {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(TEMP_UNIT_KEY) as UnitPreference | null;
  if (stored === "C" || stored === "F" || stored === "auto") return stored;
  return "auto";
}

export function setUnitPreference(value: UnitPreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEMP_UNIT_KEY, value);
}

export function getLocationLabel(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOCATION_LABEL_KEY);
}

export function setLocationLabel(value: string | null): void {
  if (typeof window === "undefined") return;
  if (!value) {
    localStorage.removeItem(LOCATION_LABEL_KEY);
    return;
  }
  localStorage.setItem(LOCATION_LABEL_KEY, value);
}

export function getLocationKind(): LocationKind | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(LOCATION_KIND_KEY);
  if (stored === "approx" || stored === "precise") return stored;
  return null;
}

export function setLocationKind(value: LocationKind | null): void {
  if (typeof window === "undefined") return;
  if (!value) {
    localStorage.removeItem(LOCATION_KIND_KEY);
    return;
  }
  localStorage.setItem(LOCATION_KIND_KEY, value);
}

export function getLocationCoords(): { lat: number; lon: number } | null {
  if (typeof window === "undefined") return null;
  const lat = localStorage.getItem(LOCATION_LAT_KEY);
  const lon = localStorage.getItem(LOCATION_LON_KEY);
  if (lat === null || lon === null) return null;
  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) return null;
  return { lat: parsedLat, lon: parsedLon };
}

export function setLocationCoords(lat: number, lon: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCATION_LAT_KEY, String(lat));
  localStorage.setItem(LOCATION_LON_KEY, String(lon));
}

export function clearLocationCoords(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCATION_LAT_KEY);
  localStorage.removeItem(LOCATION_LON_KEY);
}

export function getManualTemp(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(MANUAL_TEMP_KEY);
  return stored ? parseFloat(stored) : null;
}

export function setManualTemp(value: number | null): void {
  if (typeof window === "undefined") return;
  if (value === null) {
    localStorage.removeItem(MANUAL_TEMP_KEY);
  } else {
    localStorage.setItem(MANUAL_TEMP_KEY, String(value));
  }
}

export function getManualIcon(): string {
  if (typeof window === "undefined") return "🌡️";
  return localStorage.getItem(MANUAL_ICON_KEY) || "🌡️";
}

export function setManualIcon(value: string | null): void {
  if (typeof window === "undefined") return;
  if (value === null) {
    localStorage.removeItem(MANUAL_ICON_KEY);
  } else {
    localStorage.setItem(MANUAL_ICON_KEY, value);
  }
}
