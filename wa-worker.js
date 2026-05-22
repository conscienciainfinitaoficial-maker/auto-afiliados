import http from "http";
import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const PORT = process.env.PORT || 3001;
const SECRET = process.env.WA_SECRET || "auto-afiliados-2026";

let client = null;
let ready = false;

async function initWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    console.log("\n⚠️  ESCANEÁ ESTE QR CON WHATSAPP:\n");
    qrcode.generate(qr, { small: true });
    console.log("\n📱 Abrí WhatsApp → 3 puntitos → Dispositivos vinculados → Vincular dispositivo\n");
  });

  client.on("ready", () => {
    ready = true;
    console.log("✅ WhatsApp conectado! Listo para enviar mensajes.");
  });

  client.on("disconnected", (reason) => {
    ready = false;
    console.log("❌ WhatsApp desconectado:", reason);
  });

  await client.initialize();
}

async function sendMessage(to, body) {
  if (!ready || !client) throw new Error("WhatsApp no conectado");
  const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
  await client.sendMessage(chatId, body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "POST" && url.pathname === "/send") {
    let data = "";
    for await (const chunk of req) data += chunk;

    try {
      const { to, message, secret } = JSON.parse(data);
      if (secret !== SECRET) {
        res.writeHead(403);
        return res.end(JSON.stringify({ error: "Invalid secret" }));
      }
      await sendMessage(to, message);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: ready ? "connected" : "connecting", qr: !ready }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🚀 WhatsApp Worker en http://localhost:${PORT}`);
  initWhatsApp().catch(console.error);
});
