import { z } from "zod";

export const incomingContainerSchema = z.object({
  id: z.string(),
  container: z.string(),
  eta: z.string(),
  status: z.string(),
});

export const incomingItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  sku_var: z.string().nullable(),
  product_name: z.string(),
  qty_pieces: z.number(),
  eta: z.string(),
  container: z.string(),
  status: z.string(),
});
