import { useLayoutEffect, useSyncExternalStore } from "react";
import App from "../App";
import { Calendar } from "./Calendar";
import { ServiceProvider } from "../contexts/ServiceProvider";
import { useAccessGate } from "../controllers/useAccessGate";
import { PasswordGate } from "./PasswordGate";

interface AppBootstrapProps {
  shouldHydrate: boolean;
  year: number;
  now: Date;
}

type Listener = () => void;

const hydrationStore = (() => {
  let hydrated = false;
  const listeners = new Set<Listener>();

  return {
    getSnapshot: () => hydrated,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    markHydrated: () => {
      if (hydrated) {
        return;
      }
      hydrated = true;
      listeners.forEach((listener) => listener());
    },
  };
})();

export function AppBootstrap({ shouldHydrate, year, now }: AppBootstrapProps) {
  const hydrated = useSyncExternalStore(
    hydrationStore.subscribe,
    hydrationStore.getSnapshot,
    hydrationStore.getSnapshot,
  );
  const accessGate = useAccessGate();

  useLayoutEffect(() => {
    if (shouldHydrate) {
      hydrationStore.markHydrated();
    }
  }, [shouldHydrate]);

  if (shouldHydrate && !hydrated) {
    return (
      <Calendar
        year={year}
        hasNote={() => false}
        onYearChange={() => {}}
        now={now}
      />
    );
  }

  return (
    <ServiceProvider>
      {accessGate.isAuthenticated ? <App onLogout={accessGate.logout} /> : null}
      {!accessGate.isAuthenticated ? (
        <PasswordGate
          state={accessGate.state}
          onPasswordChange={accessGate.setPassword}
          onRememberMeChange={accessGate.setRememberMe}
          onSubmit={accessGate.submit}
        />
      ) : null}
    </ServiceProvider>
  );
}
