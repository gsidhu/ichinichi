import "fake-indexeddb/auto";
import "@testing-library/react";

if (!globalThis.structuredClone) {
  globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
}
