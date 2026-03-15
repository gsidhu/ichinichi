import { useUrlState } from "../hooks/useUrlState";
import { useNoteRepository } from "../hooks/useNoteRepository";

export function useAppController() {
  const routing = useUrlState();
  const { date, year } = routing;
  const activeNoteDate = date;

  const notes = useNoteRepository({
    date: activeNoteDate,
    year,
  });

  return {
    routing,
    notes,
  };
}
