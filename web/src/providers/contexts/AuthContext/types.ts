import { AuthUser } from "@/types";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;

  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}