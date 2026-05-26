import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { topupCredits } from "./src/conway/topup.js";

async function main() {
  const walletPath = process.env.AUTOMATON_WALLET_PATH || join(homedir(), ".automaton", "wallet.json");

  if (!existsSync(walletPath)) {
    console.error(`Wallet not found at ${walletPath}. Set AUTOMATON_WALLET_PATH env var or place wallet at default location.`);
    process.exit(1);
  }

  let walletJson;
  try {
    walletJson = JSON.parse(readFileSync(walletPath, "utf-8"));
  } catch (err) {
    console.error(`Failed to read wallet at ${walletPath}:`, err.message);
    process.exit(1);
  }

  if (!walletJson.privateKey) {
    console.error("Wallet file does not contain a privateKey field");
    process.exit(1);
  }

  const account = privateKeyToAccount(walletJson.privateKey);
  console.log("Account:", account.address);

  const apiUrl = process.env.CONWAY_API_URL || "https://api.conway.tech";
  const result = await topupCredits(apiUrl, account, 5);
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
