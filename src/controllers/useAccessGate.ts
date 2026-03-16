import { useCallback, useEffect, useReducer } from "react";
import { SESSION_EXPIRED_EVENT } from "../services/apiClient";
import {
  getSessionStatus,
  logoutSession,
  verifyPassword,
} from "../services/sessionAuth";
import { clearStoredAppState } from "../services/browserState";

export type AccessGatePhase =
  | "checking"
  | "locked"
  | "verifying"
  | "authenticated"
  | "loggingOut";

export interface AccessGateState {
  phase: AccessGatePhase;
  password: string;
  rememberMe: boolean;
  error: string | null;
}

type AccessGateAction =
  | { type: "SESSION_VALID" }
  | { type: "SESSION_MISSING" }
  | { type: "PASSWORD_CHANGED"; value: string }
  | { type: "REMEMBER_ME_CHANGED"; value: boolean }
  | { type: "SUBMIT" }
  | { type: "VERIFY_FAILED"; message: string }
  | { type: "LOGOUT" }
  | { type: "LOGOUT_COMPLETE" }
  | { type: "LOGOUT_FAILED"; message: string };

export function createInitialAccessGateState(): AccessGateState {
  return {
    phase: "checking",
    password: "",
    rememberMe: true,
    error: null,
  };
}

export function accessGateReducer(
  state: AccessGateState,
  action: AccessGateAction,
): AccessGateState {
  switch (action.type) {
    case "SESSION_VALID":
      return {
        ...state,
        phase: "authenticated",
        password: "",
        error: null,
      };
    case "SESSION_MISSING":
      return {
        phase: "locked",
        password: "",
        rememberMe: state.rememberMe,
        error: null,
      };
    case "PASSWORD_CHANGED":
      return {
        ...state,
        password: action.value,
        error: null,
      };
    case "REMEMBER_ME_CHANGED":
      return {
        ...state,
        rememberMe: action.value,
      };
    case "SUBMIT":
      return {
        ...state,
        phase: "verifying",
        error: null,
      };
    case "VERIFY_FAILED":
      return {
        ...state,
        phase: "locked",
        password: "",
        error: action.message,
      };
    case "LOGOUT":
      return {
        ...state,
        phase: "loggingOut",
        error: null,
      };
    case "LOGOUT_COMPLETE":
      return {
        phase: "locked",
        password: "",
        rememberMe: state.rememberMe,
        error: null,
      };
    case "LOGOUT_FAILED":
      return {
        ...state,
        phase: "authenticated",
        error: action.message,
      };
    default:
      return state;
  }
}

export function useAccessGate() {
  const [state, dispatch] = useReducer(
    accessGateReducer,
    undefined,
    createInitialAccessGateState,
  );

  useEffect(() => {
    if (state.phase !== "checking") {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const authenticated = await getSessionStatus();
        if (cancelled) {
          return;
        }
        dispatch({ type: authenticated ? "SESSION_VALID" : "SESSION_MISSING" });
      } catch {
        if (cancelled) {
          return;
        }
        dispatch({ type: "SESSION_MISSING" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "verifying") {
      return;
    }

    let cancelled = false;
    const { password, rememberMe } = state;

    void (async () => {
      try {
        const authenticated = await verifyPassword(password, rememberMe);
        if (cancelled) {
          return;
        }
        if (authenticated) {
          dispatch({ type: "SESSION_VALID" });
          return;
        }
        dispatch({ type: "VERIFY_FAILED", message: "Incorrect password." });
      } catch {
        if (cancelled) {
          return;
        }
        dispatch({
          type: "VERIFY_FAILED",
          message: "Could not verify password. Try again.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => {
    if (state.phase !== "loggingOut") {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await logoutSession();
        await clearStoredAppState();
        if (cancelled) {
          return;
        }
        dispatch({ type: "LOGOUT_COMPLETE" });
      } catch {
        if (cancelled) {
          return;
        }
        dispatch({
          type: "LOGOUT_FAILED",
          message: "Could not log out. Try again.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.phase]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleSessionExpired = () => {
      dispatch({ type: "SESSION_MISSING" });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const setPassword = useCallback((value: string) => {
    dispatch({ type: "PASSWORD_CHANGED", value });
  }, []);

  const setRememberMe = useCallback((value: boolean) => {
    dispatch({ type: "REMEMBER_ME_CHANGED", value });
  }, []);

  const submit = useCallback(() => {
    if (!state.password.trim() || state.phase !== "locked") {
      return;
    }
    dispatch({ type: "SUBMIT" });
  }, [state.password, state.phase]);

  const logout = useCallback(() => {
    if (state.phase !== "authenticated") {
      return;
    }
    dispatch({ type: "LOGOUT" });
  }, [state.phase]);

  return {
    state,
    isAuthenticated: state.phase === "authenticated",
    setPassword,
    setRememberMe,
    submit,
    logout,
  };
}
