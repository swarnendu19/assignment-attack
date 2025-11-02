// lib/validators.ts
import { z } from "zod";

export const sendPayloadSchema = z.object({
  channel: z.enum(["SMS", "WHATSAPP", "EMAIL", "X", "FACEBOOK"]),
  to: z.string(),
  from: z.string().optional(),
  text: z.string().optional(),
  media: z.array(z.string()).optional(),
  teamId: z.string().optional(),
  contactId: z.string().optional(),
  scheduledFor: z.string().optional(),
});
