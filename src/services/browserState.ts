function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function clearIndexedDb(): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const indexedDbWithDatabases = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  if (typeof indexedDbWithDatabases.databases !== "function") {
    return;
  }

  const databases = await indexedDbWithDatabases.databases();
  await Promise.all(
    databases
      .map((database) => database.name)
      .filter((name): name is string => Boolean(name))
      .map((name) => deleteDatabase(name)),
  );
}

async function clearCaches(): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
}

async function unregisterServiceWorkers(): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

export async function clearStoredAppState(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.clear();
  sessionStorage.clear();

  await Promise.allSettled([
    clearIndexedDb(),
    clearCaches(),
    unregisterServiceWorkers(),
  ]);
}
