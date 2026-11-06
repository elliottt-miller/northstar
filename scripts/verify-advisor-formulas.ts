import assert from "node:assert/strict"
import { calculateLiabilityGap } from "../src/features/risk-modules/liability/calculations/calculateLiabilityGap"
import { calculateUnemploymentGap } from "../src/features/risk-modules/unemployment/calculations/calculateUnemploymentGap"
import { calculateIncomeGapScenarios } from "../src/features/risk-modules/life/calculations/calculateIncomeGapScenarios"
import { calculateDisabilityGap } from "../src/features/risk-modules/disability/calculations/calculateDisabilityGap"
import { calculateBreakEven } from "../src/features/risk-modules/disability/calculators/calculateBreakEven"
import { disabilityColaFactor, resolveDisabilityColaRate } from "../src/features/risk-modules/disability/calculations/disabilityCola"
import { calculateAssetComparisonTotals, calculateJobComparison } from "../src/features/risk-modules/disability/calculations/disabilityComparisons"

function approximately(actual: number, expected: number, tolerance = 0.01): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  )
}

assert.equal(disabilityColaFactor(11, { colaRate: 0.03 }), 1)
assert.equal(disabilityColaFactor(12, { colaRate: 0.03 }), 1.03)
assert.equal(resolveDisabilityColaRate({ colaRate: 0 }), 0)
assert.equal(disabilityColaFactor(12, { colaRate: 0 }), 1)
approximately(disabilityColaFactor(24, { colaRate: 0.03 }), 1.0609)
assert.equal(resolveDisabilityColaRate({}), 0.03)
approximately(resolveDisabilityColaRate({ colaMethod: "cpi", cpiPrevious: 300, cpiCurrent: 309 }), 0.03)
approximately(resolveDisabilityColaRate({ colaMethod: "cpi", cpiPrevious: 300, cpiCurrent: 324, colaAnnualCap: 0.06 }), 0.06)
assert.equal(disabilityColaFactor(36, { colaRate: 0.03, colaFirstAdjustmentYear: 4 }), 1)
assert.equal(disabilityColaFactor(48, { colaRate: 0.03, colaFirstAdjustmentYear: 4 }), 1.03)

const disabilityInputs = {
  annualEarnedIncome: 120_000,
  currentAge: 40,
  retirementAge: 43,
  ltdCoveragePercent: 0,
  ltdMonthlyCap: 0,
  ltdTaxable: false,
  privateDiBenefitMonthly: 4_000,
  privateDiBenefitPeriod: "" as const,
}
const disability = calculateDisabilityGap(disabilityInputs, {
  incomeGrowthRateAnnual: 0,
  colaRate: 0.03,
})
assert.deepEqual(
  disability.incomeProjection.map((point) => point.individualDIAnnualBenefit),
  [48_000, 49_440, 50_923],
)

const disabilityDefaultCola = calculateDisabilityGap(
  { ...disabilityInputs, privateDiMonthlyPremium: 70 },
  { incomeGrowthRateAnnual: 0 },
)
assert.deepEqual(
  disabilityDefaultCola.incomeProjection.map((point) => point.individualDIAnnualBenefit),
  [48_000, 49_440, 50_923],
)
assert.equal(disabilityDefaultCola.lifetimeIDIExpense, 70 * 36)

const disabilityWithoutCola = calculateDisabilityGap(
  { ...disabilityInputs, privateDiMonthlyPremium: 70 },
  { incomeGrowthRateAnnual: 0, colaRate: 0 },
)
assert.deepEqual(
  disabilityWithoutCola.incomeProjection.map((point) => point.individualDIAnnualBenefit),
  [48_000, 48_000, 48_000],
)
assert.equal(disabilityWithoutCola.lifetimeIDIExpense, 56 * 36)

const disabilityCustomPremiumReduction = calculateDisabilityGap(
  { ...disabilityInputs, privateDiMonthlyPremium: 70 },
  { incomeGrowthRateAnnual: 0, colaRate: 0, colaRemovedPremiumReductionRate: 0.25 },
)
assert.equal(disabilityCustomPremiumReduction.lifetimeIDIExpense, 52.5 * 36)

const jobAInput = {
  annualIncome: 120_000,
  groupCoveragePercent: 60,
  groupMonthlyCap: 5_000,
  includesIndividualDI: false,
  individualDIMonthlyPremium: 0,
  individualDIMonthlyBenefit: 0,
}
const jobBInput = {
  annualIncome: 100_000,
  groupCoveragePercent: 60,
  groupMonthlyCap: 0,
  includesIndividualDI: true,
  individualDIMonthlyPremium: 100,
  individualDIMonthlyBenefit: 3_000,
}
const taxableJobComparison = calculateJobComparison(jobAInput, jobBInput, true, {
  incomeGrowthRateAnnual: 0.03,
  colaRate: 0,
})
assert.equal(taxableJobComparison.jobA.groupLTDAnnualGross, 60_000)
assert.equal(taxableJobComparison.jobA.groupLTDAnnualNet, 42_000)
assert.equal(taxableJobComparison.jobA.annualIncomeIfDisabled, 42_000)
assert.equal(taxableJobComparison.jobB.annualIncomeAfterPremium, 99_040)
assert.equal(taxableJobComparison.jobB.annualIncomeIfDisabled, 78_000)

const nonTaxableJobComparison = calculateJobComparison(jobAInput, jobBInput, false)
assert.equal(nonTaxableJobComparison.jobA.annualIncomeIfDisabled, 60_000)
const customNoColaJobComparison = calculateJobComparison(jobAInput, jobBInput, true, {
  incomeGrowthRateAnnual: 0.03,
  colaRate: 0,
  colaRemovedPremiumReductionRate: 0.25,
})
assert.equal(customNoColaJobComparison.jobB.annualIncomeAfterPremium, 99_100)

const defaultAssetComparison = calculateAssetComparisonTotals(
  [{ id: "home", label: "Home", assetValue: 400_000, annualPremium: 1_200 }],
  100,
  600_000,
  { incomeGrowthRateAnnual: 0.03 },
)
assert.equal(defaultAssetComparison.annualOtherAssetInsuranceCost, 1_200)
assert.equal(defaultAssetComparison.annualIncomeInsuranceCost, 1_200)
assert.equal(defaultAssetComparison.projectedIndividualDIBenefits, 600_000)
assert.equal(defaultAssetComparison.costRatio, 1.5)

const noColaAssetComparison = calculateAssetComparisonTotals(
  [{ id: "home", label: "Home", assetValue: 400_000, annualPremium: 1_200 }],
  100,
  480_000,
  { incomeGrowthRateAnnual: 0.03, colaRate: 0 },
)
assert.equal(noColaAssetComparison.annualIncomeInsuranceCost, 960)
assert.equal(noColaAssetComparison.projectedIndividualDIBenefits, 480_000)

const breakEven = calculateBreakEven({
  monthlyPremium: 500,
  monthlyBenefit: 4_000,
  annualRateOfReturn: 0.06,
  monthsWithoutIncome: 13,
  colaRate: 0.03,
})
assert.equal(breakEven.ok, true)
if (breakEven.ok) {
  approximately(breakEven.benefitsReceived, 12 * 4_000 + 4_000 * 1.03)
  approximately(breakEven.schedule[11].cumulativeBenefits, 48_000)
  approximately(breakEven.schedule[12].cumulativeBenefits, 52_120)
}

const lifeBaseInputs = {
  currentAge: 40,
  retirementAge: 65,
  annualIncome: 200_000,
  spouseAnnualIncome: 0,
  incomeReplacementYears: 25,
  incomeReplacementRatio: 0.7,
  groupLifeCoverage: 300_000,
  privateLifeCoverage: 500_000,
  nonQualifiedAssets: 0,
  debtsTotal: 0,
  educationGoal: 0,
  finalExpenses: 0,
  targetIncomeSupportPct: 0.85,
  incomeGapRoi: 0.06,
}
const lifeAssumptions = {
  inflationRateAnnual: 0.03,
  discountRateAnnual: 0.04,
  incomeGrowthRateAnnual: 0.03,
  usePresentValue: true,
  includeLiquidAssetsOffset: false,
  deathBenefitTaxTreatment: "generally_income_tax_free" as const,
}
const lifeAt70 = calculateIncomeGapScenarios(lifeBaseInputs, lifeAssumptions)
const lifeAt80 = calculateIncomeGapScenarios({ ...lifeBaseInputs, incomeReplacementRatio: 0.8 }, lifeAssumptions)
assert.ok(lifeAt80.module1.projectedNetIncomeTotal > lifeAt70.module1.projectedNetIncomeTotal)
assert.ok(lifeAt80.module1.targetIncomeSupportTotal > lifeAt70.module1.targetIncomeSupportTotal)
approximately(lifeAt70.module1.yearlyData[0].projectedIncome, 119_000)
approximately(lifeAt70.module1.yearlyData[0].targetIncomeNeed, 119_000)

// Life income modeling replaces, rather than offsets, a spouse/partner income.
const lifeWithSpouseIncome = calculateIncomeGapScenarios(
  { ...lifeBaseInputs, spouseAnnualIncome: 50_000 },
  lifeAssumptions,
)
approximately(lifeWithSpouseIncome.module1.yearlyData[0].projectedIncome, 161_500)
assert.ok(lifeWithSpouseIncome.module1.targetDeathBenefitNeed > lifeAt70.module1.targetDeathBenefitNeed)
assert.ok(lifeWithSpouseIncome.module2.projectedNetIncomeTotal > lifeAt70.module2.projectedNetIncomeTotal)


const unemployment = calculateUnemploymentGap({
  annualIncome: 300_000,
  spouseIncome: 100_000,
  monthlyExpenses: 20_000,
  emergencySavings: 60_000,
  severanceMonthly: 0,
  severanceDurationMonths: 0,
  unemploymentBenefitMonthly: 0,
  unemploymentBenefitDurationMonths: 0,
  estimatedJobSearchMonths: 6,
  netIncomeRatio: 0.65,
})

approximately(unemployment.remainingIncome, 5_833.33)
approximately(unemployment.monthlyExpenseReplacement, 14_166.67)
approximately(unemployment.minimumReserveTarget, 42_500)
approximately(unemployment.idealReserveTarget, 85_000)
assert.equal(unemployment.idealReserveMonths, 6)
approximately(unemployment.reserveMonthsCurrent, 60_000 / 14_166.666666666666)

const unemploymentWithOffsets = calculateUnemploymentGap({
  annualIncome: 300_000,
  spouseIncome: 100_000,
  monthlyExpenses: 20_000,
  emergencySavings: 60_000,
  severanceMonthly: 4_000,
  severanceDurationMonths: 3,
  unemploymentBenefitMonthly: 2_000,
  unemploymentBenefitDurationMonths: 6,
  estimatedJobSearchMonths: 6,
  netIncomeRatio: 0.65,
})
assert.ok(unemploymentWithOffsets.totalOffsetDuringSearch > unemployment.totalOffsetDuringSearch)
assert.ok(unemploymentWithOffsets.netCashNeeded < unemployment.netCashNeeded)
assert.ok(unemploymentWithOffsets.remainingShortfall < unemployment.remainingShortfall)
approximately(unemploymentWithOffsets.minimumReserveTarget, unemployment.minimumReserveTarget)
approximately(unemploymentWithOffsets.idealReserveTarget, unemployment.idealReserveTarget)

for (const spouseIncome of [122_000, 185_000, 250_000] as const) {
  const reserveResult = calculateUnemploymentGap({
    ...{
      annualIncome: 300_000,
      monthlyExpenses: 20_000,
      emergencySavings: 60_000,
      severanceMonthly: 0,
      severanceDurationMonths: 0,
      unemploymentBenefitMonthly: 0,
      unemploymentBenefitDurationMonths: 0,
      estimatedJobSearchMonths: 6,
      netIncomeRatio: 0.65,
    },
    spouseIncome,
  })
  assert.equal(reserveResult.idealReserveMonths, 6)
  approximately(
    reserveResult.idealReserveTarget,
    reserveResult.monthlyExpenseReplacement * 6,
  )
}

const liabilityInputs = {
  annualIncome: 0,
  spouseAnnualIncome: 0,
  currentAge: 40,
  spouseCurrentAge: 40,
  retirementAge: 65,
  homeEquity: 2_800_000,
  investmentAssets: 0,
  savingsAssets: 0,
  businessOwnershipValue: 0,
  nonQualifiedAssets: 0,
  autoLiabilityLimit: 500_000,
  umbrellaCoverage: 1_000_000,
}

const liability = calculateLiabilityGap(liabilityInputs)
assert.equal(liability.householdTotalCoverage, 1_500_000)
assert.equal(liability.householdLiabilityGap, 1_300_000)
assert.equal(liability.neededUmbrellaCoverage, 2_000_000)
assert.equal(liability.umbrellaCoverageShortfall, liability.neededUmbrellaCoverage)

const fullyCoveredLiability = calculateLiabilityGap({
  ...liabilityInputs,
  homeEquity: 0,
})
assert.equal(fullyCoveredLiability.totalHouseholdLiabilityRisk, 0)
assert.equal(fullyCoveredLiability.householdLiabilityGap, 0)
assert.equal(fullyCoveredLiability.neededUmbrellaCoverage, 0)

const advisorWageExposureExample = calculateLiabilityGap({
  annualIncome: 300_000,
  spouseAnnualIncome: 0,
  currentAge: 41,
  spouseCurrentAge: 41,
  retirementAge: 65,
  investmentAssets: 0,
  savingsAssets: 0,
  autoLiabilityLimit: 0,
  umbrellaCoverage: 0,
})
assert.ok(Math.abs(advisorWageExposureExample.householdWageGarnishmentRisk - 1_678_290) < 1)
assert.equal(advisorWageExposureExample.totalHouseholdLiabilityRisk, advisorWageExposureExample.householdWageGarnishmentRisk)

console.log("Advisor formula regression checks passed.")
