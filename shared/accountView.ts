export interface AccountView {
  role: string;
  userContext: 1 | 2 | 3;
  canSwitchContext: boolean;
  revision: number;
  displayName: string;
  email: string;
  availableContexts: (1 | 2 | 3)[];
}
export const viewName = (view: number) => view === 2 ? "Admin" : view === 3 ? "Seller / Provider" : "User";
export const viewHome = (view: number, role?: string) => role === "vendor" ? "/vendor/jobs" : view === 2 ? "/admin" : view === 3 ? "/seller" : "/home";
