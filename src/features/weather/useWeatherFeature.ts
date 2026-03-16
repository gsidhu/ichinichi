import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { NoteWeather } from "../../types";
import { useNoteRepositoryContext } from "../../contexts/noteRepositoryContext";
import { useRoutingContext } from "../../contexts/routingContext";
import { LocationProvider } from "./LocationProvider";
import { WeatherRepository, type DailyWeatherData } from "./WeatherRepository";
import { clearWeatherFromEditor, type WeatherLabelData } from "./WeatherDom";
import {
  getLocationCoords,
  getLocationKind,
  getLocationLabel,
  getShowWeatherPreference,
  getUnitPreference,
  getManualTemp,
  getManualIcon,
  setLocationCoords,
  setLocationKind,
  setLocationLabel,
  setManualTemp,
  setManualIcon,
  setShowWeatherPreference,
  setUnitPreference,
  type LocationKind,
  type UnitPreference,
} from "./WeatherPreferences";
import { resolveUnitPreference } from "./unit";
import { isToday } from "../../utils/date";

interface WeatherState {
  showWeather: boolean;
  unitPreference: UnitPreference;
  locationLabel: string | null;
  locationKind: LocationKind | null;
  isPromptOpen: boolean;
  dailyWeather: DailyWeatherData | null;
  manualTemp: number | null;
  manualIcon: string;
  noteWeather: NoteWeather | null;
}

type WeatherAction =
  | { type: "SET_SHOW_WEATHER"; value: boolean }
  | { type: "SET_UNIT_PREFERENCE"; value: UnitPreference }
  | {
      type: "SET_LOCATION";
      label: string | null;
      kind: LocationKind | null;
    }
  | { type: "SET_PROMPT_OPEN"; value: boolean }
  | { type: "SET_DAILY_WEATHER"; value: DailyWeatherData | null }
  | { type: "SET_MANUAL_WEATHER"; temp: number | null; icon: string };

function weatherReducer(state: WeatherState, action: WeatherAction): WeatherState {
  switch (action.type) {
    case "SET_SHOW_WEATHER":
      return { ...state, showWeather: action.value };
    case "SET_UNIT_PREFERENCE":
      return { ...state, unitPreference: action.value };
    case "SET_LOCATION":
      return {
        ...state,
        locationLabel: action.label,
        locationKind: action.kind,
      };
    case "SET_PROMPT_OPEN":
      return { ...state, isPromptOpen: action.value };
    case "SET_DAILY_WEATHER":
      return { ...state, dailyWeather: action.value };
    case "SET_MANUAL_WEATHER":
      return { ...state, manualTemp: action.temp, manualIcon: action.icon };
    default:
      return state;
  }
}

function formatApproxLabel(city: string, country: string): string {
  if (!city && !country) return "";
  if (!country) return city;
  if (!city) return country;
  return `${city}, ${country}`;
}

function toWeatherLabelData(weather: DailyWeatherData | NoteWeather): WeatherLabelData {
  if ("temperature" in weather) {
    return weather;
  }

  return {
    city: weather.city,
    temperature: Math.round((weather.temperatureLow + weather.temperatureHigh) / 2),
    icon: weather.icon,
    unit: weather.unit,
  };
}

export function useWeatherFeature() {
  const { date: activeDate } = useRoutingContext();
  const { noteWeather, setNoteWeather, flushSave } = useNoteRepositoryContext();
  const locationProvider = useMemo(() => new LocationProvider(), []);
  const weatherRepository = useMemo(() => new WeatherRepository(), []);

  const [state, dispatch] = useReducer(weatherReducer, undefined, () => ({
    showWeather: getShowWeatherPreference(),
    unitPreference: getUnitPreference(),
    locationLabel: getLocationLabel(),
    locationKind: getLocationKind(),
    isPromptOpen: false,
    dailyWeather: null,
    manualTemp: getManualTemp(),
    manualIcon: getManualIcon(),
    noteWeather: null,
  }));

  const commitLocation = useCallback(
    (label: string | null, kind: LocationKind | null, coords?: { lat: number; lon: number }) => {
      if (label !== state.locationLabel) {
        setLocationLabel(label);
      }
      if (kind !== state.locationKind) {
        setLocationKind(kind);
      }
      if (coords) {
        setLocationCoords(coords.lat, coords.lon);
      }
      if (label !== state.locationLabel || kind !== state.locationKind) {
        dispatch({ type: "SET_LOCATION", label, kind });
      }
    },
    [state.locationKind, state.locationLabel],
  );

  const setShowWeather = useCallback((value: boolean) => {
    setShowWeatherPreference(value);
    dispatch({ type: "SET_SHOW_WEATHER", value });
    if (!value) {
      dispatch({ type: "SET_DAILY_WEATHER", value: null });
    }
  }, []);

  const setUnitPreferenceValue = useCallback((value: UnitPreference) => {
    setUnitPreference(value);
    dispatch({ type: "SET_UNIT_PREFERENCE", value });
  }, []);

  const fetchDailyWeather = useCallback(async () => {
    if (!state.showWeather || !activeDate || !isToday(activeDate)) return;

    if (state.locationKind === "manual") {
      return;
    }

    let lat: number | null = null;
    let lon: number | null = null;

    const stored = getLocationCoords();
    if (stored) {
      lat = stored.lat;
      lon = stored.lon;
    }

    if (lat === null || lon === null) {
      const approx = await locationProvider.getApproxLocation();
      if (!approx) return;
      lat = approx.lat;
      lon = approx.lon;
      const label = formatApproxLabel(approx.city, approx.country);
      commitLocation(label || null, "approx", { lat, lon });
    }

    const weather = await weatherRepository.getDailyWeather(
      lat,
      lon,
      state.unitPreference,
    );
    if (weather) {
      dispatch({ type: "SET_DAILY_WEATHER", value: weather });
    }
  }, [
    activeDate,
    commitLocation,
    locationProvider,
    state.showWeather,
    state.unitPreference,
    state.locationKind,
    weatherRepository,
  ]);

  useEffect(() => {
    if (!activeDate || !state.showWeather) {
      dispatch({ type: "SET_DAILY_WEATHER", value: null });
      return;
    }

    if (state.locationKind === "manual") {
      if (noteWeather) {
        dispatch({
          type: "SET_DAILY_WEATHER",
          value: {
            temperatureHigh: noteWeather.temperature,
            temperatureLow: noteWeather.temperature,
            icon: noteWeather.icon,
            city: noteWeather.city,
            timestamp: Date.now(),
            unit: noteWeather.unit,
          },
        });
      } else if (state.manualTemp !== null) {
        const unit = resolveUnitPreference(state.unitPreference);
        dispatch({
          type: "SET_DAILY_WEATHER",
          value: {
            temperatureHigh: state.manualTemp,
            temperatureLow: state.manualTemp,
            icon: state.manualIcon,
            city: state.locationLabel || "",
            timestamp: Date.now(),
            unit,
          },
        });
      }
      return;
    }

    if (!isToday(activeDate)) {
      dispatch({ type: "SET_DAILY_WEATHER", value: null });
      return;
    }

    void fetchDailyWeather();
  }, [
    activeDate,
    fetchDailyWeather,
    noteWeather,
    state.locationKind,
    state.locationLabel,
    state.manualIcon,
    state.manualTemp,
    state.showWeather,
    state.unitPreference,
  ]);

  const refreshLocation = useCallback(async () => {
    const precise = await locationProvider.getPreciseLocation();
    if (!precise) return;

    const coords = { lat: precise.lat, lon: precise.lon };
    const weather = await weatherRepository.getDailyWeather(
      precise.lat,
      precise.lon,
      state.unitPreference,
    );

    if (weather) {
      dispatch({ type: "SET_DAILY_WEATHER", value: weather });
      const nextLabel = weather.city || state.locationLabel || null;
      commitLocation(nextLabel, "precise", coords);
    } else {
      commitLocation(state.locationLabel, "precise", coords);
    }
  }, [
    commitLocation,
    locationProvider,
    state.locationLabel,
    state.unitPreference,
    weatherRepository,
  ]);

  const dismissPrecisePrompt = useCallback(() => {
    dispatch({ type: "SET_PROMPT_OPEN", value: false });
  }, []);

  const resolvedUnit = resolveUnitPreference(state.unitPreference);
  const displayWeather = noteWeather
    ? toWeatherLabelData(noteWeather)
    : state.dailyWeather
      ? toWeatherLabelData(state.dailyWeather)
      : null;

  return {
    state: {
      ...state,
      noteWeather,
      resolvedUnit,
    },
    setShowWeather,
    setUnitPreference: setUnitPreferenceValue,
    displayWeather,
    setManualWeather: async (
      city: string | null,
      temp: number | null,
      icon: string,
    ) => {
      if (temp === null) {
        return;
      }

      const nextWeather: NoteWeather = {
        city: city ?? "",
        temperature: temp,
        icon,
        unit: resolvedUnit,
      };

      setManualTemp(temp);
      setManualIcon(icon);
      commitLocation(city, "manual");
      dispatch({ type: "SET_MANUAL_WEATHER", temp, icon });
      dispatch({
        type: "SET_DAILY_WEATHER",
        value: {
          temperatureHigh: temp,
          temperatureLow: temp,
          icon,
          city: city ?? "",
          timestamp: Date.now(),
          unit: resolvedUnit,
        },
      });
      if (activeDate) {
        setNoteWeather(nextWeather);
        await flushSave();
      }
    },
    refreshLocation,
    clearWeatherFromEditor,
    dismissPrecisePrompt,
    fetchDailyWeather,
  };
}
