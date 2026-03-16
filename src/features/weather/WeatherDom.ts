import type { DailyWeatherData } from "./WeatherRepository";
import type { NoteWeather } from "../../types";

const WEATHER_ATTR = "data-weather";

export interface WeatherLabelData {
  city: string;
  temperature: number;
  icon: string;
  unit: "C" | "F";
}

export function formatWeatherLabel(weather: WeatherLabelData): string {
  const temp = `${weather.temperature}°${weather.unit}`;
  if (weather.city) {
    return `${weather.city}, ${temp} ${weather.icon}`;
  }
  return `${temp} ${weather.icon}`;
}

export function formatDailyWeatherLabel(weather: DailyWeatherData): string {
  return formatWeatherLabel({
    city: weather.city,
    temperature: Math.round((weather.temperatureLow + weather.temperatureHigh) / 2),
    icon: weather.icon,
    unit: weather.unit,
  });
}

export function formatNoteWeatherLabel(weather: NoteWeather): string {
  return formatWeatherLabel(weather);
}

export function clearWeatherFromEditor(editor: HTMLElement): boolean {
  const hrs = editor.querySelectorAll<HTMLHRElement>(`hr[${WEATHER_ATTR}]`);
  if (hrs.length === 0) return false;
  hrs.forEach((hr) => {
    hr.removeAttribute(WEATHER_ATTR);
  });
  return true;
}
