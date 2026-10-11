import { z } from "zod";

export const paymentTrackingQuerySchema = z.object({
  schoolYearId: z.string().uuid(),
  groupeId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type PaymentTrackingQuery = z.infer<typeof paymentTrackingQuerySchema>;
