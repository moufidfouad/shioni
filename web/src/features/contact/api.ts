import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { ContactMessage } from "@/types";


export interface ContactMessagePayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function useSendContactMessageMutation() {
  return useMutation({
    mutationFn: async (payload: ContactMessagePayload) => (await api.post("/public/contact", payload)).data,
  });
}


export const adminContactMessagesKeys = {
  list: () => ["admin-contact-messages"] as const,
};

export function useAdminContactMessagesQuery() {
  return useQuery({
    queryKey: adminContactMessagesKeys.list(),
    queryFn: async ({ signal }) => (await api.get<ContactMessage[]>("/admin/contact-messages", { signal })).data,
  });
}
