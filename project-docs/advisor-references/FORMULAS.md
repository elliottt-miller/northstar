# Formula Reference — Gap Tool

This document reflects the advisor-adherence methodology currently implemented in `src/features/risk-modules/` and the shared domain helpers under `src/domain/`.

The product is an illustrative gap-analysis tool. Output labels, formulas, and descriptions should avoid implying a formal recommendation.

---

## Shared planning assumptions

Source: `src/domain/assumptions/defaultAssumptions.ts`

```ts
incomeGrowthRate = 0.03
netIncomeRatio = 0.65
presentValueTiming = "endOfYear"
```

Present-value helper:

```ts
PV(stream) = Σ cashFlow[year] / (1 + annualRate)^(yearIndex + 1)
```

The first cash flow is discounted by one period. This is used only where a PV reference or capital-needs reference is explicitly shown.

---

# 1. Life Insurance

Primary files:

- `src/features/risk-modules/life/calculations/calculateIncomeGapScenarios.ts`
- `src/features/risk-modules/life/calculations/calculateLifeInsuranceGap.ts`
- `src/features/risk-modules/life/components/LifeInputForm.tsx`
- `src/features/risk-modules/life/components/LifeOutputView.tsx`

## 1.1 Income replacement base

```ts
annualNetIncomeNeed = max(
  0,
  (annualIncome × incomeReplacementRatio + spouseAnnualIncome) × netIncomeFactor
)
```

Spouse/partner income is an additional income stream to replace, not an offset. This is the modeled annual net income need before annual growth is applied. Life insurance death benefits are generally income-tax-free, so the benefit amount is not grossed down for taxes.

## 1.2 Projected annual net income need

```ts
projectedNetIncomeNeed[year] = annualNetIncomeNeed × (1 + incomeGrowthRate)^yearIndex
```

Default income growth is 3% annually.

## 1.3 Safe Income Coverage target

The old Safe Withdrawal Rate model has been replaced. The advisor-facing model now starts with a target income support percentage.

Default:

```ts
targetIncomeSupportPct = 0.85
```

Annual target stream (the projected net-income stream):

```ts
targetIncomeNeed[year] = projectedNetIncomeNeed[year]
```

Total advisor-facing target death benefit need:

```ts
targetDeathBenefitNeed = PV(targetIncomeNeed, pvReferenceRate)
```

This target is intentionally the main fully-covered threshold. It avoids the old behavior where a lower PV number could make the UI say “Fully Covered” while the advisor-facing death benefit need was still higher.

## 1.4 Entered coverage resources

```ts
coverageResources = groupLifeCoverage + privateLifeCoverage + nonQualifiedAssets
```

This is the entered death benefit/resource pool used in the Safe Income Coverage analysis.

## 1.5 Coverage Support Rate

```ts
coverageSupportRate = min(1, coverageResources / targetDeathBenefitNeed)
```

The UI shows this as the percentage of the target income support stream backed by the entered resources.

## 1.6 Annual income supported and annual gap

```ts
incomeSupported[year] = min(
  targetIncomeNeed[year],
  targetIncomeNeed[year] × coverageSupportRate
)

incomeGap[year] = max(0, targetIncomeNeed[year] − incomeSupported[year])
```

The chart, Survivor Gap card, and planning narrative are all derived from this same annual schedule.

## 1.7 Survivor Gap

```ts
survivorGap = Σ incomeGap[year]
```

“Fully Covered” is true only when all annual target gaps are zero.

```ts
isFullyCovered = every(incomeGap[year] <= 0)
```

## 1.8 Additional Death Benefit Needed

```ts
additionalDeathBenefitNeeded = max(0, targetDeathBenefitNeed − coverageResources)
```

This replaces the previous misleading behavior where the UI could say fully covered based on a discounted present-value comparison while the advisor-facing need still appeared higher.

## 1.9 PV reference of target need

The module may still calculate a PV reference, but this does not drive the main fully-covered state.

```ts
pvOfTargetNeed = Σ targetIncomeNeed[year] / (1 + roi)^(yearIndex + 1)
```

## 1.10 Covered Runway Scenario

The previous Max W/D Rate language has been replaced with a Covered Runway model using the same PV Reference Rate as Safe Income Coverage.

```ts
balance = coverageResources

for each year:
  balance = balance × (1 + pvReferenceRate)
  runwayIncomeCovered = min(balance, projectedNetIncomeNeed[year])
  annualGap = max(0, projectedNetIncomeNeed[year] − runwayIncomeCovered)
  balance = max(0, balance − runwayIncomeCovered)
```

Outputs:

```ts
yearsOfFullCoverage = count(years where annualGap == 0)
totalNetIncomeReplaced = Σ runwayIncomeCovered
survivorGap = Σ annualGap
deathBenefitNeeded = PV(annualGap stream)
```

---

# 2. Liability / Lawsuit

Primary files:

- `src/features/risk-modules/liability/calculations/calculateLiabilityGap.ts`
- `src/features/risk-modules/liability/components/LiabilityInputForm.tsx`
- `src/features/risk-modules/liability/components/LiabilityOutputView.tsx`
- `src/features/risk-modules/liability/types.ts`

## 2.1 Disposable-income wage garnishment exposure

The Wage Garnishment Risk calculation uses a disposable-income proxy rather than gross income.

Defaults:

```ts
disposableIncomeRatio = 0.65
garnishmentRate = 0.25
incomeGrowthRate = 0.03
```

Annual schedule:

```ts
grossIncome[year] = primaryGrossIncome[year] + spouseGrossIncome[year]
disposableIncome[year] = grossIncome[year] × disposableIncomeRatio
garnishableIncome[year] = disposableIncome[year] × garnishmentRate
```

Cumulative exposure:

```ts
householdWageGarnishmentRisk = Σ garnishableIncome[year]
```

Advisor example:

```ts
$300,000 gross income × 65% = $195,000 disposable income proxy
$195,000 × 25% = $48,750 first-year garnishable exposure
```

Projected from age 41 to 65 at 3% income growth, this produces approximately $1.68M of cumulative wage garnishment exposure.

Disclosure copy should state that this is a simplified disposable-earnings proxy and that actual garnishment rules vary.

## 2.2 At-risk assets

```ts
nonQualifiedAssetsAtRisk = max(
  nonQualifiedAssets,
  investmentAssets + savingsAssets + businessOwnershipValue
)
```

Home equity is entered directly:

```ts
homeEquity = direct input
```

Home value and mortgage balance are no longer part of the active Liability input workflow.

## 2.3 Total household liability exposure

```ts
totalHouseholdLiabilityRisk = householdWageGarnishmentRisk + nonQualifiedAssetsAtRisk
```

Coverage:

```ts
householdTotalCoverage = autoLiabilityLimit + umbrellaCoverage
householdLiabilityGap = max(0, totalHouseholdLiabilityRisk − householdTotalCoverage)
```

## 2.4 Needed umbrella

The UI should not use “Recommended Umbrella.” The advisor-safe label is:

```text
Needed Umbrella
```

Umbrella policies are modeled in $1M blocks.

```ts
coverageGap = max(
  0,
  totalHouseholdLiabilityRisk − autoLiabilityLimit − existingUmbrellaCoverage
)

umbrellaNeeded = coverageGap > 0
  ? ceil(coverageGap / 1_000_000) × 1_000_000
  : 0
```

The four primary metrics are Total Exposure, Total Current Coverage, Coverage Gap, and Needed Umbrella. The description must keep the result illustrative.

---

# 3. Unemployment

Primary files:

- `src/features/risk-modules/unemployment/calculations/calculateUnemploymentGap.ts`
- `src/features/risk-modules/unemployment/components/UnemploymentInputForm.tsx`
- `src/features/risk-modules/unemployment/components/UnemploymentOutputView.tsx`
- `src/features/risk-modules/unemployment/types.ts`

## 3.1 Net monthly income proxy

```ts
primaryNetMonthlyIncome = primaryAnnualIncome × netIncomeRatio / 12
secondaryNetMonthlyIncome = spouseAnnualIncome × netIncomeRatio / 12
```

Default:

```ts
netIncomeRatio = 0.65
```

## 3.2 Remaining income if highest earner loses income

```ts
incomeAtRisk = max(primaryAnnualIncome, spouseAnnualIncome)
remainingGrossAnnualIncome = min(primaryAnnualIncome, spouseAnnualIncome)
remainingIncome = remainingGrossAnnualIncome × netIncomeRatio / 12
```

Remaining income coverage:

```ts
remainingIncomeCoveragePct = remainingIncome / monthlyExpenses
```

## 3.3 Dynamic ideal reserve months

```ts
if remainingIncomeCoveragePct < 0.33:
  idealReserveMonths = 6
else if remainingIncomeCoveragePct < 0.50:
  idealReserveMonths = 5
else if remainingIncomeCoveragePct < 0.67:
  idealReserveMonths = 4
else:
  idealReserveMonths = 3
```

Minimum reserve months always remains 3.

```ts
monthlyGap = max(0, monthlyExpenses − remainingIncome)
minimumReserveTarget = monthlyGap × 3
idealReserveTarget = monthlyGap × idealReserveMonths
reserveGap = max(0, idealReserveTarget − emergencySavings)
excessReserve = max(0, emergencySavings − idealReserveTarget)
```

Advisor example:

```ts
primaryIncome = $300,000
spouseIncome = $100,000
monthlyExpenses = $20,000
netIncomeRatio = 0.65

remainingIncome = $100,000 × 0.65 / 12 = $5,417
remainingIncomeCoveragePct = $5,417 / $20,000 = 27%
idealReserveMonths = 6
monthlyGap = $20,000 − $5,417 = $14,583
idealReserveTarget = $14,583 × 6 = $87,500
```

## 3.4 Emergency reserve gauge

The gauge is tied to actual emergency savings, not severance or unemployment pools.

```ts
reserveMonthsCurrent = emergencySavings / monthlyGap
reserveGaugeCoveragePct = emergencySavings / idealReserveTarget
```

Severance and unemployment benefits are part of the separate search-period runway model, not the emergency reserve target.

## 3.5 Search-period runway

```ts
monthlyOffset = remainingIncome + severanceMonthly + unemploymentBenefitMonthly
monthlyNetBurn = max(0, monthlyExpenses − monthlyOffset)
```

Month-by-month timeline:

```ts
for each search month:
  offsetIncome = remainingIncome + activeSeverance + activeUnemploymentBenefit
  requiredSavingsDraw = max(0, monthlyExpenses − offsetIncome)
  coveredByReserve = min(reserveBalance, requiredSavingsDraw)
  shortfall = max(0, requiredSavingsDraw − reserveBalance)
  reserveBalance = max(0, reserveBalance − requiredSavingsDraw)
```

Effective runway is displayed as a search-period metric, separate from the emergency reserve gauge.

---

# 4. Disability

The disability module remains governed by its existing implementation under:

- `src/features/risk-modules/disability/calculations/`
- `src/features/risk-modules/disability/components/`

Core conventions:

```ts
ltdMonthlyGross = min(annualIncome × coveragePercent / 12, monthlyCap)
monthlyCap = 0 ? uncapped : entered cap
ltdNetMonthly = ltdTaxable ? ltdMonthlyGross × 0.70 : ltdMonthlyGross
totalNetMonthlyBenefit = ltdNetMonthly + privateDiBenefitMonthly
incomeLossNet = annualIncome × 0.70 / 12 − totalNetMonthlyBenefit
```

The disability projection applies the configured income growth rate to earned income, adjusts taxable Group LTD to 70% of its gross benefit, and applies Individual DI COLA to the projected benefit stream. The entered Individual DI benefit and premium represent a COLA-included policy by default.

Without COLA:

```ts
individualDIBenefit[year] = enteredMonthlyBenefit × 12
effectiveMonthlyPremium = enteredMonthlyPremium × (1 − colaRemovedPremiumReductionRate)
```

`colaRemovedPremiumReductionRate` defaults to 20% and is configurable in advisor assumptions. Legacy saved scenarios without the field use the same default.

Job comparison:

```ts
jobAIncome = jobAIncomeInput
jobBIncome = max(0, jobBIncomeInput − effectiveMonthlyPremium × 12)
jobAIncomeIfDisabled = netGroupLTD
jobBIncomeIfDisabled = netGroupLTD + enteredIndividualDIBenefit × 12
```

Group LTD is computed separately for each job from its income, coverage percentage, and monthly cap. When taxable, the 70% factor is applied after the cap. Job comparison is a current-year comparison; projected COLA growth is represented in the disability projection.

Asset Comparison uses the sum of projected Individual DI benefits from the shared disability calculation through the policy benefit period and projection end age. Its annual income-insurance cost is `effectiveMonthlyPremium × 12`. Other asset costs are the sum of advisor-entered annual premiums; they are not derived from asset values.

---

# 5. Copy and compliance framing

Advisor-safe copy is centralized in:

```ts
src/domain/copy/advisorSafeCopy.ts
```

Required framing:

- This is an illustrative gap-analysis tool.
- Avoid “recommended” language for umbrella coverage.
- Use “Needed Umbrella” for the rounded gap and avoid recommendation language.
- Use “Additional Death Benefit Needed” where the module is showing a remaining shortfall after entered resources.
- Explain disposable-income and net-income proxies as simplified assumptions.
