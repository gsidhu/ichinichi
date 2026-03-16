import { useCallback, useEffect, useState } from "react";
import { Calendar } from "./components/Calendar";
import { DayView } from "./components/Calendar/DayView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { SettingsSidebar } from "./components/SettingsSidebar";
import { SearchOverlay } from "./components/Search";
import { usePWA } from "./hooks/usePWA";
import { useAppController } from "./controllers/useAppController";
import { NoteRepositoryProvider } from "./contexts/NoteRepositoryProvider";
import { RoutingProvider } from "./contexts/RoutingProvider";
import { WeatherProvider } from "./contexts/WeatherProvider";
import { getTodayString, parseDate } from "./utils/date";

function getLatestNoteInMonth(
  noteDates: Set<string>,
  year: number,
  month: number,
): string | null {
  const notesInMonth: string[] = [];

  for (const dateStr of noteDates) {
    const parsed = parseDate(dateStr);
    if (parsed && parsed.getFullYear() === year && parsed.getMonth() === month) {
      notesInMonth.push(dateStr);
    }
  }

  notesInMonth.sort((a, b) => {
    const dateA = parseDate(a);
    const dateB = parseDate(b);
    if (!dateA || !dateB) return 0;
    return dateA.getTime() - dateB.getTime();
  });

  return notesInMonth.at(-1) ?? null;
}

interface AppProps {
  onLogout: () => void;
}

function App({ onLogout }: AppProps) {
  const { routing, notes } = useAppController();
  const { needRefresh, updateServiceWorker, dismissUpdate } = usePWA();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [weekStartVersion, setWeekStartVersion] = useState(0);

  const { date, year, navigateToDate, navigateToYear, navigateToCalendar } =
    routing;

  const isDayView = date !== null;
  const commitHash = __COMMIT_HASH__;

  const handleReturnToYear = useCallback(() => {
    navigateToCalendar(year);
  }, [navigateToCalendar, year]);

  const handleCalendarMonthClick = useCallback(
    (targetYear: number, targetMonth: number) => {
      const latestNote = getLatestNoteInMonth(notes.noteDates, targetYear, targetMonth);
      if (!latestNote) return;
      navigateToDate(latestNote);
    },
    [notes.noteDates, navigateToDate],
  );

  const handleDayViewMonthChange = useCallback(
    (targetYear: number, targetMonth: number) => {
      const now = new Date();
      const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === now.getMonth();

      if (isCurrentMonth) {
        navigateToDate(getTodayString());
        return;
      }

      const latestNote = getLatestNoteInMonth(notes.noteDates, targetYear, targetMonth);
      if (!latestNote) return;
      navigateToDate(latestNote);
    },
    [notes.noteDates, navigateToDate],
  );

  const handleMenuClick = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleSearchClick = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const handleWeekStartChange = useCallback(() => {
    setWeekStartVersion((value) => value + 1);
  }, []);

  // ⌘K / Ctrl+K global shortcut to open search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transition");
    });
  }, []);

  return (
    <RoutingProvider value={routing}>
      <NoteRepositoryProvider value={notes}>
        <WeatherProvider>
          <ErrorBoundary
            fullScreen
            title="Ichinichi ran into a problem"
            description="Refresh the app to continue, or try again to recover."
            resetLabel="Reload app"
            onReset={() => window.location.reload()}
          >
            {isDayView && date ? (
              <DayView
                weekStartVersion={weekStartVersion}
                date={date}
                noteDates={notes.noteDates}
                hasNote={notes.hasNote}
                onDayClick={navigateToDate}
                onMonthChange={handleDayViewMonthChange}
                onReturnToYear={handleReturnToYear}
                content={notes.content}
                onChange={notes.setContent}
                hasEdits={notes.hasEdits}
                isSaving={notes.isSaving}
                lastSavedAt={notes.lastSavedAt}
                isDecrypting={notes.isDecrypting}
                isContentReady={notes.isContentReady}
                isOfflineStub={notes.isOfflineStub}
                noteError={notes.noteError}
                onMenuClick={handleMenuClick}
                onSearchClick={handleSearchClick}
              />
            ) : (
              <Calendar
                weekStartVersion={weekStartVersion}
                year={year}
                hasNote={notes.hasNote}
                onDayClick={navigateToDate}
                onYearChange={navigateToYear}
                onMonthClick={handleCalendarMonthClick}
                onMenuClick={handleMenuClick}
                onSearchClick={handleSearchClick}
              />
            )}

            <SearchOverlay
              open={searchOpen}
              onClose={handleSearchClose}
              onSelectDate={navigateToDate}
              repository={notes.repository}
              noteDates={notes.noteDates}
            />

            <SettingsSidebar
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              isSignedIn={false}
              commitHash={commitHash}
              onWeekStartChange={handleWeekStartChange}
              onLogout={onLogout}
            />

            {needRefresh && (
              <UpdatePrompt onUpdate={updateServiceWorker} onDismiss={dismissUpdate} />
            )}
          </ErrorBoundary>
        </WeatherProvider>
      </NoteRepositoryProvider>
    </RoutingProvider>
  );
}

export default App;
