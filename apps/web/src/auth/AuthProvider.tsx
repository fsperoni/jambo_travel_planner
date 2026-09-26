import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { login as loginRequest } from "../api/auth.api";
import { configureAuthHandlers } from "../api/http";
import type { AuthenticatedUser } from "../api/types";
import { AuthContext, type AuthContextValue } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // The access token lives in a ref, not just state: http.ts reads it from
  // a plain function call (configureAuthHandlers' getAccessToken), which
  // needs the *current* value on every call, not the value captured by
  // whichever render happened to register the closure. React state alone
  // would mean re-registering that closure on every token change just to
  // avoid a stale read; a ref sidesteps that entirely. State still holds
  // `user` (not the token) because that's what the component tree actually
  // renders from, and it's `user`, not the raw token, that the UI cares
  // about.
  const accessTokenRef = useRef<string | null>(null);

  const logout = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
  }, []);

  // Registered once, on mount — not on every token change — since the
  // getter closes over the ref (always current) rather than the token
  // value itself.
  useEffect(() => {
    configureAuthHandlers({
      getAccessToken: () => accessTokenRef.current,
      onUnauthorized: () => {
        accessTokenRef.current = null;
        setUser(null);
        setIsSessionExpired(true);
      },
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    accessTokenRef.current = result.accessToken;
    setUser(result.user);
    setIsSessionExpired(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isSessionExpired,
      login,
      logout,
    }),
    [user, isSessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
