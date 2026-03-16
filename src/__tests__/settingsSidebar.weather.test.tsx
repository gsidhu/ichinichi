// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsSidebar } from "../components/SettingsSidebar/SettingsSidebar";

const setManualWeather = vi.fn();
const refreshLocation = vi.fn();
const setShowWeather = vi.fn();
const setUnitPreference = vi.fn();

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/contexts/weatherContext", () => ({
  useWeatherContext: () => ({
    state: {
      showWeather: true,
      unitPreference: "C",
      resolvedUnit: "C",
      locationLabel: "Tokyo",
      locationKind: "manual",
      manualTemp: 20,
      manualIcon: "☀️",
      isPromptOpen: false,
      dailyWeather: null,
      noteWeather: {
        city: "Tokyo",
        temperature: 20,
        icon: "☀️",
        unit: "C",
      },
    },
    setShowWeather,
    setUnitPreference,
    setManualWeather,
    refreshLocation,
    clearWeatherFromEditor: vi.fn(),
    dismissPrecisePrompt: vi.fn(),
    fetchDailyWeather: vi.fn(),
    displayWeather: null,
  }),
}));

describe("SettingsSidebar weather confirmation", () => {
  beforeEach(() => {
    setManualWeather.mockReset();
    refreshLocation.mockReset();
    setShowWeather.mockReset();
    setUnitPreference.mockReset();
  });

  it("only updates manual weather after confirm", () => {
    render(
      <SettingsSidebar
        open
        onOpenChange={vi.fn()}
        isSignedIn={false}
        commitHash="abc123"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("City name"), {
      target: { value: "Kyoto" },
    });
    fireEvent.change(screen.getByPlaceholderText("Temp"), {
      target: { value: "17" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "🌧️" },
    });

    expect(setManualWeather).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm weather" }));

    expect(setManualWeather).toHaveBeenCalledWith("Kyoto", 17, "🌧️");
  });
});
