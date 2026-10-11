import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchMe,
  loginRequest,
  logoutRequest,
  registerRequest,
} from "@/features/auth/api";
import { ME_KEY } from "@/lib/queryClient";
import { AuthContext } from "./context";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const navigate = useNavigate();

  // La session vit dans un cookie httpOnly côté backend — le frontend ne
  // sait pas d'avance s'il existe (il n'a pas le droit de le lire). Au
  // montage, on interroge donc systématiquement /auth/me ; le navigateur
  // envoie le cookie tout seul s'il est présent. L'échec (401, pas de
  // session) est attrapé par `fetchMe` et transformé en `null` plutôt que de
  // laisser React Query dans un état d'erreur — un visiteur non connecté
  // n'est pas une erreur.
  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({
      identifier,
      password,
    }: {
      identifier: string;
      password: string;
    }) => loginRequest(identifier, password),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  });

  const registerMutation = useMutation({
    mutationFn: ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName: string;
    }) => registerRequest(email, password, fullName),
    onSuccess: (user) => queryClient.setQueryData(ME_KEY, user),
  });

  async function login(identifier: string, password: string) {
    await loginMutation.mutateAsync({ identifier, password });
  }

  async function register(email: string, password: string, fullName: string) {
    await registerMutation.mutateAsync({ email, password, fullName });
  }

  async function logout() {
    await logoutRequest();
    // Toutes les données en cache (écoles, élèves, matières...) appartiennent
    // à la session qui vient de se terminer : on vide tout le cache React
    // Query plutôt que de risquer de les montrer au prochain utilisateur qui
    // se connecterait dans le même onglet.
    queryClient.clear();
    queryClient.setQueryData(ME_KEY, null);
    toast.success("Vous avez été déconnecté.");
    navigate("/login", { replace: true });
  }

  return (
    <AuthContext.Provider
      value={{
        user: meQuery.data ?? null,
        loading: meQuery.isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
