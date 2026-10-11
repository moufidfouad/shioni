import { z } from "zod";

export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token requis."),
});

export type MobileRefreshInput = z.infer<typeof mobileRefreshSchema>;
