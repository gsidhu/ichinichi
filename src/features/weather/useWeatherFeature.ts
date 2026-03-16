import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { LocationProvider } from "./LocationProvider";
import { WeatherRepository, type DailyWeatherData } from "./WeatherRepository";
import { clearWeatherFromEditor } from "./WeatherDom";
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

interface WeatherState {
  showWeather: boolean;
  unitPreference: UnitPreference;
  locationLabel: string | null;
  locationKind: LocationKind | null;
  isPromptOpen: boolean;
  dailyWeather: DailyWeatherData | null;
  manualTemp: number | null;
  manualIcon: string;
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

export function useWeatherFeature() {
  const locationProvider = useMemo(() => new LocationProvider(), []);
  const weatherRepository = useMemo(() => new WeatherRepository(), []);
  const fetchedRef = useRef(false);

  const [state, dispatch] = useReducer(weatherReducer, undefined, () => ({
    showWeather: getShowWeatherPreference(),
    unitPreference: getUnitPreference(),
    locationLabel: getLocationLabel(),
    locationKind: getLocationKind(),
    isPromptOpen: false,
    dailyWeather: null,
    manualTemp: getManualTemp(),
    manualIcon: getManualIcon(),
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
    if (!state.showWeather) return;

    if (state.locationKind === "manual") {
      const unit = resolveUnitPreference(state.unitPreference);
      dispatch({
        type: "SET_DAILY_WEATHER",
        value: {
          temperatureHigh: state.manualTemp ?? 0,
          temperatureLow: state.manualTemp ?? 0,
          icon: state.manualIcon,
          city: state.locationLabel || "",
          timestamp: Date.now(),
          unit,
        },
      });
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
    commitLocation,
    locationProvider,
    state.showWeather,
    state.unitPreference,
    state.locationKind,
    state.manualTemp,
    state.manualIcon,
    state.locationLabel,
    weatherRepository,
  ]);

  // Fetch daily weather on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void fetchDailyWeather();
  }, [fetchDailyWeather]);

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
  }, [commitLocation, locationProvider, state.locationLabel, state.unitPreference, weatherRepository]);

  const dismissPrecisePrompt = useCallback(() => {
    dispatch({ type: "SET_PROMPT_OPEN", value: false });
  }, []);

  const resolvedUnit = resolveUnitPreference(state.unitPreference);

  return {
    state: {
      ...state,
      resolvedUnit,
    },
    setShowWeather,
    setUnitPreference: setUnitPreferenceValue,
    setManualWeather: (city: string | null, temp: number | null, icon: string) => {
      setManualTemp(temp);
      setManualIcon(icon);
      commitLocation(city, "manual");
      dispatch({ type: "SET_MANUAL_WEATHER", temp, icon });
    },
    refreshLocation,
    clearWeatherFromEditor,
    dismissPrecisePrompt,
    fetchDailyWeather,
  };
}
