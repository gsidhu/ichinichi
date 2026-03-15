import { type ReactNode, useMemo } from "react";
import { ServiceContext } from "./serviceContext";
import { noteContentStore } from "../stores/noteContentStore";

interface ServiceProviderProps {
  children: ReactNode;
}

export function ServiceProvider({
  children,
}: ServiceProviderProps) {
  const value = useMemo(
    () => ({
      noteContentStore,
    }),
    [],
  );

  return (
    <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>
  );
}
