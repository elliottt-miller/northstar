import { useState } from "react"
import { Bar, Cell, Tooltip } from "recharts"
import { DisabilityOutputs } from "../types"
import type { DisabilityInputs, DisabilityAssumptions } from "../types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FinancialProjectionChart } from "@/components/charts/FinancialProjectionChart"
import {
  buildProjectionAgeTicks,
  financialBarChartTheme,
  projectionCellVisualState,
  topStackCellRadius,
  topStackRadius,
} from "@/components/charts/financialBarChartTheme"
import { UniformStackedBar } from "@/components/charts/UniformStackedBar"
import { formatCurrency } from "@/lib/utils"
import { getDisabilityNarrative } from "../constants/moduleCopy"
import { AnimatedSection } from "@/components/ui/animated-section"
import { transformDisabilityChartData } from "../transformers/transformDisabilityChartData"
import { DEFAULT_DISABILITY_COLA_RATE, disabilityColaFactor, disabilityPremiumFactor, resolveColaRemovedPremiumReductionRate, resolveDisabilityColaRate } from "../calculations/disabilityCola"
import { PremiumVsSelfInsuredModule } from "../calculators/PremiumVsSelfInsuredModule"
import { JobComparisonModule } from "../calculators/JobComparisonModule"
import { AssetComparisonModule } from "../calculators/AssetComparisonModule"
import {
  ModuleMetricCard,
  MetricGroup,
} from "@/features/risk-modules/core/ModuleMetricCard"

const SUMMARY_ROW_CLASS = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5"
const SUMMARY_LABEL_CLASS = "min-w-0 whitespace-nowrap text-slate-400"
const SUMMARY_VALUE_CLASS = "whitespace-nowrap text-right font-mono font-semibold"

type DisabilityVisualization = "incomeGap" | "premiumVsSelfInsured" | "jobComparison" | "assetComparison"

interface DisabilityOutputViewProps {
  outputs: DisabilityOutputs
  inputs?: DisabilityInputs
  assumptions?: DisabilityAssumptions
  onAssumptionsChange?: (updates: Partial<DisabilityAssumptions>) => void
  onInputsChange?: (next: DisabilityInputs) => void
  formOpen?: boolean
  mode?: "builder" | "presentation" | "report"
  visualization?: DisabilityVisualization
  onVisualizationChange?: (v: any) => void
}

function roundCurrencyValue(value: number): number {
  return Math.round(value * 100) / 100
}

function getMonthlyStatsAtAge(outputs: DisabilityOutputs, age: number) {
  const point = outputs.incomeProjection.find((p) => p.age === age)
  if (!point) {
    const startingPoint = outputs.incomeProjection[0]
    const incomeGrossMonthly = (startingPoint?.annualIncome ?? 0) / 12
    const incomeNetMonthly = (startingPoint?.annualIncomeNet ?? 0) / 12
    const totalGrossMonthly = outputs.ltdComputedMonthlyBenefit + outputs.privateDiMonthlyBenefit
    return {
      ltdNetMonthly: outputs.ltdNetMonthlyBenefit,
      ltdGrossMonthly: outputs.ltdComputedMonthlyBenefit,
      individualDIMonthly: outputs.privateDiMonthlyBenefit,
      totalNetMonthly: outputs.totalNetMonthlyBenefit,
      totalGrossMonthly,
      incomeGrossMonthly,
      incomeNetMonthly,
      incomeLossNet: incomeNetMonthly - outputs.totalNetMonthlyBenefit,
      incomeLossGross: incomeGrossMonthly - totalGrossMonthly,
    }
  }

  const ltdNetMonthly = point.ltdAnnualBenefit / 12
  const ltdGrossMonthly = point.ltdAnnualBenefitGross / 12
  const individualDIMonthly = point.individualDIAnnualBenefit / 12
  const totalNetMonthly = point.totalAnnualBenefit / 12
  const totalGrossMonthly = ltdGrossMonthly + individualDIMonthly
  const incomeGrossMonthly = point.annualIncome / 12
  const incomeNetMonthly = point.annualIncomeNet / 12

  return {
    ltdNetMonthly,
    ltdGrossMonthly,
    individualDIMonthly,
    totalNetMonthly,
    totalGrossMonthly,
    incomeGrossMonthly,
    incomeNetMonthly,
    incomeLossNet: incomeNetMonthly - totalNetMonthly,
    incomeLossGross: incomeGrossMonthly - totalGrossMonthly,
  }
}

export function DisabilityOutputView({
  outputs,
  inputs,
  assumptions,
  onAssumptionsChange,
  onInputsChange,
  formOpen = false,
  mode = "builder",
  visualization: visualizationProp,
  onVisualizationChange,
}: DisabilityOutputViewProps) {
  const animateChart = mode === "builder"
  const projectionBarSize = mode === "report" ? financialBarChartTheme.geometry.reportProjectionBarSize : financialBarChartTheme.geometry.projectionBarSize
  const chartData = transformDisabilityChartData(outputs)
  const ageTicks = buildProjectionAgeTicks(chartData.projectionChartData, 8)
  const [selectedAge, setSelectedAge] = useState<number | null>(null)
  const [chartView, setChartView] = useState<"net" | "gross">("net")
  const [visualizationInternal, setVisualizationInternal] = useState<DisabilityVisualization>("incomeGap")

  const colaRate = resolveDisabilityColaRate(assumptions ?? {})
  const colaEnabled = colaRate > 0
  function toggleCola() {
    onAssumptionsChange?.({
      colaMethod: "fixed",
      colaRate: colaEnabled ? 0 : DEFAULT_DISABILITY_COLA_RATE,
    })
  }

  const visualization = visualizationProp ?? visualizationInternal
  function setVisualization(v: DisabilityVisualization) {
    setVisualizationInternal(v)
    onVisualizationChange?.(v)
  }

  const startAge = outputs.incomeProjection[0]?.age ?? 0
  const displayAge = selectedAge ?? startAge
  const monthly = getMonthlyStatsAtAge(outputs, displayAge)

  const ltdDisplayMonthly = chartView === "gross" ? monthly.ltdGrossMonthly : monthly.ltdNetMonthly
  const totalDisplayMonthly = chartView === "gross" ? monthly.totalGrossMonthly : monthly.totalNetMonthly
  const incomeLossDisplayMonthly = chartView === "gross" ? monthly.incomeLossGross : monthly.incomeLossNet
  const assumedIncomeDisplayMonthly = chartView === "gross" ? monthly.incomeGrossMonthly : monthly.incomeNetMonthly
  const assumedIncomeKey = chartView === "gross" ? "Assumed Income (Gross)" : "Assumed Income (Net)"
  const assumedIncomeLabel = chartView === "gross" ? "Assumed Income (Gross)" : "Assumed Income (Net)"
  const ltdLabel = chartView === "gross" ? "Group LTD (Gross)" : "Group LTD (Net)"
  const totalBenefitLabel = chartView === "gross" ? "Total Benefit (Gross)" : "Total Benefit (Net)"
  const incomeLossLabel = chartView === "gross" ? "Income Loss (Gross)" : "Income Loss (Net)"
  const incomeLossDescription = chartView === "gross"
    ? "Assumed gross income minus total gross monthly benefit"
    : "Assumed net income minus total net monthly benefit"

  const totalProjectedIncomeGross = outputs.incomeProjection.reduce((sum, point) => sum + point.annualIncome, 0)
  const totalGroupLTDCoverageGross = outputs.incomeProjection.reduce((sum, point) => sum + point.ltdAnnualBenefitGross, 0)
  const totalCoverageGross = outputs.incomeProjection.reduce((sum, point) => sum + point.ltdAnnualBenefitGross + point.individualDIAnnualBenefit, 0)
  const projectedIncomeDisplay = chartView === "gross" ? totalProjectedIncomeGross : outputs.totalProjectedIncome
  const groupLTDDisplay = chartView === "gross" ? totalGroupLTDCoverageGross : outputs.totalGroupLTDCoverage
  const totalIncomeReplacedDisplay = chartView === "gross" ? totalCoverageGross : outputs.totalCoverage
  const incomeGap1Display = projectedIncomeDisplay - groupLTDDisplay
  const incomeGap2Display = projectedIncomeDisplay - totalIncomeReplacedDisplay
  const incomeGapDiffDisplay = incomeGap1Display - incomeGap2Display

  const enteredMonthlyPremium = inputs?.privateDiMonthlyPremium ?? 0
  const enteredMonthlyBenefit = inputs?.privateDiBenefitMonthly ?? 0
  const projectionMonths = outputs.incomeProjection.length * 12
  const currentPolicyMonthlyPremium = enteredMonthlyPremium * disabilityPremiumFactor(assumptions ?? {})
  const colaRemovedMonthlySavings = roundCurrencyValue(enteredMonthlyPremium * resolveColaRemovedPremiumReductionRate(assumptions ?? {}))
  const colaRemovedLifetimeSavings = roundCurrencyValue(colaRemovedMonthlySavings * projectionMonths)
  const withColaIndividualDICoverage = outputs.incomeProjection.reduce((sum, point, yearIndex) => {
    if (enteredMonthlyBenefit <= 0 || point.individualDIAnnualBenefit <= 0) return sum
    return sum + enteredMonthlyBenefit * disabilityColaFactor(yearIndex * 12, {
      colaMethod: "fixed",
      colaRate: DEFAULT_DISABILITY_COLA_RATE,
    }) * 12
  }, 0)
  const colaBenefitGivenUp = roundCurrencyValue(Math.max(0, withColaIndividualDICoverage - outputs.totalIndividualDICoverage))
  const showColaRemovedCard = !colaEnabled && (enteredMonthlyPremium > 0 || colaBenefitGivenUp > 0)
  const colaRemoved = !colaEnabled
  const colaCurrentMode = colaRemoved ? "Without COLA" : "COLA included"

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const point = payload[0]?.payload
    const assumedIncomeAnnual = point?.[assumedIncomeKey] ?? 0
    const grossIncome = point?.["Assumed Income (Gross)"] ?? 0
    const netIncome = point?.["Assumed Income (Net)"] ?? 0
    const ltdGross = point?.["Group LTD (Gross)"] ?? 0
    const ltdNet = point?.["Group LTD (Net)"] ?? 0
    const idiAnnual = point?.["Individual DI"] ?? 0
    const displayGap = chartView === "gross" ? grossIncome - (ltdGross + idiAnnual) : netIncome - (ltdNet + idiAnnual)
    return (
      <div className="min-w-52 rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm shadow-lg">
        <p className="mb-2 font-semibold text-gray-100">Age {label}</p>
        <div className="mb-1.5 flex justify-between gap-4">
          <span className="text-xs text-slate-300">{assumedIncomeLabel}:</span>
          <span className="text-xs font-semibold text-slate-100">{formatCurrency(assumedIncomeAnnual)}/yr · {formatCurrency(assumedIncomeAnnual / 12)}/mo</span>
        </div>
        {payload.map((entry: any) => (
          <div key={entry.name} className="mb-1 flex justify-between gap-4">
            <span style={{ color: entry.color }} className="text-xs">{entry.name}:</span>
            <span className="text-xs font-semibold text-gray-100">
              {entry.name === "Income Gap" ? `${formatCurrency(displayGap)}/yr · ${formatCurrency(displayGap / 12)}/mo` : `${formatCurrency(entry.value)}/yr · ${formatCurrency(entry.value / 12)}/mo`}
            </span>
          </div>
        ))}
      </div>
    )
  }

  function renderVisualization() {
    if (visualization === "premiumVsSelfInsured") {
      const basePremium = inputs?.privateDiMonthlyPremium ?? 0
      const policyPremium = basePremium * disabilityPremiumFactor(assumptions ?? {})
      return (
        <PremiumVsSelfInsuredModule
          monthlyPremium={policyPremium}
          monthlyBenefit={inputs?.privateDiBenefitMonthly ?? 0}
          annualRateOfReturn={inputs?.breakEvenRateOfReturn ?? 0.06}
          monthsWithoutIncome={inputs?.breakEvenMonthsWithoutIncome ?? 12}
          benefitColaRate={colaRate}
          mode={mode === "report" ? "presentation" : mode}
          inputs={inputs}
        />
      )
    }

    if (visualization === "jobComparison") return <JobComparisonModule inputs={inputs} assumptions={assumptions} animate={animateChart} />
    if (visualization === "assetComparison") return <AssetComparisonModule inputs={inputs} outputs={outputs} assumptions={assumptions} onInputsChange={onInputsChange} />

    return (
      <div className="module-output-container">
        <div className={`disability-coverage-grid${formOpen ? " disability-coverage-grid--form-open" : ""}`}>
          <div className={`disability-summary-rail${showColaRemovedCard ? " disability-summary-rail--cola" : ""}`}>
            <Card className="module-kpi-card">
              <CardContent className="p-3.5">
                <div className="mb-2 whitespace-nowrap text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">Lifetime Coverage</div>
                <div className="divide-y divide-slate-800/80 text-xs">
                  <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Group LTD</span><span className={`${SUMMARY_VALUE_CLASS} text-blue-300`}>{formatCurrency(groupLTDDisplay)}</span></div>
                  <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Individual DI</span><span className={`${SUMMARY_VALUE_CLASS} text-cyan-300`}>{formatCurrency(outputs.totalIndividualDICoverage)}</span></div>
                  <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Total Replaced</span><span className={`${SUMMARY_VALUE_CLASS} text-emerald-400`}>{formatCurrency(totalIncomeReplacedDisplay)}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card className="module-kpi-card">
              <CardContent className="p-3.5">
                <div className="mb-2 whitespace-nowrap text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">Lifetime Income ({chartView === "gross" ? "Gross" : "Net"})</div>
                <div className="divide-y divide-slate-800/80 text-xs">
                  <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Projected Income</span><span className={`${SUMMARY_VALUE_CLASS} text-slate-200`}>{formatCurrency(projectedIncomeDisplay)}</span></div>
                  <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Income Gap #1</span><span className={`${SUMMARY_VALUE_CLASS} text-red-400`}>{formatCurrency(incomeGap1Display)}</span></div>
                  <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Income Gap #2</span><span className={`${SUMMARY_VALUE_CLASS} text-orange-400`}>{formatCurrency(incomeGap2Display)}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card className="module-kpi-card">
              <CardContent className="p-3.5">
                <div className="mb-2 whitespace-nowrap text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">Outcome</div>
                <div className="divide-y divide-slate-800/80 text-xs">
                  <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Gap Difference</span><span className={`${SUMMARY_VALUE_CLASS} text-emerald-400`}>{formatCurrency(incomeGapDiffDisplay)}</span></div>
                  {outputs.lifetimeIDIExpense > 0 ? <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>IDI Expense</span><span className={`${SUMMARY_VALUE_CLASS} text-amber-400`}>{formatCurrency(outputs.lifetimeIDIExpense)}</span></div> : null}
                  {enteredMonthlyPremium > 0 ? <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Monthly Premium</span><span className={`${SUMMARY_VALUE_CLASS} text-amber-300`}>{formatCurrency(currentPolicyMonthlyPremium)}/mo</span></div> : null}
                </div>
              </CardContent>
            </Card>

            {showColaRemovedCard ? (
              <Card className="module-kpi-card border-amber-900/50">
                <CardContent className="p-3.5">
                  <div className="mb-2 whitespace-nowrap text-[10px] font-bold tracking-[0.18em] text-amber-500 uppercase">Without COLA</div>
                  <div className="divide-y divide-slate-800/80 text-xs">
                    <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Monthly Savings</span><span className={`${SUMMARY_VALUE_CLASS} text-emerald-300`}>{formatCurrency(colaRemovedMonthlySavings)}/mo</span></div>
                    <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Lifetime Savings</span><span className={`${SUMMARY_VALUE_CLASS} text-emerald-300`}>{formatCurrency(colaRemovedLifetimeSavings)}</span></div>
                    <div className={SUMMARY_ROW_CLASS}><span className={SUMMARY_LABEL_CLASS}>Benefit Reduction</span><span className={`${SUMMARY_VALUE_CLASS} text-red-300`}>{formatCurrency(colaBenefitGivenUp)}</span></div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <Card className="module-chart-card disability-chart-panel financial-projection-chart module-visual-panel flex flex-col border-slate-800/80 bg-slate-950/60">
            <CardHeader className="shrink-0 px-6 pt-5 pb-0">
              <div className="grid gap-3">
                <CardTitle className="text-center text-xs font-bold tracking-[0.15em] whitespace-nowrap text-slate-500 uppercase">Income vs. Disability Coverage — Annual Projection</CardTitle>
                <div className="flex min-h-8 items-center gap-3">
                  {selectedAge !== null ? <div className="flex items-center gap-2"><span className="rounded-full border border-blue-700 bg-blue-900/40 px-3 py-1 text-xs font-semibold text-blue-300">Age {selectedAge}</span><button onClick={() => setSelectedAge(null)} className="text-xs text-gray-400 transition-colors hover:text-gray-100" aria-label="Reset to current age">× Reset</button></div> : null}
                  {onAssumptionsChange ? (
                    <button type="button" onClick={toggleCola} aria-pressed={colaRemoved} title={colaRemoved ? "Restore COLA benefit growth" : "Remove COLA from this comparison"} className="group ml-auto flex shrink-0 items-center gap-2.5 rounded-full border border-slate-700/80 bg-slate-900/70 py-1.5 pr-1.5 pl-3 text-left text-slate-200 shadow-sm transition-colors hover:border-[#1db8b9] hover:bg-[#1db8b9]/15 hover:text-[#1db8b9] dark:hover:text-white">
                      <span className="text-xs font-semibold whitespace-nowrap">{colaCurrentMode}</span>
                      <span className={`relative h-5 w-9 shrink-0 rounded-full shadow-inner transition-colors ${colaRemoved ? "bg-[#fbb040]" : "bg-[#1db8b9]"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all ${colaRemoved ? "left-0.5" : "left-4.5"}`} /></span>
                    </button>
                  ) : null}
                </div>
                <div className="flex justify-center sm:justify-end">
                  <div className="flex shrink-0 gap-0.5 rounded-lg border border-[#cbdadd]/90 bg-white/55 p-0.5 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_3px_12px_rgba(15,42,58,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_14px_rgba(0,0,0,0.18)]" role="group" aria-label="Income display basis">
                    <button type="button" onClick={() => setChartView("net")} aria-pressed={chartView === "net"} className={`relative rounded-md border px-3 py-1 font-semibold transition-all duration-200 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1db8b9] ${chartView === "net" ? "border-[#1db8b9]/65 bg-[#1db8b9]/14 text-[#0b6667] shadow-[0_3px_12px_rgba(29,184,185,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-[#1db8b9]/20 backdrop-blur-md dark:bg-[#1db8b9]/12 dark:text-[#8de3e3] dark:shadow-[0_3px_14px_rgba(29,184,185,0.12),inset_0_1px_0_rgba(255,255,255,0.1)]" : "border-transparent bg-transparent text-[#607583] hover:border-[#1db8b9]/30 hover:bg-[#1db8b9]/10 hover:text-[#188a89] dark:text-gray-300 dark:hover:text-[#8de3e3]"}`}>Net</button>
                    <button type="button" onClick={() => setChartView("gross")} aria-pressed={chartView === "gross"} className={`relative rounded-md border px-3 py-1 font-semibold transition-all duration-200 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1db8b9] ${chartView === "gross" ? "border-[#1db8b9]/65 bg-[#1db8b9]/14 text-[#0b6667] shadow-[0_3px_12px_rgba(29,184,185,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-[#1db8b9]/20 backdrop-blur-md dark:bg-[#1db8b9]/12 dark:text-[#8de3e3] dark:shadow-[0_3px_14px_rgba(29,184,185,0.12),inset_0_1px_0_rgba(255,255,255,0.1)]" : "border-transparent bg-transparent text-[#607583] hover:border-[#1db8b9]/30 hover:bg-[#1db8b9]/10 hover:text-[#188a89] dark:text-gray-300 dark:hover:text-[#8de3e3]"}`}>Gross</button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col px-6 pt-4 pb-6">
              <div className="flex min-h-0 flex-1 items-stretch gap-2">
                <div className="flex w-4 shrink-0 items-center justify-center"><span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="text-[10px] font-semibold tracking-wider whitespace-nowrap text-slate-500 uppercase">Annual Benefit ($)</span></div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="chart-reveal financial-projection-plot min-h-52 w-full flex-1">
                    <FinancialProjectionChart data={chartData.projectionChartData} ticks={ageTicks} onSelectAge={setSelectedAge}>
                      <Tooltip content={CustomTooltip} cursor={{ fill: financialBarChartTheme.cursor.fill }} />
                      <Bar dataKey={ltdLabel} stackId="a" barSize={projectionBarSize} fill={financialBarChartTheme.semantic.primaryCoverage} radius={topStackRadius(false)} shape={<UniformStackedBar />} isAnimationActive={animateChart} animationDuration={financialBarChartTheme.animation.duration} animationEasing={financialBarChartTheme.animation.easing}>
                        {chartData.projectionChartData.map((point) => {
                          const visual = projectionCellVisualState(selectedAge, point.age, financialBarChartTheme.semantic.primaryCoverageGlow)
                          const isTopSegment = Number(point["Individual DI"]) <= 0 && Number(point["Income Gap"]) <= 0
                          return <Cell key={`ltd-${point.age}`} radius={topStackCellRadius(isTopSegment)} opacity={visual.opacity} style={visual.style} />
                        })}
                      </Bar>
                      <Bar dataKey="Individual DI" stackId="a" barSize={projectionBarSize} fill={financialBarChartTheme.semantic.secondaryCoverage} radius={topStackRadius(false)} shape={<UniformStackedBar />} isAnimationActive={animateChart} animationBegin={financialBarChartTheme.animation.staggerMs} animationDuration={financialBarChartTheme.animation.duration} animationEasing={financialBarChartTheme.animation.easing}>
                        {chartData.projectionChartData.map((point) => {
                          const visual = projectionCellVisualState(selectedAge, point.age, financialBarChartTheme.semantic.secondaryCoverageGlow)
                          const isTopSegment = Number(point["Individual DI"]) > 0 && Number(point["Income Gap"]) <= 0
                          return <Cell key={`idi-${point.age}`} radius={topStackCellRadius(isTopSegment)} opacity={visual.opacity} style={visual.style} />
                        })}
                      </Bar>
                      <Bar dataKey="Income Gap" stackId="a" barSize={projectionBarSize} fill={financialBarChartTheme.semantic.gap} radius={topStackRadius(false)} shape={<UniformStackedBar />} isAnimationActive={animateChart} animationBegin={financialBarChartTheme.animation.staggerMs * 1.6} animationDuration={financialBarChartTheme.animation.duration} animationEasing={financialBarChartTheme.animation.easing}>
                        {chartData.projectionChartData.map((point) => {
                          const visual = projectionCellVisualState(selectedAge, point.age, financialBarChartTheme.semantic.gapGlow)
                          const isTopSegment = Number(point["Income Gap"]) > 0
                          return <Cell key={`gap-${point.age}`} radius={topStackCellRadius(isTopSegment)} opacity={visual.opacity} style={visual.style} />
                        })}
                      </Bar>
                    </FinancialProjectionChart>
                  </div>
                  <div className="mt-1 text-center"><span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Age</span></div>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-800/50 pt-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: financialBarChartTheme.semantic.primaryCoverage }} />{ltdLabel}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: financialBarChartTheme.semantic.secondaryCoverage }} />Individual DI</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: financialBarChartTheme.semantic.gap }} />Income Gap</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="module-metric-rail">
            <MetricGroup title="Monthly Benefits">
              <ModuleMetricCard label={assumedIncomeLabel} value={<>{formatCurrency(assumedIncomeDisplayMonthly)}<span className="text-sm font-normal text-gray-400">/mo</span></>} description="Monthly income basis used for the selected view" accent="neutral" />
              <ModuleMetricCard label={ltdLabel} value={<>{formatCurrency(ltdDisplayMonthly)}<span className="text-sm font-normal text-gray-400">/mo</span></>} description={chartView === "gross" ? "Gross monthly LTD benefit" : "Net after-tax LTD monthly benefit"} accent="primary" />
              <ModuleMetricCard label="Individual DI" value={<>{formatCurrency(monthly.individualDIMonthly)}<span className="text-sm font-normal text-gray-400">/mo</span></>} description="Private disability insurance benefit" accent="primary" />
              <ModuleMetricCard label={totalBenefitLabel} value={<>{formatCurrency(totalDisplayMonthly)}<span className="text-sm font-normal text-gray-400">/mo</span></>} description="Combined LTD + individual DI monthly benefit" accent="primary" />
              <ModuleMetricCard label={incomeLossLabel} value={<>{formatCurrency(incomeLossDisplayMonthly)}<span className="text-sm font-normal text-gray-400">/mo</span></>} description={incomeLossDescription} accent={incomeLossDisplayMonthly > 0 ? "negative" : "positive"} />
            </MetricGroup>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <AnimatedSection key={visualization} delay={0.3}>
        <div className="mb-4 flex flex-wrap gap-1">
          {([
            { value: "incomeGap", label: "Income Gap" },
            { value: "premiumVsSelfInsured", label: "Premium vs Self-Insured" },
            { value: "jobComparison", label: "Job A vs Job B" },
            { value: "assetComparison", label: "Asset Comparison" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setVisualization(value)}
              className={`rounded-md px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors ${visualization === value ? "border border-[#188a89] bg-[#188a89] text-white shadow-sm ring-1 ring-[#188a89]" : "border border-slate-800 bg-slate-900/40 text-slate-400 hover:border-[#1db8b9] hover:bg-[#1db8b9]/15 hover:text-[#1db8b9] dark:hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {renderVisualization()}
      </AnimatedSection>

      {visualization === "incomeGap" && mode === "builder" && (
        <AnimatedSection delay={0.46}>
          <Card className="border border-gray-800 bg-[#090E1A] text-white">
            <CardContent className="p-6">
              <h4 className="mb-2 text-xs font-semibold tracking-wider text-[#27aae1] uppercase">Planning Narrative</h4>
              <p className="text-sm leading-relaxed text-gray-300">{getDisabilityNarrative(outputs)}</p>
            </CardContent>
          </Card>
        </AnimatedSection>
      )}
    </div>
  )
}
