const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKeySid: process.env.TWILIO_API_KEY_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET,
    fromNumber: process.env.TWILIO_FROM_NUMBER || "whatsapp:+14155238886",
    toNumber: process.env.TWILIO_TO_NUMBER,
  },
};

function missing(key) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

function validateConfig() {
  missing("TELEGRAM_BOT_TOKEN");
  missing("TELEGRAM_CHAT_ID");
  if (config.twilio.apiKeySid && config.twilio.authToken) {
    missing("TWILIO_ACCOUNT_SID");
    missing("TWILIO_TO_NUMBER");
  }
}

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegramChatId, text: message, parse_mode: "HTML" }),
  });
  if (!res.ok) console.error("Telegram error:", await res.text());
}

async function sendWhatsApp(body) {
  if (!config.twilio.apiKeySid) return "WhatsApp not configured";
  const { accountSid, apiKeySid, authToken, fromNumber, toNumber } = config.twilio;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${apiKeySid}:${authToken}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: fromNumber, To: `whatsapp:${toNumber}`, Body: body }),
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error("WhatsApp error:", response.status, errText);
    return `Twilio error ${response.status}: ${errText.slice(0, 200)}`;
  }
  return "ok";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    validateConfig();
    const { name, email, whatsapp, niche } = req.body || {};
    if (!name || !email || !whatsapp) {
      return res.status(400).json({ error: "Missing required fields: name, email, whatsapp" });
    }

    const message = `NUEVO LEAD\nNombre: ${name}\nEmail: ${email}\nWhatsApp: ${whatsapp}\nNicho: ${niche || "general"}`;
    const [tgResult, waResult] = await Promise.allSettled([
      sendTelegram(message),
      sendWhatsApp(`Nuevo lead: ${name} - ${whatsapp}`),
    ]);

    return res.status(200).json({
      success: true,
      telegram: tgResult.status === "fulfilled" ? "ok" : tgResult.reason?.message,
      whatsapp: waResult.status === "fulfilled" ? waResult.value : waResult.reason?.message,
    });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
