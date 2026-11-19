/**
 * SEP-41 Amount Formatter
 *
 * Safe formatting of atomic amounts (integers) into human-readable decimal strings
 * using BigInt for lossless arithmetic. No floating-point operations.
 *
 * Atomic amounts are in the smallest unit of an asset (e.g., stroops for USDC with 6 decimals).
 * Decimals define the decimal point position: 10^decimals converts atomic to display amount.
 *
 * Example:
 * - Atomic: 1234567, Decimals: 6 → Formatted: 1.234567
 * - Atomic: 500000, Decimals: 6 → Formatted: 0.5
 * - Atomic: 100, Decimals: 0 → Formatted: 100
 */

import { type NetworkId } from "@/config/networks";
import { getNetworkConfig } from "@/config/networks";
import { isValidAtomicAmount } from "@/services/x402/validation";

/**
 * Metadata for an asset required to format amounts.
 */
export type FormattableAsset = {
  contractId: string;
  symbol: string;
  decimals: number;
};

/**
 * Result of successfully formatting an atomic amount.
 */
export type FormattedAmount = {
  /** Formatted amount as a decimal string (e.g., "1.234567") */
  formatted: string;
  /** Original atomic amount (integer string) */
  atomic: string;
  /** Asset symbol */
  symbol: string;
  /** Soroban contract ID */
  contractId: string;
  /** Number of decimals used in formatting */
  decimals: number;
};

/**
 * Validates that decimals are within acceptable bounds.
 * SEP-41 and Stellar limit decimals to 0–7.
 *
 * @param decimals - The decimals value to validate
 * @returns true if decimals are in range [0, 7]
 */
function isValidDecimals(decimals: number): boolean {
  return Number.isInteger(decimals) && decimals >= 0 && decimals <= 7;
}

/**
 * Format an atomic amount into a human-readable decimal string.
 *
 * Uses BigInt arithmetic to avoid floating-point precision loss.
 * Removes trailing zeros from the fractional part for cleaner display.
 *
 * @param atomicAmount - Positive integer string (atomic units)
 * @param asset - Asset metadata (symbol, decimals, contractId)
 * @returns Formatted amount object
 * @throws Error if atomicAmount is invalid or decimals are out of bounds
 *
 * @example
 * const result = formatAtomicAmount("1234567", {
 *   contractId: "CA7QYNF7...",
 *   symbol: "USDC",
 *   decimals: 6
 * });
 * // result: {
 * //   formatted: "1.234567",
 * //   atomic: "1234567",
 * //   symbol: "USDC",
 * //   contractId: "CA7QYNF7...",
 * //   decimals: 6
 * // }
 */
export function formatAtomicAmount(atomicAmount: string, asset: FormattableAsset): FormattedAmount {
  // Validate input: atomicAmount must be a valid positive integer
  if (!isValidAtomicAmount(atomicAmount)) {
    throw new Error(
      `Invalid atomic amount: "${atomicAmount}". Must be a positive integer without leading zeros.`
    );
  }

  // Validate decimals are within bounds
  if (!isValidDecimals(asset.decimals)) {
    throw new Error(`Invalid decimals: ${asset.decimals}. Must be an integer between 0 and 7.`);
  }

  // Use BigInt for safe arithmetic (no precision loss)
  const amount = BigInt(atomicAmount);
  const divisor = BigInt(10 ** asset.decimals);

  // Split into integer and fractional parts
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  // Build fractional string with leading zeros preserved
  let fractionalStr = fractionalPart.toString().padStart(asset.decimals, "0");

  // Trim trailing zeros from fractional part for cleaner display
  fractionalStr = fractionalStr.replace(/0+$/, "");

  // Combine parts
  const formatted =
    fractionalStr.length > 0 ? `${integerPart}.${fractionalStr}` : integerPart.toString();

  return {
    atomic: atomicAmount,
    contractId: asset.contractId,
    decimals: asset.decimals,
    formatted,
    symbol: asset.symbol
  };
}

/**
 * Normalizes a decimal amount string (e.g. "0.0500000") without losing precision.
 *
 * Throws when the value is not a plain non-negative decimal number.
 */
export function normalizeDecimalAmount(value: string): string {
  const parsed = parseDecimalAmount(value);
  return formatScaledAmount(parsed.units, parsed.scale);
}

/**
 * Sums decimal amount strings losslessly using BigInt scaling.
 *
 * Values may use different numbers of decimal places; the result keeps every
 * significant digit and trims only trailing fractional zeros. An empty list
 * sums to "0".
 *
 * @throws Error when any value is not a plain non-negative decimal number
 */
export function sumDecimalAmounts(values: readonly string[]): string {
  const parsed = values.map(parseDecimalAmount);
  if (parsed.length === 0) {
    return "0";
  }

  const scale = parsed.reduce((max, value) => Math.max(max, value.scale), 0);
  const total = parsed.reduce(
    (sum, value) => sum + value.units * 10n ** BigInt(scale - value.scale),
    0n
  );

  return formatScaledAmount(total, scale);
}

function parseDecimalAmount(value: string): { scale: number; units: bigint } {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);

  if (match === null) {
    throw new Error(`Invalid decimal amount: "${value}". Must be a non-negative decimal number.`);
  }

  const whole = match[1] ?? "0";
  const fraction = match[2] ?? "";

  return { scale: fraction.length, units: BigInt(`${whole}${fraction}`) };
}

function formatScaledAmount(units: bigint, scale: number): string {
  if (scale === 0) {
    return units.toString();
  }

  const padded = units.toString().padStart(scale + 1, "0");
  const whole = padded.slice(0, -scale);
  const fraction = padded.slice(-scale).replace(/0+$/, "");

  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

/**
 * Try to format an atomic amount given a contract ID.
 *
 * Looks up asset metadata from the network configuration by contract ID.
 * Returns null if the asset is not found in the network's catalog.
 *
 * This is the safe, fallback-friendly entry point for formatting.
 *
 * @param atomicAmount - Atomic amount string
 * @param contractId - Soroban contract ID to look up
 * @param network - Network ID (testnet or pubnet)
 * @returns FormattedAmount if asset metadata found, null otherwise
 *
 * @example
 * const result = tryFormatAmount(
 *   "1234567",
 *   "CA7QYNF7SOWQ4VJNMGEVXZHYQACUIM2MRRPFNQ4SLRJRYE67Z2BJQXMR",
 *   "stellar:testnet"
 * );
 * // result: FormattedAmount | null
 */
export function tryFormatAmount(
  atomicAmount: string,
  contractId: string,
  network: NetworkId
): FormattedAmount | null {
  // Validate atomic amount format
  if (!isValidAtomicAmount(atomicAmount)) {
    return null;
  }

  // Get network configuration
  const networkConfig = getNetworkConfig(network);

  // Find asset metadata by contract ID
  const asset = networkConfig.assets.find((a) => a.contractId === contractId);

  if (!asset) {
    return null;
  }

  try {
    return formatAtomicAmount(atomicAmount, {
      contractId: asset.contractId,
      decimals: asset.decimals,
      symbol: asset.symbol
    });
  } catch {
    // If formatting fails (e.g., malformed decimals), return null for safe fallback
    return null;
  }
}
