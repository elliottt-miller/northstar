import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ModuleMetricCard, type MetricCardAccent } from "@/features/risk-modules/core/ModuleMetricCard"
import { formatCurrency } from "@/lib/utils"
import type { DisabilityAssumptions, DisabilityInputs, DisabilityOtherAsset, DisabilityOutputs } from "../types"
import { calculateAssetComparisonTotals } from "../calculations/disabilityComparisons"

interface AssetComparisonModuleProps {
  inputs?: DisabilityInputs
  outputs: DisabilityOutputs
  assumptions?: DisabilityAssumptions
  onInputsChange?: (next: DisabilityInputs) => void
}

type AssetPremiumRow = DisabilityOtherAsset

type ComparisonDatum = {
  name: string
  value: number
  premium: number
  valueColor: string
  premiumColor: string
}

const DEFAULT_ASSET_ROWS: AssetPremiumRow[] = [
  { id: "asset-default-home", label: "Home", assetValue: 0, annualPremium: 0 },
  { id: "asset-default-auto", label: "Auto", assetValue: 0, annualPremium: 0 },
]

// Brand-manual color roles for the paired comparison. The two source groups
// use primary/lite partners from the blue and teal families; the calculated
// difference uses green for value and Polaris for the premium variance.
const ASSET_COMPARISON_COLORS = {
  otherAssets: { valueColor: "#1b75bc", premiumColor: "#188a89" },
  incomeAsset: { valueColor: "#27aae1", premiumColor: "#1db8b9" },
  difference: { valueColor: "#44b649", premiumColor: "#f15a29" },
} as const

function nextRowId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not available"
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function safeAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function formatMultiplier(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not available"
  if (value >= 100) return `${value.toFixed(0)}×`
  if (value >= 10) return `${value.toFixed(1)}×`
  return `${value.toFixed(2)}×`
}

function barHeight(value: number, max: number, minimumPct = 8, scaleMode: "linear" | "sqrt" = "linear"): string {
  if (value <= 0 || max <= 0) return "0%"
  const ratio = value / max
  const scaledRatio = scaleMode === "sqrt" ? Math.sqrt(ratio) : ratio
  return `${Math.max(minimumPct, scaledRatio * 100)}%`
}

function InteractiveBar({ category, metric, value, max, color, delay, minimumPct, scaleMode }: { category: string; metric: string; value: number; max: number; color: string; delay: number; minimumPct?: number; scaleMode?: "linear" | "sqrt" }) {
  const formattedValue = formatCurrency(value)
  return (
    <div
      role="img"
      tabIndex={0}
      aria-label={`${category} ${metric.toLowerCase()}: ${formattedValue}`}
      className="group/bar relative mx-auto w-full max-w-20 cursor-default rounded-t-md outline-none transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:-translate-y-0.5 focus-visible:brightness-110"
      style={{ height: barHeight(value, max, minimumPct, scaleMode) }}
    >
      <span className="asset-comparison-bar pointer-events-none absolute inset-0 rounded-t-md" style={{ backgroundColor: color, animationDelay: `${delay}ms` }} />
      <span className="pointer-events-none absolute inset-0 rounded-t-md opacity-0 shadow-[0_0_22px_currentColor] transition-opacity duration-200 group-hover/bar:opacity-30 group-focus-visible/bar:opacity-30" style={{ color }} />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-44 -translate-x-1/2 translate-y-1 rounded-lg border border-slate-700/80 bg-slate-950/95 px-2.5 py-2 text-center opacity-0 shadow-xl backdrop-blur-sm transition-all duration-150 group-hover/bar:translate-y-0 group-hover/bar:opacity-100 group-focus-visible/bar:translate-y-0 group-focus-visible/bar:opacity-100">
        <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{category} · {metric}</span>
        <span className="mt-0.5 block text-xs font-bold tabular-nums text-slate-100">{formattedValue}</span>
      </span>
    </div>
  )
}

function EfficiencyCard({ label, rate, accent }: { label: string; rate: number | null; accent: MetricCardAccent }) {
  return (
    <ModuleMetricCard
      label={label}
      value={formatRate(rate)}
      description="Annual cost per $1,000 protected"
      accent={accent}
    />
  )
}

function ComparisonCard({ ratio }: { ratio: number | null }) {
  let description = "Enter non-zero values and premiums to calculate the comparison."
  if (ratio !== null && Number.isFinite(ratio)) {
    if (Math.abs(ratio - 1) < 0.005) description = "Both assets have approximately the same annual cost per $1,000 protected."
    else if (ratio > 1) description = `Other assets cost ${formatMultiplier(ratio)} more per $1,000 protected.`
    else if (ratio > 0) description = `Income protection costs ${formatMultiplier(1 / ratio)} more per $1,000 protected.`
  }

  return (
    <ModuleMetricCard
      label="Cost efficiency comparison"
      value={formatMultiplier(ratio)}
      description={description}
      accent="neutral"
    />
  )
}

function ComparisonColumn({ datum, columnIndex, valueMax, premiumMax, minimumBarPct, scaleMode }: { datum: ComparisonDatum; columnIndex: number; valueMax: number; premiumMax: number; minimumBarPct?: number; scaleMode?: "linear" | "sqrt" }) {
  return (
    <section className="asset-comparison-column min-w-0 px-3 py-1 first:pl-0 last:pr-0 lg:border-l lg:border-slate-800/80 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0">
      <h3 className="text-center text-[11px] font-bold uppercase tracking-[0.17em] text-slate-100">{datum.name}</h3>
      <div className="asset-comparison-bars mt-4 grid h-52 grid-cols-2 items-end gap-4 border-b border-slate-700/80 px-4">
        <div className="flex h-full min-w-0 flex-col justify-end">
          <div className="mb-2 text-center">
            <p className="text-xs font-bold tabular-nums text-slate-100">{formatCurrency(datum.value)}</p>
          </div>
          <InteractiveBar category={datum.name} metric="Value" value={datum.value} max={valueMax} color={datum.valueColor} delay={columnIndex * 140} minimumPct={minimumBarPct} scaleMode={scaleMode} />
        </div>
        <div className="flex h-full min-w-0 flex-col justify-end">
          <div className="mb-2 text-center">
            <p className="text-xs font-bold tabular-nums text-slate-100">{formatCurrency(datum.premium)}</p>
          </div>
          <InteractiveBar category={datum.name} metric="Annual premium" value={datum.premium} max={premiumMax} color={datum.premiumColor} delay={columnIndex * 140 + 70} minimumPct={minimumBarPct} scaleMode={scaleMode} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 px-4 pt-2 text-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Value</p>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Annual premium</p>
      </div>
    </section>
  )
}

export function AssetComparisonModule({ inputs, outputs, assumptions, onInputsChange }: AssetComparisonModuleProps) {
  const canEditAssets = Boolean(inputs && onInputsChange)
  const [fallbackRows, setFallbackRows] = useState<AssetPremiumRow[]>(DEFAULT_ASSET_ROWS)
  const assetRows = canEditAssets ? (inputs!.otherAssets ?? DEFAULT_ASSET_ROWS) : fallbackRows
  const totals = useMemo(
    () => calculateAssetComparisonTotals(
      assetRows,
      inputs?.privateDiMonthlyPremium ?? 0,
      outputs.totalIndividualDICoverage,
      assumptions,
    ),
    [assetRows, assumptions, inputs?.privateDiMonthlyPremium, outputs.totalIndividualDICoverage],
  )
  const annualIncomeInsuranceCost = totals.annualIncomeInsuranceCost
  const netIncomeAsset = totals.projectedIndividualDIBenefits
  const [assetsExpanded, setAssetsExpanded] = useState(false)
  const collapsedAssetLimit = 4
  const hasHiddenAssets = assetRows.length > collapsedAssetLimit
  const visibleAssetRows = assetsExpanded || !hasHiddenAssets ? assetRows : assetRows.slice(0, collapsedAssetLimit)
  const reportAssetRows = assetRows.filter((row) => row.label.trim() || row.assetValue > 0 || row.annualPremium > 0)

  const annualOtherAssetInsuranceCost = totals.annualOtherAssetInsuranceCost
  const totalAssetValue = totals.totalAssetValue
  const valueDifference = totals.valueDifference
  const costDifference = totals.costDifference
  const otherCostPerThousand = totals.otherCostPerThousand
  const incomeCostPerThousand = totals.incomeCostPerThousand
  const costRatio = totals.costRatio

  const chartData: ComparisonDatum[] = [
    { name: "Other Assets", value: safeAmount(totalAssetValue), premium: safeAmount(annualOtherAssetInsuranceCost), ...ASSET_COMPARISON_COLORS.otherAssets },
    { name: "Projected DI Benefits", value: safeAmount(netIncomeAsset), premium: safeAmount(annualIncomeInsuranceCost), ...ASSET_COMPARISON_COLORS.incomeAsset },
    { name: "Difference", value: valueDifference, premium: costDifference, ...ASSET_COMPARISON_COLORS.difference },
  ]
  const valueMax = Math.max(...chartData.map((row) => row.value), 1)
  const premiumMax = Math.max(...chartData.map((row) => row.premium), 1)
  const sourceAssetScaleMax = Math.max(chartData[0].value, chartData[0].premium, chartData[1].value, chartData[1].premium, 1)

  const commitAssetRows = (next: AssetPremiumRow[]) => {
    if (canEditAssets) onInputsChange!({ ...inputs!, otherAssets: next })
    else setFallbackRows(next)
  }

  const addAssetRow = () => commitAssetRows([...assetRows, { id: nextRowId(), label: "", assetValue: 0, annualPremium: 0 }])
  const removeAssetRow = (id: string) => commitAssetRows(assetRows.filter((row) => row.id !== id))
  const updateAssetRowLabel = (id: string, label: string) => commitAssetRows(assetRows.map((row) => row.id === id ? { ...row, label } : row))
  const updateAssetRowValue = (id: string, assetValue: number) => commitAssetRows(assetRows.map((row) => row.id === id ? { ...row, assetValue } : row))
  const updateAssetRowPremium = (id: string, annualPremium: number) => commitAssetRows(assetRows.map((row) => row.id === id ? { ...row, annualPremium } : row))

  return (
    <div className="asset-comparison-report module-output-container space-y-4">
      <Card className="asset-comparison-editor border-gray-800 bg-gray-900/25">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Other Asset Premiums</span>
            <button type="button" onClick={addAssetRow} disabled={!canEditAssets} className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-semibold text-gray-400 transition hover:border-brand-600 hover:text-brand-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-700 disabled:hover:text-gray-400">
              <Plus className="h-3.5 w-3.5" /> Add Asset
            </button>
          </div>

          {assetRows.length === 0 ? <p className="mt-2 rounded-lg border border-gray-800 px-3 py-4 text-center text-xs text-gray-500">No other assets added yet.</p> : null}
          {assetRows.length > 0 ? <div className="mt-3 grid gap-2 xl:grid-cols-2">{[0, 1].map((columnIndex) => <div key={columnIndex} className={`${columnIndex === 1 ? "hidden xl:grid" : "grid"} grid-cols-[minmax(8rem,1fr)_minmax(6rem,.7fr)_minmax(6rem,.7fr)_1.75rem] items-center gap-2 px-2.5 xl:grid-cols-[minmax(12rem,1fr)_11rem_11rem_1.75rem]`}><span className="min-w-0 text-[9px] font-bold uppercase tracking-widest text-gray-500">Asset Name</span><span className="text-center text-[9px] font-bold uppercase tracking-widest text-gray-500">Value</span><span className="text-center text-[9px] font-bold uppercase tracking-widest text-gray-500">Insure</span><span /></div>)}</div> : null}

          <div className="mt-1.5 grid gap-2 xl:grid-cols-2">
            {visibleAssetRows.map((row) => (
              <div key={row.id} className="asset-entry-row group grid grid-cols-[minmax(8rem,1fr)_minmax(6rem,.7fr)_minmax(6rem,.7fr)_1.75rem] items-center gap-2 rounded-lg border border-[#cbdadd] bg-[#f4f8f9] px-2.5 py-2 shadow-[0_1px_2px_rgba(15,42,58,0.04)] transition duration-200 focus-within:border-[#1db8b9] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(29,184,185,0.12)] dark:border-[#59616b] dark:bg-[#343a42] dark:focus-within:bg-[#3a4048] xl:grid-cols-[minmax(12rem,1fr)_11rem_11rem_1.75rem]">
                <input type="text" value={row.label} onChange={(event) => updateAssetRowLabel(row.id, event.target.value)} disabled={!canEditAssets} placeholder="Asset name" className="h-7 min-w-0 w-full rounded-md border border-transparent bg-transparent px-1.5 text-sm font-semibold text-gray-100 outline-none transition focus:border-gray-700 focus:bg-gray-950 disabled:opacity-60" />
                <Input type="number" min={0} step={1000} prefix="$" groupThousands value={row.assetValue || ""} onChange={(event) => updateAssetRowValue(row.id, Math.max(0, Number(event.target.value) || 0))} disabled={!canEditAssets} placeholder="0" aria-label={`${row.label || "Asset"} value`} title="Value of asset" className="min-w-0" inputClassName="h-7 border-transparent bg-transparent pr-2 text-right text-sm outline-none focus:border-gray-700 focus:bg-gray-950" />
                <Input type="number" min={0} step={50} prefix="$" groupThousands value={row.annualPremium || ""} onChange={(event) => updateAssetRowPremium(row.id, Math.max(0, Number(event.target.value) || 0))} disabled={!canEditAssets} placeholder="0" aria-label={`${row.label || "Asset"} annual insurance cost`} title="Annual cost to insure" className="min-w-0" inputClassName="h-7 border-transparent bg-transparent pr-2 text-right text-sm font-semibold outline-none focus:border-gray-700 focus:bg-gray-950" />
                <button type="button" onClick={() => removeAssetRow(row.id)} disabled={!canEditAssets} aria-label="Remove asset" className="flex h-7 w-7 items-center justify-center rounded text-gray-600 opacity-0 transition hover:bg-[#fde9e6] hover:text-[#a92d20] group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 dark:hover:bg-[#8f3124]/45 dark:hover:text-[#ffc7bf]"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          {hasHiddenAssets ? (
            <div className="mt-2 flex justify-center">
              <button type="button" onClick={() => setAssetsExpanded((expanded) => !expanded)} aria-label={assetsExpanded ? "Collapse asset list" : "Expand asset list"} className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-800 hover:text-gray-300">{assetsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="asset-comparison-print-assets hidden">
        <div className="asset-comparison-print-assets-heading">
          <h3>Other Asset Premiums</h3>
          <p>Entered asset values and annual protection costs used in this comparison.</p>
        </div>
        {reportAssetRows.length > 0 ? (
          <div className="asset-comparison-print-asset-grid">
            {reportAssetRows.map((row) => {
              const costPerThousand = row.assetValue > 0 ? (row.annualPremium / row.assetValue) * 1_000 : null
              return (
                <article key={row.id} className="asset-comparison-print-asset-card">
                  <h4>{row.label.trim() || "Other Asset"}</h4>
                  <div><span>Asset Value</span><strong>{formatCurrency(row.assetValue)}</strong></div>
                  <div><span>Annual Premium</span><strong>{formatCurrency(row.annualPremium)}</strong></div>
                  <div><span>Cost per $1,000</span><strong>{formatRate(costPerThousand)}</strong></div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="asset-comparison-print-empty">No other assets were entered for this comparison.</p>
        )}
      </section>

      <Card className="asset-comparison-visual module-chart-card border-slate-800/80 bg-slate-950/60">
        <CardContent className="p-5">
          <div className="border-b border-slate-800/70 pb-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Asset Protection Comparison</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Compare advisor-entered annual asset premiums with the annual Individual DI premium and projected benefits through retirement.</p>
            </div>
          </div>

          <div className="asset-comparison-columns mt-5 grid gap-6 lg:grid-cols-3 lg:gap-0">
            <ComparisonColumn datum={chartData[0]} columnIndex={0} valueMax={sourceAssetScaleMax} premiumMax={sourceAssetScaleMax} minimumBarPct={1} scaleMode="sqrt" />
            <ComparisonColumn datum={chartData[1]} columnIndex={1} valueMax={sourceAssetScaleMax} premiumMax={sourceAssetScaleMax} minimumBarPct={1} scaleMode="sqrt" />
            <ComparisonColumn datum={chartData[2]} columnIndex={2} valueMax={valueMax} premiumMax={premiumMax} />
          </div>

        </CardContent>
      </Card>

      <div className="asset-comparison-metrics grid gap-3 sm:grid-cols-3">
        <EfficiencyCard label="Other Asset" rate={otherCostPerThousand} accent="primary" />
        <EfficiencyCard label="Projected DI Benefits" rate={incomeCostPerThousand} accent="primary" />
        <ComparisonCard ratio={costRatio} />
      </div>
    </div>
  )
}
