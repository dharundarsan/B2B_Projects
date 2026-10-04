import { createContext, useContext } from "react";
import type { useApiResource } from "../../hooks/useApiResource";
import type {
  CommunityContext,
  CommunityData,
} from "../../../../../shared/community";
import type { ManagementModule } from "./management";
type Workspace = {
  context: ReturnType<typeof useApiResource<CommunityContext | null>>;
  resource: ReturnType<typeof useApiResource<CommunityData | null>>;
  selected: string;
  section: string;
  modules: ManagementModule[];
  go: (section: string, tab?: string) => void;
};
export const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceShell is required");
  return value;
}
