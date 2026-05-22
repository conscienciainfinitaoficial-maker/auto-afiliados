const leads = [];

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
    if (!res.ok) return `worker error: ${(await res.json()).error}`;
    return "ok";
  } catch (err) { return `worker exception: ${err.message}`; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      leads,
      total: leads.length,
      today: leads.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length,
      lastUpdate: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    validateConfig();
    const { name, email, whatsapp, niche, product } = req.body || {};
    if (!name || !email || !whatsapp) {
      return res.status(400).json({ error: "Missing required fields: name, email, whatsapp" });
    }

    const lead = { name, email, whatsapp, niche: niche || "general", product: product || "N/A", timestamp: new Date().toISOString() };
    leads.push(lead);

    const msg = `NUEVO LEAD\nProducto: ${lead.product}\nNombre: ${name}\nEmail: ${email}\nWhatsApp: ${whatsapp}\nNicho: ${lead.niche}`;
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
