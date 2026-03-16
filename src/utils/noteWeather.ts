import type { NoteWeather } from "../types";

export function noteWeatherEquals(
  left: NoteWeather | null | undefined,
  right: NoteWeather | null | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.city === right.city &&
    left.temperature === right.temperature &&
    left.icon === right.icon &&
    left.unit === right.unit
  );
}
