import { create } from "zustand";
import {
  extractErrorMessage,
  fetchMe,
  loginRequest,
  logoutRequest,
  registerRequest,
} from "../api/auth";
import { unregisterPushToken } from "../api/pushTokens";
import { isNetworkError } from "../api/client";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "../api/tokenStorage";
import {
  clearCachedUser,
  clearStoredPushToken,
  getCachedUser,
  getStoredPushToken,
  setCachedUser,
} from "../lib/storage";
import { AuthUser } from "../types";

type AuthStatus = "booting" | "signedOut" | "signedIn";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "booting",
  user: null,
  error: null,


  async bootstrap() {
    const token = await getAccessToken();
    if (!token) {
      set({ status: "signedOut" });
      return;
    }
    try {
      const user = await fetchMe();
      setCachedUser(user);
      set({ status: "signedIn", user });
    } catch (err) {
      const cachedUser = getCachedUser<AuthUser>();
      if (isNetworkError(err) && cachedUser) {
        set({ status: "signedIn", user: cachedUser });
        return;
      }
      // Refresh token lui-même expiré/révoqué, ou compte désactivé — aucune
      // session récupérable, on efface tout ce qui reste en SecureStore.
      await clearTokens();
      clearCachedUser();
      set({ status: "signedOut" });
    }
  },

  async login(identifier, password) {
    set({ error: null });
    try {
      const result = await loginRequest(identifier, password);
      await setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setCachedUser(result.user);
      set({ status: "signedIn", user: result.user });
    } catch (err) {
      set({ error: extractLoginError(err) });
      throw err;
    }
  },

  async register(email, password, fullName) {
    set({ error: null });
    try {
      const result = await registerRequest(email, password, fullName);
      await setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setCachedUser(result.user);
      set({ status: "signedIn", user: result.user });
    } catch (err) {
      set({ error: extractLoginError(err) });
      throw err;
    }
  },

  async logout() {
    const refreshToken = await getRefreshToken();

    try {
      await logoutRequest(refreshToken);
    } catch {
      // Ignoré volontairement.
    }

    const pushToken = getStoredPushToken();
    if (pushToken) {
      try {
        await unregisterPushToken(pushToken);
      } catch {
        // Ignoré volontairement.
      }
      clearStoredPushToken();
    }
    await clearTokens();
    clearCachedUser();
    set({ status: "signedOut", user: null });
  },
}));

function extractLoginError(err: unknown): string {
  return extractErrorMessage(
    err,
    "Identifiants invalides ou serveur injoignable.",
  );
}
