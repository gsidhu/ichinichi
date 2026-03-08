import { useCallback, useMemo } from "react";
import { getTodayString } from "../utils/date";
import {
  getNavigableDates,
  getPreviousDate,
  getNextDate,
} from "../utils/noteNavigation";

interface UseMonthViewStateProps {
  date: string;
  noteDates: Set<string>;
  navigateToDate: (date: string) => void;
}

export function useMonthViewState({
  date,
  noteDates,
  navigateToDate,
}: UseMonthViewStateProps) {
  const navigableDates = useMemo(
    () => getNavigableDates(noteDates, getTodayString()),
    [noteDates],
  );

  const previousDate = getPreviousDate(date, navigableDates);
  const nextDate = getNextDate(date, navigableDates);

  const selectPreviousNote = useCallback(() => {
    if (previousDate) {
      navigateToDate(previousDate);
    }
  }, [previousDate, navigateToDate]);

  const selectNextNote = useCallback(() => {
    if (nextDate) {
      navigateToDate(nextDate);
    }
  }, [nextDate, navigateToDate]);

  return {
    selectedDate: date,
    selectPreviousNote,
    selectNextNote,
    canSelectPrevious: previousDate !== null,
    canSelectNext: nextDate !== null,
  };
}
