// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { WeatherProvider } from "../contexts/WeatherProvider";
import { NoteRepositoryProvider } from "../contexts/NoteRepositoryProvider";
import { RoutingProvider } from "../contexts/RoutingProvider";
import { useWeatherContext } from "../contexts/weatherContext";
import type { UseNoteRepositoryReturn } from "../hooks/useNoteRepository";
import type { RoutingState } from "../hooks/useUrlState";

const setNoteWeather = vi.fn();
const flushSave = vi.fn().mockResolvedValue(undefined);
const getPreciseLocation = vi.fn();
const getApproxLocation = vi.fn();
const getDailyWeather = vi.fn();

vi.mock("../features/weather/LocationProvider", () => ({
  LocationProvider: class {
    getApproxLocation = getApproxLocation;
    getPreciseLocation = getPreciseLocation;
  },
}));

vi.mock("../features/weather/WeatherRepository", () => ({
  WeatherRepository: class {
    getDailyWeather = getDailyWeather;
  },
}));

function WeatherProbe() {
  const weather = useWeatherContext();

  return (
    <div>
      <button type="button" onClick={() => void weather.refreshLocation()}>
        Refresh
      </button>
      <div data-testid="display-weather">
        {weather.displayWeather ? JSON.stringify(weather.displayWeather) : "null"}
      </div>
    </div>
  );
}

function makeNoteRepositoryValue(): UseNoteRepositoryReturn {
  return {
    repository: {
      get: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      getAllDates: vi.fn(),
      getAllDatesForYear: vi.fn(),
    },
    imageRepository: null,
    capabilities: { canSync: false, canUploadImages: false },
    activeDate: "16-03-2026",
    content: "",
    setContent: vi.fn(),
    noteWeather: null,
    setNoteWeather,
    flushSave,
    hasEdits: false,
    isSaving: false,
    lastSavedAt: null,
    hasNote: vi.fn(() => false),
    noteDates: new Set<string>(),
    refreshNoteDates: vi.fn(),
    isDecrypting: false,
    isContentReady: true,
    isOfflineStub: false,
    noteError: null,
  };
}

function makeRoutingValue(): RoutingState {
  return {
    view: "day",
    date: "16-03-2026",
    year: 2026,
    showIntro: false,
    dismissIntro: vi.fn(),
    startWriting: vi.fn(),
    navigateToDate: vi.fn(),
    navigateToCalendar: vi.fn(),
    navigateBackToCalendar: vi.fn(),
    navigateToYear: vi.fn(),
  };
}

describe("useWeatherFeature persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    setNoteWeather.mockReset();
    flushSave.mockClear();
    getPreciseLocation.mockReset();
    getApproxLocation.mockReset();
    getDailyWeather.mockReset();

    localStorage.setItem("dailynote_show_weather_v1", "true");
    localStorage.setItem("dailynote_location_kind_v1", "approx");
    localStorage.setItem("dailynote_location_lat_v1", "35.68");
    localStorage.setItem("dailynote_location_lon_v1", "139.69");

    getDailyWeather.mockResolvedValue({
      temperatureHigh: 26,
      temperatureLow: 24,
      icon: "☀️",
      city: "Tokyo",
      timestamp: Date.now(),
      unit: "C",
    });
  });

  it("does not persist weather when it auto-fetches for a note", async () => {
    render(
      <RoutingProvider value={makeRoutingValue()}>
        <NoteRepositoryProvider value={makeNoteRepositoryValue()}>
          <WeatherProvider>
            <WeatherProbe />
          </WeatherProvider>
        </NoteRepositoryProvider>
      </RoutingProvider>,
    );

    await waitFor(() => {
      expect(getDailyWeather).toHaveBeenCalled();
    });

    expect(setNoteWeather).not.toHaveBeenCalled();
    expect(flushSave).not.toHaveBeenCalled();
    expect(screen.getByTestId("display-weather").textContent).toBe("null");
  });

  it("does not expose auto-fetched weather as display weather when note has no stored weather", async () => {
    render(
      <RoutingProvider value={makeRoutingValue()}>
        <NoteRepositoryProvider value={makeNoteRepositoryValue()}>
          <WeatherProvider>
            <WeatherProbe />
          </WeatherProvider>
        </NoteRepositoryProvider>
      </RoutingProvider>,
    );

    await waitFor(() => {
      expect(getDailyWeather).toHaveBeenCalled();
    });

    expect(screen.getByTestId("display-weather").textContent).toBe("null");
  });

  it("does not persist weather when location is refreshed", async () => {
    getPreciseLocation.mockResolvedValue({ lat: 40.71, lon: -74.01 });

    render(
      <RoutingProvider value={makeRoutingValue()}>
        <NoteRepositoryProvider value={makeNoteRepositoryValue()}>
          <WeatherProvider>
            <WeatherProbe />
          </WeatherProvider>
        </NoteRepositoryProvider>
      </RoutingProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(getPreciseLocation).toHaveBeenCalled();
    });

    expect(setNoteWeather).not.toHaveBeenCalled();
    expect(flushSave).not.toHaveBeenCalled();
  });
});
