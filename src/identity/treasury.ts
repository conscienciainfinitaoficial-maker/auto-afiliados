import type { ConwayClient, AutomatonIdentity, AutomatonConfig, AutomatonDatabase, TreasuryPolicy } from "../types.js";
import { DEFAULT_TREASURY_POLICY } from "../types.js";
import { createLogger } from "../observability/logger.js";
import { notifyProfitSweep } from "./notifications.js";

const logger = createLogger("treasury");

export interface SweepResult {
  swept: boolean;
  masterAmountCents: number;
  retainedAmountCents: number;
  masterWalletAddress: string;
  error?: string;
}

export interface TreasuryState {
  masterWalletAddress: string;
  totalEarnedCents: number;
  totalSweptToMasterCents: number;
  totalRetainedCents: number;
  lastSweepAt: string | null;
  sweepCount: number;
}

/**
 * Check if a profit sweep is due based on the sweep interval.
 */
export function isSweepDue(db: AutomatonDatabase, policy: TreasuryPolicy): boolean {
  const intervalHours = policy.sweepIntervalHours || 12;
  const lastSweep = db.getKV("treasury_last_sweep");
  if (!lastSweep) return true;

  const elapsed = Date.now() - new Date(lastSweep).getTime();
  return elapsed >= intervalHours * 3600000;
}

/**
 * Execute a profit sweep: transfer 80% to master wallet, retain 20% for infra.
 * Uses Conway credit transfer API.
 */
export async function executeProfitSweep(
  conway: ConwayClient,
  identity: AutomatonIdentity,
  db: AutomatonDatabase,
  policy: TreasuryPolicy,
): Promise<SweepResult> {
  const masterWallet = policy.masterWalletAddress || db.getKV("master_wallet_address");
  const masterSplit = policy.masterSplitRatio ?? 0.80;
  const selfMaintenance = policy.selfMaintenanceRatio ?? 0.20;

  if (!masterWallet) {
    return {
      swept: false,
      masterAmountCents: 0,
      retainedAmountCents: 0,
      masterWalletAddress: "",
      error: "No master wallet configured. Set masterWalletAddress in config or run setup.",
    };
  }

  try {
    const creditsCents = await conway.getCreditsBalance();
    const minimumReserve = policy.minimumReserveCents || 100;

    if (creditsCents <= minimumReserve) {
      return {
        swept: false,
        masterAmountCents: 0,
        retainedAmountCents: 0,
        masterWalletAddress: masterWallet,
        error: `Balance too low for sweep: ${creditsCents} cents (minimum reserve: ${minimumReserve} cents)`,
      };
    }

    const sweepableAmount = creditsCents - minimumReserve;
    const masterAmountCents = Math.floor(sweepableAmount * masterSplit);
    const retainedAmountCents = sweepableAmount - masterAmountCents;

    if (masterAmountCents <= 0) {
      return {
        swept: false,
        masterAmountCents: 0,
        retainedAmountCents: 0,
        masterWalletAddress: masterWallet,
        error: "Sweep amount too small after split calculation",
      };
    }

    const result = await conway.transferCredits(masterWallet, masterAmountCents, "profit_sweep");

    // Record sweep in DB
    const sweepRecord = {
      timestamp: new Date().toISOString(),
      masterAmountCents,
      retainedAmountCents,
      masterWallet,
      transferId: result.transferId,
      balanceAfterCents: result.balanceAfterCents ?? creditsCents - masterAmountCents,
    };
    db.setKV("treasury_last_sweep", sweepRecord.timestamp);
    db.setKV("treasury_last_sweep_record", JSON.stringify(sweepRecord));

    // Track cumulative totals
    const prevSwept = parseInt(db.getKV("treasury_total_swept_cents") || "0", 10);
    const prevRetained = parseInt(db.getKV("treasury_total_retained_cents") || "0", 10);
    db.setKV("treasury_total_swept_cents", String(prevSwept + masterAmountCents));
    db.setKV("treasury_total_retained_cents", String(prevRetained + retainedAmountCents));

    const sweepCount = parseInt(db.getKV("treasury_sweep_count") || "0", 10);
    db.setKV("treasury_sweep_count", String(sweepCount + 1));

    logger.info(
      `Profit sweep: $${(masterAmountCents / 100).toFixed(2)} to master (${masterWallet}), ` +
      `$${(retainedAmountCents / 100).toFixed(2)} retained for infra`
    );

    // Send Telegram notification
    notifyProfitSweep(
      masterAmountCents / 100,
      masterWallet,
      retainedAmountCents / 100
    ).catch((err) => logger.error("Failed to send notification", err));

    return {
      swept: true,
      masterAmountCents,
      retainedAmountCents,
      masterWalletAddress: masterWallet,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logger.error("Profit sweep failed", err instanceof Error ? err : undefined);
    return {
      swept: false,
      masterAmountCents: 0,
      retainedAmountCents: 0,
      masterWalletAddress: masterWallet,
      error: errorMsg,
    };
  }
}

/**
 * Get the current treasury state from stored data.
 */
export function getTreasuryState(db: AutomatonDatabase, policy: TreasuryPolicy): TreasuryState {
  const masterWallet = policy.masterWalletAddress || db.getKV("master_wallet_address") || "";
  return {
    masterWalletAddress: masterWallet,
    totalEarnedCents: parseInt(db.getKV("treasury_total_earned_cents") || "0", 10),
    totalSweptToMasterCents: parseInt(db.getKV("treasury_total_swept_cents") || "0", 10),
    totalRetainedCents: parseInt(db.getKV("treasury_total_retained_cents") || "0", 10),
    lastSweepAt: db.getKV("treasury_last_sweep") || null,
    sweepCount: parseInt(db.getKV("treasury_sweep_count") || "0", 10),
  };
}

/**
 * Record income earned so it's tracked for sweep calculations.
 */
export function recordIncome(db: AutomatonDatabase, amountCents: number, source: string): void {
  const total = parseInt(db.getKV("treasury_total_earned_cents") || "0", 10);
  db.setKV("treasury_total_earned_cents", String(total + amountCents));
  db.setKV("treasury_last_income", JSON.stringify({
    amountCents,
    source,
    timestamp: new Date().toISOString(),
  }));
}
