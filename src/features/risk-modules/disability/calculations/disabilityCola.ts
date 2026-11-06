export type DisabilityColaMethod = "fixed" | "cpi"

export const DEFAULT_DISABILITY_COLA_RATE = 0.03
export const DEFAULT_COLA_REMOVED_PREMIUM_REDUCTION_RATE = 0.20

export interface DisabilityColaTerms {
  /** Fixed annual increase, expressed as a decimal (3% = 0.03). */
  colaRate?: number
  /** Uses the CPI change instead of colaRate when set to "cpi". */
  colaMethod?: DisabilityColaMethod
  cpiCurrent?: number
  cpiPrevious?: number
  /** Optional maximum annual increase, expressed as a decimal. */
  colaAnnualCap?: number
  /** Anniversary on which the first increase occurs. Defaults to 1. */
  colaFirstAdjustmentYear?: number
  /** Premium reduction modeled when COLA is removed (20% = 0.20). */
  colaRemovedPremiumReductionRate?: number
}

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0
}

/**
 * Resolves the policy's annual COLA rate.
 * Default advisor behavior assumes the entered individual DI benefit and premium
 * already include COLA. A deliberate colaRate of 0 models removing COLA.
 */
export function resolveDisabilityColaRate(terms: DisabilityColaTerms): number {
  let rate = terms.colaRate === undefined ? DEFAULT_DISABILITY_COLA_RATE : finiteNonNegative(terms.colaRate)

  if (terms.colaMethod === "cpi") {
    const current = Number(terms.cpiCurrent)
    const previous = Number(terms.cpiPrevious)
    rate = Number.isFinite(current) && Number.isFinite(previous) && previous > 0
      ? Math.max(0, (current - previous) / previous)
      : 0
  }

  if (terms.colaAnnualCap !== undefined && Number.isFinite(terms.colaAnnualCap)) {
    rate = Math.min(rate, finiteNonNegative(terms.colaAnnualCap))
  }

  return rate
}

/** Resolves the assumed premium discount when modeling a policy without COLA. */
export function resolveColaRemovedPremiumReductionRate(terms: DisabilityColaTerms): number {
  const rate = terms.colaRemovedPremiumReductionRate
  return Number.isFinite(rate)
    ? Math.min(1, Math.max(0, Number(rate)))
    : DEFAULT_COLA_REMOVED_PREMIUM_REDUCTION_RATE
}

/** Applies the COLA premium assumption consistently across disability views. */
export function disabilityPremiumFactor(terms: DisabilityColaTerms): number {
  return resolveDisabilityColaRate(terms) > 0
    ? 1
    : 1 - resolveColaRemovedPremiumReductionRate(terms)
}

/**
 * Returns the compound benefit factor after a number of completed benefit months.
 * The default first increase occurs only after 12 consecutive benefit months.
 */
export function disabilityColaFactor(
  completedBenefitMonths: number,
  terms: DisabilityColaTerms,
): number {
  const completedAnniversaries = Math.floor(Math.max(0, completedBenefitMonths) / 12)
  const firstAdjustmentYear = Math.max(1, Math.floor(terms.colaFirstAdjustmentYear ?? 1))
  const adjustmentCount = Math.max(0, completedAnniversaries - firstAdjustmentYear + 1)
  return Math.pow(1 + resolveDisabilityColaRate(terms), adjustmentCount)
}
