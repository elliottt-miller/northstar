import { DisabilityInputs, DisabilityAssumptions, DisabilityOutputs, DisabilityIncomeProjectionPoint, DiBenefitPeriod } from "../types";
import { nonNegative, clamp, roundCurrency, safeDivide, roundPercent } from "@/lib/math";
import { disabilityColaFactor, disabilityPremiumFactor, resolveDisabilityColaRate } from "./disabilityCola";

/**
 * Computes the gross monthly LTD benefit:
 *   min(annualIncome × coveragePercent / 12, monthlyCap)
 * Returns 0 if coveragePercent is 0.
 */
function computeLtdMonthlyGross(annualIncome: number, coveragePercent: number, monthlyCap: number): number {
  if (coveragePercent <= 0) return 0;
  const percentBased = nonNegative(annualIncome) * clamp(coveragePercent, 0, 1) / 12;
  return monthlyCap > 0 ? Math.min(percentBased, monthlyCap) : percentBased;
}

/**
 * Maps a benefit period selector to the age at which the individual DI policy expires.
 * Returns null when the period is empty (treated as perpetual through retirement).
 */
function benefitPeriodToEndAge(period: DiBenefitPeriod | "", currentAge: number): number | null {
  switch (period) {
    case "2y":  return currentAge + 2;
    case "5y":  return currentAge + 5;
    case "10y": return currentAge + 10;
    case "A65": return 65;
    case "A67": return 67;
    case "A70": return 70;
    default:    return null; // perpetual through retirement
  }
}

export function calculateDisabilityGap(
  inputs: DisabilityInputs,
  assumptions: DisabilityAssumptions,
): DisabilityOutputs {
  const annualIncome = nonNegative(inputs.annualEarnedIncome);
  const currentAge = inputs.currentAge || 40;
  const retirementAge = Math.max(currentAge + 1, inputs.retirementAge || 65);
  const growthRate = clamp(assumptions.incomeGrowthRateAnnual ?? 0.03, 0, 0.20);
  const colaRate = resolveDisabilityColaRate(assumptions);

  // ── Current-year monthly summary ──────────────────────────────────────────
  const ltdMonthlyGross = computeLtdMonthlyGross(annualIncome, inputs.ltdCoveragePercent, inputs.ltdMonthlyCap);
  const ltdNetMonthly = inputs.ltdTaxable ? ltdMonthlyGross * 0.70 : ltdMonthlyGross;
  const privateDiMonthly = nonNegative(inputs.privateDiBenefitMonthly);
  const totalNetMonthly = ltdNetMonthly + privateDiMonthly;

  // ── Individual DI benefit period ─────────────────────────────────────────
  const diEndAge = benefitPeriodToEndAge(inputs.privateDiBenefitPeriod, currentAge);

  // ── Yearly income projection ──────────────────────────────────────────────
  const projection: DisabilityIncomeProjectionPoint[] = [];
  const yearsToRetirement = retirementAge - currentAge;

  for (let year = 0; year < yearsToRetirement; year++) {
    // Annual rows are labeled by attained age at the end of each period.
    const age = currentAge + year + 1;
    const annualIncomeAtAge = roundCurrency(annualIncome * Math.pow(1 + growthRate, year));
    const annualIncomeNetAtAge = roundCurrency(annualIncomeAtAge * 0.70);

    // Group LTD re-applies the coverage percentage each year against the grown income
    // (still capped at the monthly cap), then applies the taxability factor.
    const ltdGrossAtAge = computeLtdMonthlyGross(annualIncomeAtAge, inputs.ltdCoveragePercent, inputs.ltdMonthlyCap);
    const ltdNetAtAge = inputs.ltdTaxable ? ltdGrossAtAge * 0.70 : ltdGrossAtAge;
    const ltdAnnualBenefitGross = roundCurrency(ltdGrossAtAge * 12);
    const ltdAnnualBenefit = roundCurrency(ltdNetAtAge * 12);

    // Individual DI: the entered policy benefit includes COLA by default.
    // When COLA is removed, assumptions explicitly set colaRate to 0 and this
    // stream stays level while the no-COLA premium is modeled 20% lower.
    // Active until the benefit-period end age (or perpetual through retirement if none set).
    const diIsActive = diEndAge === null ? privateDiMonthly > 0 : age <= diEndAge;
    const diMonthlyAtAge = privateDiMonthly * disabilityColaFactor(year * 12, assumptions);
    const individualDIAnnualBenefit = diIsActive ? roundCurrency(diMonthlyAtAge * 12) : 0;

    const totalAnnualBenefit = roundCurrency(ltdAnnualBenefit + individualDIAnnualBenefit);
    const annualGap = roundCurrency(Math.max(0, annualIncomeNetAtAge - totalAnnualBenefit));

    projection.push({
      age,
      annualIncome: annualIncomeAtAge,
      annualIncomeNet: annualIncomeNetAtAge,
      ltdAnnualBenefitGross,
      ltdAnnualBenefit,
      individualDIAnnualBenefit,
      totalAnnualBenefit,
      annualGap,
    });
  }

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const projectedIncomeAtRetirement = projection.at(-1)?.annualIncomeNet ?? 0;
  const totalProjectedIncome = projection.reduce((s, p) => s + p.annualIncomeNet, 0);
  const totalGroupLTDCoverage = projection.reduce((s, p) => s + p.ltdAnnualBenefit, 0);
  const totalIndividualDICoverage = projection.reduce((s, p) => s + p.individualDIAnnualBenefit, 0);
  const totalCoverage = totalGroupLTDCoverage + totalIndividualDICoverage;
  const totalGap = projection.reduce((s, p) => s + p.annualGap, 0);
  const averageCoverageRate = roundPercent(safeDivide(totalCoverage, totalProjectedIncome));

  // Income Loss (Net) at the starting year: net income / 12 × 0.70 − totalNetMonthly
  const startingAnnualIncome = projection[0]?.annualIncome ?? annualIncome;
  const incomeLossNet = roundCurrency((startingAnnualIncome * 0.70 / 12) - totalNetMonthly);

  // Lifetime IDI Expense: the entered monthly premium is treated as the policy
  // premium with COLA included. If COLA is removed, premium is modeled 20% lower.
  const projectionMonths = yearsToRetirement * 12;
  const enteredMonthlyPremium = nonNegative(inputs.privateDiMonthlyPremium ?? 0);
  const monthlyPremium = enteredMonthlyPremium * disabilityPremiumFactor(assumptions);
  const lifetimeIDIExpense = roundCurrency(monthlyPremium * projectionMonths);

  return {
    ltdComputedMonthlyBenefit: roundCurrency(ltdMonthlyGross),
    ltdNetMonthlyBenefit: roundCurrency(ltdNetMonthly),
    privateDiMonthlyBenefit: roundCurrency(privateDiMonthly),
    totalNetMonthlyBenefit: roundCurrency(totalNetMonthly),
    incomeLossNet,
    incomeProjection: projection,
    projectedIncomeAtRetirement: roundCurrency(projectedIncomeAtRetirement),
    totalProjectedIncome: roundCurrency(totalProjectedIncome),
    totalGroupLTDCoverage: roundCurrency(totalGroupLTDCoverage),
    totalIndividualDICoverage: roundCurrency(totalIndividualDICoverage),
    totalCoverage: roundCurrency(totalCoverage),
    totalGap: roundCurrency(totalGap),
    averageCoverageRate,
    lifetimeIDIExpense,
  };
}
