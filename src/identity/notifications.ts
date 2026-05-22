import { createLogger } from "../observability/logger.js";

const logger = createLogger("notifications");

const TELEGRAM_API = "https://api.telegram.org/bot";

export interface NotificationConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
}

let config: NotificationConfig = {};

export function setNotificationConfig(cfg: NotificationConfig): void {
  config = cfg;
  logger.info("Notification config updated");
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!config.telegramBotToken || !config.telegramChatId) {
    logger.warn("Telegram not configured, skipping notification");
    return false;
  }

  const url = `${TELEGRAM_API}${config.telegramBotToken}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`Telegram send failed: ${response.status} - ${error}`);
      return false;
    }

    logger.info("Telegram notification sent successfully");
    return true;
  } catch (err) {
    logger.error("Telegram notification error", err instanceof Error ? err : undefined);
    return false;
  }
}

export async function notifyProfitSweep(
  amountUsd: number,
  masterWallet: string,
  retainedUsd: number
): Promise<void> {
  const message = `
💰 <b>PROFIT SWEEP EJECUTADO</b>

✅ Enviado a tu wallet: <b>$${amountUsd.toFixed(2)}</b>
🏠 Wallet: <code>${masterWallet.slice(0, 6)}...${masterWallet.slice(-4)}</code>
💼 Retenido (infra): $${retainedUsd.toFixed(2)}
⏰ Hora: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
`.trim();

  await sendTelegramMessage(message);
}

export async function notifyLowCompute(balanceUsd: number): Promise<void> {
  const message = `
⚠️ <b>COMPUTE BAJO</b>

💰 Balance: <b>$${balanceUsd.toFixed(2)}</b>
🔄 Modo: LOW_COMPUTE activo
⏰ Hora: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
`.trim();

  await sendTelegramMessage(message);
}

export async function notifyCritical(balanceUsd: number): Promise<void> {
  const message = `
🚨 <b>CRÍTICO - COMPUTE AGOTÁNDOSE</b>

💰 Balance: <b>$${balanceUsd.toFixed(2)}</b>
🛑 Acción: Modo supervivencia activo
⏰ Hora: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
`.trim();

  await sendTelegramMessage(message);
}

export async function notifyError(error: string, context: string): Promise<void> {
  const message = `
❌ <b>ERROR - ${context}</b>

${error}
⏰ Hora: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
`.trim();

  await sendTelegramMessage(message);
}

export async function notifyStartup(): Promise<void> {
  const message = `
🤖 <b>AUTO-AFILIADOS INICIADO</b>

✅ Bot funcionando
⏰ Hora: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
`.trim();

  await sendTelegramMessage(message);
}