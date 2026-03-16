// @vitest-environment jsdom

import { clearStoredAppState } from "../services/browserState";
import {
  accessGateReducer,
  createInitialAccessGateState,
} from "../controllers/useAccessGate";

describe("accessGateReducer", () => {
  it("locks the app when no valid session exists", () => {
    const state = createInitialAccessGateState();
    const next = accessGateReducer(state, { type: "SESSION_MISSING" });

    expect(next).toEqual({
      phase: "locked",
      password: "",
      rememberMe: true,
      error: null,
    });
  });

  it("preserves remember-me choice while verifying", () => {
    const state = {
      phase: "locked",
      password: "hashed-value",
      rememberMe: false,
      error: "Previous error",
    } as const;

    const next = accessGateReducer(state, { type: "SUBMIT" });

    expect(next).toEqual({
      phase: "verifying",
      password: "hashed-value",
      rememberMe: false,
      error: null,
    });
  });

  it("returns to a locked state after logout", () => {
    const next = accessGateReducer(
      {
        phase: "authenticated",
        password: "",
        rememberMe: true,
        error: null,
      },
      { type: "LOGOUT_COMPLETE" },
    );

    expect(next).toEqual({
      phase: "locked",
      password: "",
      rememberMe: true,
      error: null,
    });
  });
});

describe("clearStoredAppState", () => {
  it("clears local and session storage", async () => {
    localStorage.setItem("theme", "dark");
    sessionStorage.setItem("draft", "1");

    await clearStoredAppState();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
