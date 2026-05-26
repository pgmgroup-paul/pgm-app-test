import { z } from "zod";

export const orderReadySchema = z.object({
  id: z.string(),
  shipment: z.string(),
  order: z.string(),
  customer: z.string(),
  ship_date: z.string(), // ISO or display date string
});

export type OrderReady = z.infer<typeof orderReadySchema>;
