import type { DisabilityColaTerms } from "./calculations/disabilityCola";

export type DiBenefitPeriod = "2y" | "5y" | "10y" | "A65" | "A67" | "A70";

export type DisabilityInputs = {
  advisorId?: string;
  clientId?: string;
  scenarioId?: string;

  /** Client's current annual earned income. */
  annualEarnedIncome: number;
  /** Client's current age, used as starting point for the income projection. */
  currentAge: number;
  /** Age at which the income projection ends (retirement). */
  retirementAge: number;

  // ── Group Long Term Disability ────────────────────────────────────────────
  /** Fraction of income covered by group LTD, e.g. 0.60 for 60%. */
  ltdCoveragePercent: number;
  /** Monthly benefit cap in dollars, e.g. 10000. 0 means no cap. */
  ltdMonthlyCap: number;
  /** If true, the net LTD benefit is reduced to 70% of gross (taxable). */
  ltdTaxable: boolean;

  // ── Individual Disability Insurance ──────────────────────────────────────
  /** Monthly benefit amount for the individual DI policy in dollars. */
  privateDiBenefitMonthly: number;
  /** Benefit period for the individual DI policy. Empty string means perpetual through retirement. */
  privateDiBenefitPeriod: DiBenefitPeriod | "";
  /** Monthly premium paid for the individual DI policy. Treated as COLA-included unless COLA is removed in assumptions. */
  privateDiMonthlyPremium?: number;

  // ── Break-Even Calculator ─────────────────────────────────────────────────
  /** Annual rate of return used in the break-even self-insurance calculation (e.g. 0.06 = 6%). */
  breakEvenRateOfReturn?: number;
  /** Number of months without income used in the break-even calculation. */
  breakEvenMonthsWithoutIncome?: number;

  // ── Asset Comparison ──────────────────────────────────────────────────────
  /** Advisor-entered non-income assets (e.g. home, auto) and their annual cost to insure, used in the Asset Comparison visualization. */
  otherAssets?: DisabilityOtherAsset[];
};

export type DisabilityOtherAsset = {
  id: string;
  label: string;
  assetValue: number;
  annualPremium: number;
};

export type DisabilityAssumptions = DisabilityColaTerms & {
  /** Annual income growth rate applied to the projection (e.g. 0.03 = 3%). */
  incomeGrowthRateAnnual: number;
  /**
   * Annual Cost of Living Adjustment applied to the individual DI benefit.
   * If omitted, the policy is treated as COLA-included by default at 3%.
   * Set to 0 to model removing COLA from the policy.
   */
  colaRate?: number;
};

export type DisabilityIncomeProjectionPoint = {
  age: number;
  /** Projected annual income at this age (growing at the assumption rate). */
  annualIncome: number;
  /** Projected annual net income at this age using the 70% tax-adjustment assumption. */
  annualIncomeNet: number;
  /** Gross annual group LTD benefit at this age (before taxability). */
  ltdAnnualBenefitGross: number;
  /** Net annual group LTD benefit at this age (after taxability and income-scaling). */
  ltdAnnualBenefit: number;
  /** Annual individual DI benefit at this age. Includes COLA unless removed in assumptions. */
  individualDIAnnualBenefit: number;
  /** Combined annual benefit (LTD + individual DI). */
  totalAnnualBenefit: number;
  /** Uncovered income gap: max(0, annualIncomeNet − totalAnnualBenefit). */
  annualGap: number;
};

export type DisabilityOutputs = {
  // ── Current-year monthly summary ─────────────────────────────────────────
  /** Gross monthly LTD benefit: min(income × coveragePercent / 12, cap). */
  ltdComputedMonthlyBenefit: number;
  /** Net monthly LTD benefit after 70% taxability factor (or full if non-taxable). */
  ltdNetMonthlyBenefit: number;
  /** Individual DI monthly benefit as entered. */
  privateDiMonthlyBenefit: number;
  /** Combined net monthly benefit (ltdNet + individualDI). */
  totalNetMonthlyBenefit: number;
  /**
   * Income Loss (Net) at current age:
   *   (annualIncome × 0.70 / 12) − totalNetMonthlyBenefit
   * Positive = uncovered loss; negative = over-covered.
   */
  incomeLossNet: number;

  // ── Income projection through retirement ─────────────────────────────────
  incomeProjection: DisabilityIncomeProjectionPoint[];

  // ── Aggregate summary stats ───────────────────────────────────────────────
  projectedIncomeAtRetirement: number;
  totalProjectedIncome: number;
  totalGroupLTDCoverage: number;
  totalIndividualDICoverage: number;
  totalCoverage: number;
  totalGap: number;
  /** Fraction of projected lifetime income covered by combined benefits. */
  averageCoverageRate: number;
  /** Total premiums paid for individual DI from current age to retirement. */
  lifetimeIDIExpense: number;
};
