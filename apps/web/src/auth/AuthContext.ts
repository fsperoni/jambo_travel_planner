import { createContext, useContext } from "react";
import type { AuthenticatedUser } from "../api/types";

export interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  /** True after a previously-valid session was rejected by the server
   *  (token expired), as opposed to never having logged in — lets the
   *  login screen show "please sign in again" instead of a blank form. */
  isSessionExpired: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
}

// Split out from AuthProvider.tsx (rather than co-located, the more common
// pattern) so that file only exports a component — Vite's Fast Refresh
// only hot-reloads files that exclusively export components, and mixing in
// a hook here would silently downgrade AuthProvider.tsx edits to a full
// page reload during development.
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() must be called within an AuthProvider");
  }
  return context;
}
