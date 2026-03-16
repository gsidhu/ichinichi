import { useState, useCallback, useEffect } from "react";
import {
  User,
  LogOut,
  LogIn,
  Moon,
  Sun,
  Monitor,
  MapPin,
  LocateFixed,
  X,
  Edit2,
  Check,
  Thermometer,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { ThemePreference } from "@/services/themePreferences";
import { getWeekdayOptions, setWeekStartPreference } from "@/utils/date";
import { useWeatherContext } from "@/contexts/weatherContext";
import styles from "./SettingsSidebar.module.css";

interface SettingsSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail?: string | null;
  isSignedIn: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
  commitHash: string;
  onOpenAbout?: () => void;
  onOpenPrivacy?: () => void;
  onWeekStartChange?: () => void;
}

type WeatherState = ReturnType<typeof useWeatherContext>["state"];

function SettingsHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>Settings</h2>
      <button
        className={styles.closeButton}
        type="button"
        onClick={onClose}
        aria-label="Close settings"
      >
        <X className={styles.closeIcon} />
      </button>
    </div>
  );
}

function UserSection({
  userEmail,
  onSignOut,
}: {
  userEmail: string;
  onSignOut?: () => void;
}) {
  return (
    <>
      <div className={styles.userRow}>
        <div className={styles.avatar}>
          <User className={styles.avatarIcon} />
        </div>
        <div className={styles.userInfo}>
          <p className={styles.userEmail}>{userEmail}</p>
          <p className={styles.userStatus}>Signed in</p>
        </div>
      </div>

      {onSignOut && (
        <button
          className={`${styles.actionButton} ${styles.actionButtonDanger}`}
          type="button"
          onClick={onSignOut}
        >
          <LogOut className={styles.actionIcon} />
          Sign out
        </button>
      )}

      <div className={styles.separator} />
    </>
  );
}

function SignInSection({ onSignIn }: { onSignIn: () => void }) {
  return (
    <>
      <button
        className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
        type="button"
        onClick={onSignIn}
      >
        <LogIn className={styles.actionIcon} />
        Sign in to sync
      </button>

      <div className={styles.separator} />
    </>
  );
}

function AppearanceSection({
  theme,
  onThemeChange,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLabel}>Appearance</p>
      <div className={styles.segmentedControl}>
        <button
          className={styles.segmentButton}
          type="button"
          data-active={theme === "dark"}
          onClick={() => onThemeChange("dark")}
        >
          <Moon className={styles.segmentIcon} />
          Dark
        </button>
        <button
          className={styles.segmentButton}
          type="button"
          data-active={theme === "light"}
          onClick={() => onThemeChange("light")}
        >
          <Sun className={styles.segmentIcon} />
          Light
        </button>
        {/* <button
          className={styles.segmentButton}
          type="button"
          data-active={theme === "system"}
          onClick={() => onThemeChange("system")}
        >
          <Monitor className={styles.segmentIcon} />
          Auto
        </button> */}
      </div>
    </div>
  );
}

function CalendarSection({
  weekStart,
  onWeekStartChange,
}: {
  weekStart: number;
  onWeekStartChange: (dayIndex: number) => void;
}) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLabel}>Calendar</p>
      <div className={styles.toggleRow}>
        <span className={styles.rowLabel}>Week starts on</span>
        <div className={styles.unitToggle}>
          <button
            className={styles.unitButton}
            type="button"
            data-active={weekStart === 0}
            onClick={() => onWeekStartChange(0)}
          >
            Sun
          </button>
          <button
            className={styles.unitButton}
            type="button"
            data-active={weekStart === 1}
            onClick={() => onWeekStartChange(1)}
          >
            Mon
          </button>
        </div>
      </div>
    </div>
  );
}

function WeatherSection({
  weatherState,
  isRefreshing,
  onRefreshLocation,
  onTempUnitChange,
  onShowWeatherChange,
  onManualWeatherChange,
}: {
  weatherState: WeatherState;
  isRefreshing: boolean;
  onRefreshLocation: () => void;
  onTempUnitChange: (unit: "auto" | "C" | "F") => void;
  onShowWeatherChange: (next: boolean) => void;
  onManualWeatherChange: (city: string | null, temp: number | null, icon: string) => void;
}) {
  const showWeather = weatherState.showWeather;
  const isManual = weatherState.locationKind === "manual";
  const [manualCity, setManualCity] = useState(weatherState.locationLabel || "");
  const [manualTemp, setManualTemp] = useState(weatherState.manualTemp?.toString() || "");
  const [manualIcon, setManualIcon] = useState(weatherState.manualIcon || "☀️");

  const handleSaveManual = () => {
    const temp = parseFloat(manualTemp);
    onManualWeatherChange(manualCity, isNaN(temp) ? null : temp, manualIcon);
  };

  return (
    <div className={styles.section}>
      <p className={styles.sectionLabel}>Weather</p>
      
      <div className={styles.segmentedControl}>
        <button
          className={styles.segmentButton}
          type="button"
          data-active={!isManual}
          onClick={() => {
            if (isManual) onRefreshLocation();
          }}
        >
          <LocateFixed className={styles.segmentIcon} />
          Auto
        </button>
        <button
          className={styles.segmentButton}
          type="button"
          data-active={isManual}
          onClick={() => {
            if (!isManual) onManualWeatherChange(manualCity || "Custom", parseFloat(manualTemp) || 0, manualIcon);
          }}
        >
          <Edit2 className={styles.segmentIcon} />
          Manual
        </button>
      </div>

      {!isManual ? (
        <div className={styles.locationRow}>
          <div className={styles.locationField}>
            <MapPin className={styles.locationIcon} />
            <span className={styles.locationText} aria-busy={isRefreshing}>
              {isRefreshing
                ? "Updating location…"
                : weatherState.locationLabel || "Location unavailable"}
            </span>
          </div>
          <button
            className={styles.iconButton}
            type="button"
            onClick={onRefreshLocation}
            disabled={isRefreshing}
            aria-label="Use current location"
          >
            <LocateFixed className={styles.refreshIcon} />
          </button>
        </div>
      ) : (
        <div className={styles.manualSection}>
          <div className={styles.inputGroup}>
            <MapPin className={styles.inputIcon} />
            <input
              className={styles.textInput}
              type="text"
              placeholder="City name"
              value={manualCity}
              onChange={(e) => setManualCity(e.target.value)}
              onBlur={handleSaveManual}
            />
          </div>
          <div className={styles.inputRow}>
            <div className={styles.inputGroup} style={{ flex: 1 }}>
              <Thermometer className={styles.inputIcon} />
              <input
                className={styles.textInput}
                type="number"
                placeholder="Temp"
                value={manualTemp}
                onChange={(e) => setManualTemp(e.target.value)}
                onBlur={handleSaveManual}
              />
            </div>
            <select
              className={styles.iconSelect}
              value={manualIcon}
              onChange={(e) => {
                setManualIcon(e.target.value);
                const temp = parseFloat(manualTemp);
                onManualWeatherChange(manualCity, isNaN(temp) ? null : temp, e.target.value);
              }}
            >
              <option value="☀️">☀️ Sun</option>
              <option value="🌤️">🌤️ Partial</option>
              <option value="⛅">⛅ Clouds</option>
              <option value="☁️">☁️ Overcast</option>
              <option value="🌧️">🌧️ Rain</option>
              <option value="🌨️">🌨️ Snow</option>
              <option value="⛈️">⛈️ Storm</option>
              <option value="🌫️">🌫️ Fog</option>
              <option value="🌡️">🌡️ Other</option>
            </select>
          </div>
        </div>
      )}

      <div className={styles.toggleRow}>
        <span className={styles.rowLabel}>Temperature unit</span>
        <div className={styles.unitToggle}>
          <button
            className={styles.unitButton}
            type="button"
            data-active={
              weatherState.unitPreference === "C" ||
              (weatherState.unitPreference === "auto" &&
                weatherState.resolvedUnit === "C")
            }
            onClick={() => onTempUnitChange("C")}
          >
            °C
          </button>
          <button
            className={styles.unitButton}
            type="button"
            data-active={
              weatherState.unitPreference === "F" ||
              (weatherState.unitPreference === "auto" &&
                weatherState.resolvedUnit === "F")
            }
            onClick={() => onTempUnitChange("F")}
          >
            °F
          </button>
        </div>
      </div>

      <div className={styles.toggleRow}>
        <span className={styles.rowLabel}>Show weather</span>
        <button
          className={styles.switch}
          type="button"
          role="switch"
          aria-checked={showWeather}
          data-checked={showWeather}
          onClick={() => onShowWeatherChange(!showWeather)}
        >
          <span className={styles.switchThumb} />
        </button>
      </div>
    </div>
  );
}

export function SettingsSidebar({
  open,
  onOpenChange,
  userEmail,
  isSignedIn,
  onSignIn,
  onSignOut,
  onWeekStartChange,
}: SettingsSidebarProps) {
  const { theme, setTheme } = useTheme();
  const weather = useWeatherContext();
  const { state: weatherState } = weather;
  const [weekStart, setWeekStart] = useState(
    () => getWeekdayOptions()[0]?.dayIndex ?? 0,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  const handleThemeChange = useCallback(
    (newTheme: ThemePreference) => {
      setTheme(newTheme);
    },
    [setTheme],
  );

  const handleShowWeatherChange = useCallback(
    (checked: boolean) => {
      weather.setShowWeather(checked);
    },
    [weather],
  );

  const handleTempUnitChange = useCallback(
    (unit: "auto" | "C" | "F") => {
      weather.setUnitPreference(unit);
    },
    [weather],
  );

  const handleWeekStartChange = useCallback(
    (dayIndex: number) => {
      setWeekStartPreference(dayIndex);
      setWeekStart(dayIndex);
      onWeekStartChange?.();
    },
    [onWeekStartChange],
  );

  const handleRefreshLocation = useCallback(async () => {
    const start = performance.now();
    setIsRefreshing(true);
    await weather.refreshLocation();
    const elapsed = performance.now() - start;
    if (elapsed < 300) {
      await new Promise((resolve) => setTimeout(resolve, 300 - elapsed));
    }
    setIsRefreshing(false);
  }, [weather]);

  return (
    <div className={styles.root} data-open={open ? "true" : "false"}>
      {open && (
        <button
          className={styles.overlay}
          type="button"
          aria-label="Close settings"
          onClick={() => onOpenChange(false)}
        />
      )}
      <aside
        className={styles.panel}
        data-open={open ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        aria-hidden={!open}
      >
        <SettingsHeader onClose={() => onOpenChange(false)} />

        <div className={styles.body}>
          {isSignedIn && userEmail ? (
            <UserSection userEmail={userEmail} onSignOut={onSignOut} />
          ) : onSignIn ? (
            <SignInSection onSignIn={onSignIn} />
          ) : null}

          <AppearanceSection theme={theme} onThemeChange={handleThemeChange} />

          <div className={styles.separator} />

          <CalendarSection
            weekStart={weekStart}
            onWeekStartChange={handleWeekStartChange}
          />

          <div className={styles.separator} />

          <WeatherSection
            weatherState={weatherState}
            isRefreshing={isRefreshing}
            onRefreshLocation={handleRefreshLocation}
            onTempUnitChange={handleTempUnitChange}
            onShowWeatherChange={handleShowWeatherChange}
            onManualWeatherChange={weather.setManualWeather}
          />

          <div className={styles.separator} />
        </div>
      </aside>
    </div>
  );
}
