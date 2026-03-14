import { createContext, useContext } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VaultService } from "../domain/vault";
import type { E2eeServiceFactory } from "../domain/crypto/e2eeService";
import type { NoteContentStore } from "../stores/noteContentStore";
import type { SyncStore } from "../stores/syncStore";

export interface ServiceContextValue {
  supabase: SupabaseClient;
  vaultService: VaultService;
  e2eeFactory: E2eeServiceFactory;
  noteContentStore: NoteContentStore;
  syncStore: SyncStore;
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
