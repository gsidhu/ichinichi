import type { Clock } from "../domain/runtime/clock";
import type { Connectivity } from "../domain/runtime/connectivity";

export const runtimeConnectivity: Connectivity = {
  isOnline: () => true, // Local-first is always online to its DB
};

export const runtimeClock: Clock = {
  now: () => new Date(),
};
