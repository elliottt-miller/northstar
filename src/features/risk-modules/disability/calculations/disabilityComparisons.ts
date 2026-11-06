import type { DisabilityAssumptions, DisabilityOtherAsset } from "../types"
import { disabilityPremiumFactor } from "./disabilityCola"

const TAXABLE_LTD_NET_FACTOR = 0.70

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0
}

export interface JobComparisonInput {
  annualIncome: number
  groupCoveragePercent: number
  groupMonthlyCap: number
  includesIndividualDI: boolean
  individualDIMonthlyPremium: number
  individualDIMonthlyBenefit: number
}

export interface JobComparisonResult {
  annualIncome: number
  annualIncomeAfterPremium: number
  groupLTDAnnualGross: number
  groupLTDAnnualNet: number
  individualDIAnnualBenefit: number
  annualIncomeIfDisabled: number
}

/**
 * Calculates current-year Job A/B values in annual dollars. Taxable Group LTD
 * is reduced after applying its monthly cap; Individual DI remains as entered.
 */
export function calculateJobComparison(
  jobAInput: JobComparisonInput,
  jobBInput: JobComparisonInput,
  ltdTaxable: boolean,
  assumptions: DisabilityAssumptions = { incomeGrowthRateAnnual: 0.03 },
): { jobA: JobComparisonResult; jobB: JobComparisonResult } {
  const premiumFactor = disabilityPremiumFactor(assumptions)

  const calculateJob = (input: JobComparisonInput): JobComparisonResult => {
    const annualIncome = finiteNonNegative(input.annualIncome)
    const coveragePercent = Math.min(100, finiteNonNegative(input.groupCoveragePercent)) / 100
    const monthlyCap = finiteNonNegative(input.groupMonthlyCap)
    const grossGroupBenefit = annualIncome * coveragePercent
    const groupLTDAnnualGross = monthlyCap > 0
      ? Math.min(grossGroupBenefit, monthlyCap * 12)
      : grossGroupBenefit
    const groupLTDAnnualNet = groupLTDAnnualGross * (ltdTaxable ? TAXABLE_LTD_NET_FACTOR : 1)
    const includesIndividualDI = input.includesIndividualDI
    const individualDIMonthlyPremium = includesIndividualDI
      ? finiteNonNegative(input.individualDIMonthlyPremium) * premiumFactor
      : 0
    const individualDIAnnualBenefit = includesIndividualDI
      ? finiteNonNegative(input.individualDIMonthlyBenefit) * 12
      : 0

    return {
      annualIncome,
      annualIncomeAfterPremium: Math.max(0, annualIncome - individualDIMonthlyPremium * 12),
      groupLTDAnnualGross,
      groupLTDAnnualNet,
      individualDIAnnualBenefit,
      annualIncomeIfDisabled: groupLTDAnnualNet + individualDIAnnualBenefit,
    }
  }

  return { jobA: calculateJob(jobAInput), jobB: calculateJob(jobBInput) }
}

export interface AssetComparisonTotals {
  totalAssetValue: number
  annualOtherAssetInsuranceCost: number
  projectedIndividualDIBenefits: number
  annualIncomeInsuranceCost: number
  valueDifference: number
  costDifference: number
  otherCostPerThousand: number | null
  incomeCostPerThousand: number | null
  costRatio: number | null
}

/** Central source for Asset Comparison totals and ratios. */
export function calculateAssetComparisonTotals(
  assets: DisabilityOtherAsset[],
  monthlyIndividualDIPremium: number,
  projectedIndividualDIBenefits: number,
  assumptions: DisabilityAssumptions = { incomeGrowthRateAnnual: 0.03 },
): AssetComparisonTotals {
  const totalAssetValue = assets.reduce((sum, asset) => sum + finiteNonNegative(asset.assetValue), 0)
  const annualOtherAssetInsuranceCost = assets.reduce((sum, asset) => sum + finiteNonNegative(asset.annualPremium), 0)
  const projectedBenefits = finiteNonNegative(projectedIndividualDIBenefits)
  const annualIncomeInsuranceCost = finiteNonNegative(monthlyIndividualDIPremium) * 12 * disabilityPremiumFactor(assumptions)
  const valueDifference = Math.abs(projectedBenefits - totalAssetValue)
  const costDifference = Math.abs(annualOtherAssetInsuranceCost - annualIncomeInsuranceCost)
  const otherCostPerThousand = totalAssetValue > 0
    ? (annualOtherAssetInsuranceCost / totalAssetValue) * 1_000
    : null
  const incomeCostPerThousand = projectedBenefits > 0
    ? (annualIncomeInsuranceCost / projectedBenefits) * 1_000
    : null
  const costRatio = otherCostPerThousand !== null && incomeCostPerThousand !== null && incomeCostPerThousand > 0
    ? otherCostPerThousand / incomeCostPerThousand
    : null

  return {
    totalAssetValue,
    annualOtherAssetInsuranceCost,
    projectedIndividualDIBenefits: projectedBenefits,
    annualIncomeInsuranceCost,
    valueDifference,
    costDifference,
    otherCostPerThousand,
    incomeCostPerThousand,
    costRatio,
  }
}
