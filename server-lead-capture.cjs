#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;

const missing = (key) => { throw new Error(`Missing env var: ${key}`); };

const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || missing("TELEGRAM_BOT_TOKEN"),
  telegramChatId: process.env.TELEGRAM_CHAT_ID || missing("TELEGRAM_CHAT_ID"),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_API_KEY || missing("TWILIO_ACCOUNT_SID"),
    authToken: process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET || missing("TWILIO_AUTH_TOKEN"),
    fromNumber: process.env.TWILIO_FROM_NUMBER || "whatsapp:+14155238886",
    toNumber: process.env.TWILIO_TO_NUMBER || missing("TWILIO_TO_NUMBER"),
  },
};

const LANDING_PATH = path.join(__dirname, "public", "index.html");

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
  const { accountSid, authToken, fromNumber, toNumber } = config.twilio;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ From: fromNumber, To: `whatsapp:${toNumber}`, Body: body }),
    });
    const result = await response.text();
    if (!response.ok) { console.error("WhatsApp error:", result); return false; }
    return true;
  } catch (err) { console.error("WhatsApp exception:", err); return false; }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "POST" && url.pathname === "/api/leads") {
    let body = "";
    for await (const chunk of req) { body += chunk; }

    try {
      const lead = JSON.parse(body);
      const msg = `NUEVO LEAD\nNombre: ${lead.name}\nEmail: ${lead.email}\nWhatsApp: ${lead.whatsapp}\nNicho: ${lead.niche || "general"}`;
      await sendTelegram(msg);
      await sendWhatsApp(`Nuevo lead: ${lead.name} - ${lead.whatsapp}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request" }));
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    try {
      const html = fs.readFileSync(LANDING_PATH, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (e) {
      res.writeHead(500);
      res.end("Landing page not found");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
