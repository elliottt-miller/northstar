import { Card } from "@/components/Card"
import { AnalysisCenter } from "@/components/global/AnalysisCenter"
import { ThemedSelect } from "@/components/ThemedSelect"
import { useAppStore } from "@/lib/store"
import { AppWindow, CodeXml, Settings2 } from "lucide-react"
import {
  RiFileTextLine,
  RiHeartPulseLine,
  RiLockLine,
  RiScalesLine,
  RiShieldCheckLine,
  RiUmbrellaLine,
} from "@remixicon/react"

// ─── Shared input components ──────────────────────────────────────────────────

function PercentInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      min={0}
      max={100}
      step={0.1}
      value={+(value * 100).toFixed(2)}
      onChange={(e) => onChange(parseFloat(e.target.value) / 100 || 0)}
      className="w-24 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-right text-sm font-semibold text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    />
  )
}

function ToggleSelect({
  value,
  onChange,
  trueLabel,
  falseLabel,
}: {
  value: boolean
  onChange: (v: boolean) => void
  trueLabel?: string
  falseLabel?: string
}) {
  return (
    <ThemedSelect value={value ? "true" : "false"} onValueChange={(next) => onChange(next === "true")} options={[{ value: "true", label: trueLabel ?? "Yes" }, { value: "false", label: falseLabel ?? "No" }]} className="min-w-40 font-semibold" />
  )
}

function EnumSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <ThemedSelect value={value} onValueChange={(next) => onChange(next as T)} options={options} className="min-w-48 font-semibold" />
  )
}

function LockedValue({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-gray-800 px-2.5 py-1 text-sm font-semibold text-gray-400">
      {label}
    </span>
  )
}

function Row({
  label,
  description,
  locked,
  children,
}: {
  label: string
  description: string
  locked?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-200">{label}</p>
          {locked && (
            <span className="flex items-center gap-1 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
              <RiLockLine className="size-3" aria-hidden="true" />
              Locked
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AssumptionsPage() {
  const lifeA = useAppStore((s) => s.globalLifeAssumptions)
  const disabilityA = useAppStore((s) => s.globalDisabilityAssumptions)
  const updateLife = useAppStore((s) => s.updateGlobalLifeAssumptions)
  const updateDisability = useAppStore((s) => s.updateGlobalDisabilityAssumptions)
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold text-gray-50">Assumptions & Model Governance</h1>
          <AnalysisCenter
            trigger={(
              <button
                type="button"
                aria-label="Open calculation analysis center"
                title="Open calculation analysis center"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#c8d7db] bg-[#f4f8f9] text-[#607583] shadow-sm transition-all hover:border-[#188a89]/55 hover:bg-[#188a89]/10 hover:text-[#188a89] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#188a89] dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-400 dark:shadow-none dark:hover:border-[#188a89]/70 dark:hover:bg-[#188a89]/15 dark:hover:text-white"
              >
                <span className="relative block size-5" aria-hidden="true">
                  <AppWindow className="absolute inset-0 size-5" strokeWidth={1.8} />
                  <CodeXml className="absolute left-1 top-[0.42rem] size-3" strokeWidth={2.25} />
                  <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-[#f4f8f9] dark:bg-gray-900">
                    <Settings2 className="size-3" strokeWidth={2.25} />
                  </span>
                </span>
              </button>
            )}
          />
        </div>
        <p className="text-sm text-gray-400">
          Default modeling assumptions applied to all new scenarios. Changes take effect for
          scenarios created after saving — existing scenario calculations are unaffected.
        </p>
      </div>

      {/* ── Life Insurance ───────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border border-emerald-900/30 p-0">
        <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-4">
          <RiHeartPulseLine className="size-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Life Insurance</h2>
            <p className="text-xs text-gray-500">Formula v1.0.0</p>
          </div>
        </div>
        <div className="divide-y divide-gray-800/50">
          <Row label="Discount rate (annual)" description="Rate used to discount future income replacement need to present value.">
            <PercentInput value={lifeA.discountRateAnnual} onChange={(v) => updateLife({ discountRateAnnual: v })} />
          </Row>
          <Row label="Income growth rate (annual)" description="Annual income growth / inflation assumption applied to projected income needs.">
            <PercentInput value={lifeA.incomeGrowthRateAnnual} onChange={(v) => updateLife({ incomeGrowthRateAnnual: v })} />
          </Row>
          <Row label="Inflation rate (annual)" description="General inflation rate used for expense projections.">
            <PercentInput value={lifeA.inflationRateAnnual} onChange={(v) => updateLife({ inflationRateAnnual: v })} />
          </Row>
          <Row label="Death benefit income yield (annual)" description="Annualized return used to translate a lump-sum death benefit into annual replacement income.">
            <PercentInput
              value={lifeA.deathBenefitIncomeYieldAnnual ?? 0.05}
              onChange={(v) => updateLife({ deathBenefitIncomeYieldAnnual: v })}
            />
          </Row>
          <Row label="Use present value discounting" description="When enabled, projects and discounts future income needs to present value.">
            <ToggleSelect
              value={lifeA.usePresentValue}
              onChange={(v) => updateLife({ usePresentValue: v })}
              trueLabel="Enabled"
              falseLabel="Disabled (nominal)"
            />
          </Row>
          <Row label="Liquid asset offset" description="When enabled, advisor-specified liquid assets reduce the modeled protection gap.">
            <ToggleSelect
              value={lifeA.includeLiquidAssetsOffset}
              onChange={(v) => updateLife({ includeLiquidAssetsOffset: v })}
              trueLabel="Included"
              falseLabel="Excluded"
            />
          </Row>
          <Row label="Death benefit tax treatment" description="How life insurance proceeds are treated for tax modeling.">
            <EnumSelect
              value={lifeA.deathBenefitTaxTreatment}
              options={[
                { value: "generally_income_tax_free", label: "Generally income-tax free" },
                { value: "not_modeled", label: "Not modeled" },
              ]}
              onChange={(v) => updateLife({ deathBenefitTaxTreatment: v })}
            />
          </Row>
        </div>
      </Card>

      {/* ── Disability Insurance ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden border border-blue-900/40 p-0">
        <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-4">
          <RiUmbrellaLine className="size-5 shrink-0 text-blue-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Disability Insurance</h2>
            <p className="text-xs text-gray-500">Formula v2.0.0</p>
          </div>
        </div>
        <div className="divide-y divide-gray-800/50">
          <Row label="Income growth rate (annual)" description="Annual rate at which client income is projected to grow through retirement in the disability coverage chart.">
            <PercentInput value={disabilityA.incomeGrowthRateAnnual} onChange={(v) => updateDisability({ incomeGrowthRateAnnual: v })} />
          </Row>
          <Row label="Group LTD taxability factor" description="When a group LTD benefit is marked taxable, the net benefit displayed is 70% of the gross benefit." locked>
            <LockedValue label="70% of gross" />
          </Row>
          <Row label="Premium reduction without COLA" description="Assumed reduction to the entered Individual DI premium when modeling a policy without COLA. Applied consistently in disability comparisons.">
            <PercentInput value={disabilityA.colaRemovedPremiumReductionRate ?? 0.20} onChange={(v) => updateDisability({ colaRemovedPremiumReductionRate: v })} />
          </Row>
        </div>
      </Card>

      {/* ── Unemployment ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border border-indigo-900/30 p-0">
        <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-4">
          <RiShieldCheckLine className="size-5 shrink-0 text-indigo-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Unemployment</h2>
            <p className="text-xs text-gray-500">Formula v1.0.0</p>
          </div>
        </div>
        <div className="divide-y divide-gray-800/50">
          <Row label="Reserve drawdown priority" description="Order in which reserves are drawn down during the modeled period." locked>
            <LockedValue label="Emergency savings first" />
          </Row>
          <Row label="Spouse income offset" description="Whether spouse/partner income is included as an available resource." locked>
            <LockedValue label="Included if entered" />
          </Row>
        </div>
      </Card>

      {/* ── Liability / Lawsuit ──────────────────────────────────────────────── */}
      <Card className="overflow-hidden border border-orange-900/30 p-0">
        <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-4">
          <RiScalesLine className="size-5 shrink-0 text-orange-400" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Liability / Lawsuit</h2>
            <p className="text-xs text-gray-500">Formula v1.0.0</p>
          </div>
        </div>
        <div className="divide-y divide-gray-800/50">
          <Row label="Existing liability coverage" description="Current liability coverage limits are advisor-entered per scenario." locked>
            <LockedValue label="Advisor-entered" />
          </Row>
          <Row label="Umbrella policy inclusion" description="A personal umbrella policy is counted as an offset when entered." locked>
            <LockedValue label="Included if entered" />
          </Row>
        </div>
      </Card>

      {/* Compliance footer */}
      <div className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4">
        <RiFileTextLine className="mt-0.5 size-4 shrink-0 text-gray-600" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-gray-600">
          <span className="font-semibold text-gray-500">Assumption governance.</span>{" "}
          All assumption values shown here are system defaults used for illustrative scenario modeling only.
          They do not represent guaranteed results, tax advice, legal advice, underwriting determinations, or
          product recommendations. Advisors should review and adjust assumptions for each client scenario
          based on professional judgment and client-specific context.
        </p>
      </div>
    </div>
  )
}
