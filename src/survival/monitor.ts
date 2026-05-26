/**
 * Resource Monitor (Affiliate Edition)
 *
 * Continuously monitors resources and triggers survival/campaign transitions.
 * NEVER enters dead state — the affiliate bot runs perpetually.
 * Low compute triggers aggressive campaign mode instead of death.
 */

import type {
  AutomatonConfig,
  AutomatonDatabase,
  ConwayClient,
  AutomatonIdentity,
  FinancialState,
  SurvivalTier,
  TreasuryPolicy,
} from "../types.js";
import { DEFAULT_TREASURY_POLICY } from "../types.js";
import { getSurvivalTier, formatCredits } from "../conway/credits.js";
import { getUsdcBalance } from "../conway/x402.js";
import { isSweepDue, executeProfitSweep } from "../identity/treasury.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("survival");

export type CampaignMode = "normal" | "aggressive" | "emergency";

export interface ResourceStatus {
  financial: FinancialState;
  tier: SurvivalTier;
  previousTier: SurvivalTier | null;
  tierChanged: boolean;
  sandboxHealthy: boolean;
  campaignMode: CampaignMode;
  sweepDue: boolean;
}

/**
 * Check all resources and return current status.
 * Automatically triggers profit sweep if due.
 */
export async function checkResources(
  identity: AutomatonIdentity,
  conway: ConwayClient,
  db: AutomatonDatabase,
  config?: AutomatonConfig,
): Promise<ResourceStatus> {
  let creditsCents = 0;
  try {
    creditsCents = await conway.getCreditsBalance();
  } catch (err) {
    logger.warn("Failed to fetch credits balance", { error: err instanceof Error ? err.message : String(err) });
  }

  let usdcBalance = 0;
  try {
    usdcBalance = await getUsdcBalance(identity.address);
  } catch (err) {
    logger.warn("Failed to fetch USDC balance", { error: err instanceof Error ? err.message : String(err) });
  }

  let sandboxHealthy = true;
  try {
    const result = await conway.exec("echo ok", 5000);
    sandboxHealthy = result.exitCode === 0;
  } catch {
    sandboxHealthy = false;
  }

  const financial: FinancialState = {
    creditsCents,
    usdcBalance,
    lastChecked: new Date().toISOString(),
  };

  const retentionFundCents = getRetentionFundBalance(db);
  const tier = getSurvivalTier(retentionFundCents);
  const prevTierStr = db.getKV("current_tier");
  const previousTier = (prevTierStr as SurvivalTier) || null;
  const tierChanged = previousTier !== null && previousTier !== tier;

  db.setKV("current_tier", tier);
  db.setKV("financial_state", JSON.stringify(financial));

  const campaignMode = getCampaignMode(tier);
  const policy: TreasuryPolicy = { ...DEFAULT_TREASURY_POLICY, ...(config?.treasuryPolicy || {}) };
  const sweepDue = isSweepDue(db, policy);

  // Auto-execute sweep if due and we have funds
  if (sweepDue && creditsCents > (policy.minimumReserveCents || 100) && config) {
    executeProfitSweep(conway, identity, db, policy).catch((err) => {
      logger.error("Auto-sweep failed", err instanceof Error ? err : undefined);
    });
  }

  return {
    financial,
    tier,
    previousTier,
    tierChanged,
    sandboxHealthy,
    campaignMode,
    sweepDue,
  };
}

/**
 * Get the current campaign mode based on survival tier.
 * Normal: standard operations.
 * Aggressive: scale up campaigns, close aggressively.
 * Emergency: pause everything except direct sales.
 */
export function getCampaignMode(tier: SurvivalTier): CampaignMode {
  switch (tier) {
    case "high":
    case "normal":
      return "normal";
    case "low_compute":
      return "aggressive";
    case "critical":
      return "emergency";
    default:
      return "normal";
  }
}

/**
 * Get the retention fund balance from stored data.
 * This is the 20% that was retained from profit sweeps.
 */
export function getRetentionFundBalance(db: AutomatonDatabase): number {
  const retained = parseInt(db.getKV("treasury_total_retained_cents") || "0", 10);
  const currentBalance = parseInt(db.getKV("financial_state")
    ? JSON.parse(db.getKV("financial_state") || "{}").creditsCents || "0"
    : "0", 10);
  // Effective retention = retained credits that are still available
  return Math.min(retained, currentBalance);
}

/**
 * Generate a human-readable resource report with campaign mode.
 */
export function formatResourceReport(status: ResourceStatus): string {
  const lines = [
    `=== RESOURCE STATUS ===`,
    `Credits: ${formatCredits(status.financial.creditsCents)}`,
    `USDC: ${status.financial.usdcBalance.toFixed(6)}`,
    `Tier: ${status.tier}${status.tierChanged ? ` (changed from ${status.previousTier})` : ""}`,
    `Campaign mode: ${status.campaignMode.toUpperCase()}`,
    `Sweep due: ${status.sweepDue ? "YES" : "no"}`,
    `Sandbox: ${status.sandboxHealthy ? "healthy" : "UNHEALTHY"}`,
    `Checked: ${status.financial.lastChecked}`,
    `========================`,
  ];
  return lines.join("\n");
}
