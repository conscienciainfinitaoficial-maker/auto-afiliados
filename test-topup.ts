import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { topupCredits } from "./src/conway/topup.js";

async function main() {
  const walletJson = JSON.parse(readFileSync("/home/mdemaestri/.automaton/wallet.json", "utf-8"));
  const account = privateKeyToAccount(walletJson.privateKey);
  console.log("Account:", account.address);
  
  const result = await topupCredits("https://api.conway.tech", account, 5);
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
