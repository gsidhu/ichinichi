import { createContext, useContext } from "react";
import type { NoteContentStore } from "../stores/noteContentStore";

export interface ServiceContextValue {
  noteContentStore: NoteContentStore;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

export function useServiceContext(): ServiceContextValue {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error("useServiceContext must be used within ServiceProvider");
  }
  return context;
}

export { ServiceContext };
