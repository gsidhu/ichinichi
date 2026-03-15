import { useState, useEffect, useCallback, useRef } from "react";
import { getTodayString, isFuture, parseDate } from "../utils/date";
import { ViewType } from "../types";
import {
  resolveUrlState,
  serializeUrlState,
  setViewPreference,
} from "../utils/urlState";
import { INTRO_SEEN_KEY } from "../utils/constants";

function shouldShowIntro(search: string): boolean {
  if (typeof window === "undefined") return false;
  const hasParams = new URLSearchParams(search).toString().length > 0;
  if (hasParams) return false;
  return localStorage.getItem(INTRO_SEEN_KEY) !== "1";
}

export function useUrlState() {
  const initialShowIntro =
    typeof window === "undefined"
      ? false
      : shouldShowIntro(window.location.search);
  const [state, setState] = useState(() => {
    // SSR-safe: check if window is available
    if (typeof window === "undefined") {
      return {
        view: ViewType.Calendar,
        date: null,
        year: new Date().getFullYear(),
      };
    }
    const resolved = resolveUrlState(window.location.search);
    if (initialShowIntro) {
      return {
        view: ViewType.Calendar,
        date: null,
        year: resolved.state.year,
      };
    }
    return resolved.state;
  });
  const stateRef = useRef(state);
  const [showIntro, setShowIntro] = useState(initialShowIntro);
  const skippedRedirectRef = useRef(initialShowIntro);

  // Track if we're gated to skip initial redirect
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Handle browser back/forward navigation
  useEffect(() => {
    // SSR-safe
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      setState(resolveUrlState(window.location.search).state);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Handle initial redirect if needed
  useEffect(() => {
    // SSR-safe
    if (typeof window === "undefined") return;

    const resolved = resolveUrlState(window.location.search);
    if (resolved.needsRedirect && !showIntro && !skippedRedirectRef.current) {
      window.history.replaceState({}, "", resolved.canonicalSearch);
    }
  }, [showIntro]);

  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(INTRO_SEEN_KEY, "1");
    }
  }, []);

  const navigateToDate = useCallback((date: string) => {
    if (typeof window === "undefined") return;
    if (isFuture(date)) return;

    const parsed = parseDate(date);
    const year = parsed?.getFullYear() ?? new Date().getFullYear();
    const nextState = {
      view: ViewType.Day,
      date,
      year,
    };
    setViewPreference("day");
    window.history.pushState({}, "", serializeUrlState(nextState));
    setState(nextState);
  }, []);

  const startWriting = useCallback(() => {
    dismissIntro();
    navigateToDate(getTodayString());
  }, [dismissIntro, navigateToDate]);

  const navigateToCalendar = useCallback(
    (year?: number) => {
      if (typeof window === "undefined") return;
      const targetYear = year ?? stateRef.current.year ?? new Date().getFullYear();
      const nextState = {
        view: ViewType.Calendar,
        date: null,
        year: targetYear,
      };
      setViewPreference("year");
      window.history.pushState({}, "", serializeUrlState(nextState));
      setState(nextState);
    },
    [],
  );

  const navigateBackToCalendar = useCallback(() => {
    navigateToCalendar(stateRef.current.year);
  }, [navigateToCalendar]);

  const navigateToYear = useCallback((year: number) => {
    if (typeof window === "undefined") return;
    const nextState = {
      view: ViewType.Calendar,
      date: null,
      year,
    };
    setViewPreference("year");
    window.history.pushState({}, "", serializeUrlState(nextState));
    setState(nextState);
  }, []);

  return {
    ...state,
    showIntro,
    dismissIntro,
    startWriting,
    navigateToDate,
    navigateToCalendar,
    navigateBackToCalendar,
    navigateToYear,
  };
}

export type RoutingState = ReturnType<typeof useUrlState>;
