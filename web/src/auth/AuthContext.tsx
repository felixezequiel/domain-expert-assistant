import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api/resources.ts";
import type { CurrentUser } from "../api/types.ts";
import { capabilitiesForRoles, NO_CAPABILITIES, type Capabilities } from "./capabilities.ts";

export interface Session {
  readonly user: CurrentUser;
  readonly capabilities: Capabilities;
}

export interface AuthContextValue {
  readonly session: Session | null;
  readonly isAuthenticated: boolean;
  // True only during the initial cookie probe on boot, so guards can wait instead of
  // bouncing an already-authenticated user to /login on a hard refresh (finding U3).
  readonly loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

// Exported so tests can mount a provider with a preset session (role-gated nav, screens).
export const AuthContext = createContext<AuthContextValue | null>(null);

function sessionFromUser(user: CurrentUser): Session {
  return { user, capabilities: capabilitiesForRoles(user.roles) };
}

export function AuthProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // On boot the in-memory session is empty but the httpOnly session cookie may still be valid
  // (7-day TTL). Probe /auth/me once to restore it, so a refresh keeps the user signed in.
  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((user) => {
        if (active) {
          setSession(sessionFromUser(user));
        }
      })
      .catch(() => {
        if (active) {
          setSession(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    await authApi.login(email, password);
    const user = await authApi.me();
    setSession(sessionFromUser(user));
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAuthenticated: session !== null, loading, login, logout }),
    [session, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}

export function useCapabilities(): Capabilities {
  const { session } = useAuth();
  return session?.capabilities ?? NO_CAPABILITIES;
}
