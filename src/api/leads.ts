import { createLogger } from "../observability/logger.js";
import { sendTelegramMessage } from "../identity/notifications.js";

const logger = createLogger("leads-api");

export interface Lead {
  name: string;
  email: string;
  whatsapp: string;
  niche: string;
  timestamp: string;
}

export interface WhatsAppConfig {
  provider: "twilio";
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toNumber: string;
}

let whatsappConfig: WhatsAppConfig | null = null;

export function setWhatsAppConfig(config: WhatsAppConfig): void {
  whatsappConfig = config;
  logger.info("WhatsApp config initialized");
}

export async function sendWhatsAppMessage(body: string): Promise<boolean> {
  if (!whatsappConfig) {
    logger.warn("WhatsApp not configured");
    return false;
  }

  const { accountSid, authToken, fromNumber, toNumber } = whatsappConfig;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`WhatsApp send failed: ${response.status} - ${error}`);
      return false;
    }

    logger.info("WhatsApp message sent successfully");
    return true;
  } catch (err) {
    logger.error("WhatsApp error", err instanceof Error ? err : undefined);
    return false;
  }
}

export async function processNewLead(lead: Lead): Promise<void> {
  logger.info(`Processing new lead: ${lead.email}`);

  const message = `
🎯 NUEVO LEAD CAPTURADO

👤 Nombre: ${lead.name}
📧 Email: ${lead.email}
📱 WhatsApp: ${lead.whatsapp}
🎯 Nicho: ${lead.niche}
⏰ Hora: ${new Date().toLocaleString("es-AR")}
`.trim();

  await sendTelegramMessage(message);

  if (whatsappConfig) {
    await sendWhatsAppMessage(`🎯 Nuevo lead: ${lead.name} (${lead.niche}) - ${lead.whatsapp}`);
  }
}

export function parseIncomingLead(body: any): Lead | null {
  try {
    const { name, email, whatsapp, niche } = body;
    if (!name || !email || !whatsapp) {
      return null;
    }
    return {
      name,
      email,
      whatsapp,
      niche: niche || "general",
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}