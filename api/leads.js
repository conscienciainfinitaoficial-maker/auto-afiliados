const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  waWorkerUrl: process.env.WA_WORKER_URL,
  waSecret: process.env.WA_SECRET || "auto-afiliados-2026",
};

function missing(key) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

function validateConfig() {
  missing("TELEGRAM_BOT_TOKEN");
  missing("TELEGRAM_CHAT_ID");
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

async function sendWhatsApp(body, phone) {
  if (!config.waWorkerUrl) return "no worker configured";

  try {
    const res = await fetch(config.waWorkerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, message: body, secret: config.waSecret }),
    });
    const data = await res.json();
    if (!res.ok) return `worker error: ${data.error}`;
    return "ok";
  } catch (err) {
    return `worker exception: ${err.message}`;
  }
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

    const msg = `NUEVO LEAD\nNombre: ${name}\nEmail: ${email}\nWhatsApp: ${whatsapp}\nNicho: ${niche || "general"}`;
    const [tg, wa] = await Promise.allSettled([
      sendTelegram(msg),
      sendWhatsApp(`🎯 Nuevo lead: ${name} - ${whatsapp}`, whatsapp),
    ]);

    return res.status(200).json({
      success: true,
      telegram: tg.status === "fulfilled" ? "ok" : "error",
      whatsapp: wa.status === "fulfilled" ? wa.value : "error",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
