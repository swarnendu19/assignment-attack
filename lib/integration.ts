// lib/integrations.ts
import Twilio from "twilio";
import clientPrisma from "./prisma";
import { Channel } from "@prisma/client";

type SendPayload = {
  channel: Channel | string;
  to: string;
  from?: string;
  text?: string;
  media?: string[];
  teamId?: string;
  contactId?: string;
};

export async function createSenderForTeam(teamId: string | undefined) {
  // load integrations for the team and return a factory that selects based on channel
  let integrations: any[] = [];
  if (teamId) {
    integrations = await clientPrisma.integration.findMany({
      where: { teamId, active: true },
    });
  }

  function getIntegration(provider: string) {
    return integrations.find((i) => i.provider === provider);
  }

  return {
    async send(payload: SendPayload) {
      const channel = payload.channel.toString();

      if (channel === "SMS" || channel === "WHATSAPP") {
        const tw = getIntegration("twilio");
        if (!tw) throw new Error("No Twilio integration configured for team");

        const { accountSid, authToken, fromNumber, whatsappFrom } = tw.config;
        const twClient = Twilio(accountSid, authToken);

        const fromNumberToUse =
          channel === "WHATSAPP" ? whatsappFrom ?? fromNumber : fromNumber;

        const opts: any = {
          body: payload.text,
          from: fromNumberToUse,
          to: payload.to,
        };
        if (payload.media?.length) opts.mediaUrl = payload.media;
        const msg = await twClient.messages.create(opts);
        return { provider: "twilio", result: msg };
      }

      if (channel === "EMAIL") {
        const r = getIntegration("resend");
        // Example: you would integrate with Resend or Nodemailer
        if (!r) throw new Error("No email integration configured for team");
        // pseudo: send via fetch to Resend
        // TODO: implement
        return { provider: "resend", result: { ok: true } };
      }

      // For social channels we return stubs for now
      if (channel === "X" || channel === "FACEBOOK") {
        // TODO: use provider configs
        return { provider: channel, result: { ok: true } };
      }

      throw new Error(`Unsupported channel: ${channel}`);
    },
  };
}
