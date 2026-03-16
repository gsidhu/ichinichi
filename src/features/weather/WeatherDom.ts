import type { DailyWeatherData } from "./WeatherRepository";

const WEATHER_ATTR = "data-weather";

export function formatDailyWeatherLabel(weather: DailyWeatherData): string {
  const avgTemp = Math.round((weather.temperatureLow + weather.temperatureHigh)/2)
  let temp = `${avgTemp}°${weather.unit}`;
  if (weather.city) {
    return `${weather.city}, ${temp} ${weather.icon}`;
  }
  return `${temp} ${weather.icon}`;
}

export function clearWeatherFromEditor(editor: HTMLElement): boolean {
  const hrs = editor.querySelectorAll<HTMLHRElement>(`hr[${WEATHER_ATTR}]`);
  if (hrs.length === 0) return false;
  hrs.forEach((hr) => {
    hr.removeAttribute(WEATHER_ATTR);
  });
  return true;
}
