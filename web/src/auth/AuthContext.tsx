import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api/resources.ts";
import { probeCapabilities, NO_CAPABILITIES, type Capabilities } from "./capabilities.ts";

export interface Session {
  readonly userId: string;
  readonly companyId: string;
  readonly expiresAt: string;
  readonly capabilities: Capabilities;
}

export interface AuthContextValue {
  readonly session: Session | null;
  readonly isAuthenticated: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

// Exported so tests can mount a provider with a preset session (role-gated nav, screens).
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const result = await authApi.login(email, password);
    // The cookie is now set; probe role-gated endpoints to derive nav capabilities.
    const capabilities = await probeCapabilities();
    setSession({
      userId: result.userId,
      companyId: result.companyId,
      expiresAt: result.expiresAt,
      capabilities,
    });
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAuthenticated: session !== null, login, logout }),
    [session, login, logout],
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
