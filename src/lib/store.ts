import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { LifeInputs, LifeAssumptions, LifeOutputs } from "@/features/risk-modules/life/types"
import type { DisabilityInputs, DisabilityAssumptions, DisabilityOutputs } from "@/features/risk-modules/disability/types"
import type { UnemploymentInputs, UnemploymentOutputs } from "@/features/risk-modules/unemployment/types"
import type { LiabilityInputs, LiabilityOutputs } from "@/features/risk-modules/liability/types"
import { sanitizeLifeInputs } from "@/features/risk-modules/life/utils/sanitizeLifeInputs"
import type {
  ClientFinancialProfile,
  ClientRecord,
  ClientStatus,
  ClientType,
  CreateClientPayload,
  CreateScenarioPayload,
  DisabilityModuleRecord,
  LiabilityModuleRecord,
  LifeModuleRecord,
  PersistedAppData,
  ProfileCompletionStatus,
  RiskModuleType,
  ScenarioModuleRecords,
  ScenarioRecord,
  ScenarioStatus,
  UnemploymentModuleRecord,
} from "./store-types"

export type {
  RiskModuleType,
  ClientStatus,
  ProfileCompletionStatus,
  ScenarioStatus,
  ClientType,
  ClientFinancialProfile,
  ClientRecord,
  ScenarioRecord,
  LifeModuleRecord,
  DisabilityModuleRecord,
  UnemploymentModuleRecord,
  LiabilityModuleRecord,
  ScenarioModuleRecords,
  CreateClientPayload,
  CreateScenarioPayload,
  PersistedAppData,
} from "./store-types"

const DEFAULT_ADVISOR_ID = "local-advisor"
const DEFAULT_RETIREMENT_AGE = 65

const defaultLifeAssumptions: LifeAssumptions = {
  inflationRateAnnual: 0.03,
  discountRateAnnual: 0.04,
  incomeGrowthRateAnnual: 0.03,
  usePresentValue: false,
  includeLiquidAssetsOffset: false,
  deathBenefitTaxTreatment: "generally_income_tax_free",
  deathBenefitIncomeYieldAnnual: 0.05,
}

const defaultDisabilityAssumptions: DisabilityAssumptions = {
  incomeGrowthRateAnnual: 0.03,
  colaRemovedPremiumReductionRate: 0.20,
}

function nowIso() { return new Date().toISOString() }
function toDisplayName(firstName: string, lastName: string, displayName?: string) {
  return displayName?.trim() || `${firstName.trim()} ${lastName.trim()}`.trim()
}

function getProfileCompletion(profile: ClientFinancialProfile): ProfileCompletionStatus {
  if (!profile.primaryIncomeEarnerName || !profile.currentAge || !profile.annualEarnedIncome) return "missing_required_info"
  if (
    profile.monthlyHouseholdExpenses !== undefined &&
    profile.emergencySavings !== undefined &&
    profile.groupLifeCoverage !== undefined &&
    profile.privateLifeCoverage !== undefined &&
    profile.nonQualifiedAssets !== undefined &&
    profile.homeEquity !== undefined &&
    profile.autoLiabilityLimit !== undefined &&
    profile.umbrellaCoverage !== undefined
  ) return "ready_full_analysis"
  return "ready_basic_analysis"
}

function getClientStatus(profile: ClientFinancialProfile): ClientStatus {
  return profile.annualEarnedIncome ? "active" : "draft"
}

function buildProfileFromPayload(id: string, payload: CreateClientPayload): ClientFinancialProfile {
  const firstName = payload.firstName.trim()
  const lastName = payload.lastName.trim()
  const clientType = payload.clientType ?? "individual"
  const nonQualifiedAssets = payload.nonQualifiedAssets ?? 0
  return {
    clientId: id,
    clientType,
    primaryIncomeEarnerName: `${firstName} ${lastName}`.trim(),
    currentAge: payload.age,
    expectedRetirementAge: payload.expectedRetirementAge ?? DEFAULT_RETIREMENT_AGE,
    annualEarnedIncome: payload.annualIncome,
    spouseIncomeEarnerName: clientType === "couple" ? payload.spouseName?.trim() : "",
    spouseCurrentAge: clientType === "couple" ? payload.spouseAge : undefined,
    spouseAnnualIncome: clientType === "couple" ? payload.spouseAnnualIncome ?? 0 : 0,
    monthlyHouseholdExpenses: payload.monthlyExpenses,
    emergencySavings: payload.emergencySavings ?? 0,
    dependents: 0,
    debtsTotal: 0,
    educationFundingGoal: 0,
    finalExpenses: 25000,
    groupLifeCoverage: payload.groupLifeCoverage ?? 0,
    privateLifeCoverage: payload.privateLifeCoverage ?? 0,
    spouseGroupLifeCoverage: clientType === "couple" ? payload.spouseGroupLifeCoverage ?? 0 : 0,
    spousePrivateLifeCoverage: clientType === "couple" ? payload.spousePrivateLifeCoverage ?? 0 : 0,
    nonQualifiedAssets,
    spouseNonQualifiedAssets: clientType === "couple" ? payload.spouseNonQualifiedAssets ?? 0 : 0,
    employerStdBenefitMonthly: 0,
    employerLtdBenefitMonthly: 0,
    ltdCoveragePercent: payload.ltdCoveragePercent ?? 0.60,
    ltdMonthlyCap: payload.ltdMonthlyCap ?? 0,
    ltdTaxable: payload.ltdTaxable ?? true,
    privateDisabilityBenefitMonthly: payload.privateDisabilityBenefitMonthly ?? 0,
    privateDisabilityMonthlyPremium: payload.privateDisabilityMonthlyPremium ?? 0,
    privateDisabilityBenefitPeriod: payload.privateDisabilityBenefitPeriod ?? "",
    disabilityBreakEvenRateOfReturn: payload.disabilityBreakEvenRateOfReturn ?? 0.06,
    disabilityBreakEvenMonthsWithoutIncome: payload.disabilityBreakEvenMonthsWithoutIncome ?? 12,
    stateBenefitEstimateMonthly: 0,
    homeValue: 0,
    mortgageBalance: 0,
    homeEquity: payload.homeEquity ?? 0,
    savingsAssets: payload.emergencySavings ?? 0,
    investmentAssets: nonQualifiedAssets,
    autoLiabilityLimit: payload.autoLiabilityLimit ?? 0,
    umbrellaCoverage: payload.umbrellaCoverage ?? 0,
  }
}

function buildUpdatedProfile(client: ClientRecord, updates: Partial<CreateClientPayload>, firstName: string, lastName: string): ClientFinancialProfile {
  const nextClientType = updates.clientType ?? client.profile.clientType ?? "individual"
  const nonQualifiedAssets = updates.nonQualifiedAssets ?? client.profile.nonQualifiedAssets ?? 0
  const homeEquity = updates.homeEquity ?? client.profile.homeEquity ?? Math.max(0, (client.profile.homeValue ?? 0) - (client.profile.mortgageBalance ?? 0))
  return {
    ...client.profile,
    clientType: nextClientType,
    primaryIncomeEarnerName: `${firstName} ${lastName}`.trim(),
    currentAge: updates.age ?? client.profile.currentAge,
    expectedRetirementAge: updates.expectedRetirementAge ?? client.profile.expectedRetirementAge ?? DEFAULT_RETIREMENT_AGE,
    annualEarnedIncome: updates.annualIncome ?? client.profile.annualEarnedIncome,
    monthlyHouseholdExpenses: updates.monthlyExpenses ?? client.profile.monthlyHouseholdExpenses,
    emergencySavings: updates.emergencySavings ?? client.profile.emergencySavings ?? 0,
    spouseIncomeEarnerName: nextClientType === "couple" ? updates.spouseName?.trim() ?? client.profile.spouseIncomeEarnerName : "",
    spouseCurrentAge: nextClientType === "couple" ? updates.spouseAge ?? client.profile.spouseCurrentAge : undefined,
    spouseAnnualIncome: nextClientType === "couple" ? updates.spouseAnnualIncome ?? client.profile.spouseAnnualIncome ?? 0 : 0,
    groupLifeCoverage: updates.groupLifeCoverage ?? client.profile.groupLifeCoverage,
    privateLifeCoverage: updates.privateLifeCoverage ?? client.profile.privateLifeCoverage,
    nonQualifiedAssets,
    spouseGroupLifeCoverage: nextClientType === "couple" ? updates.spouseGroupLifeCoverage ?? client.profile.spouseGroupLifeCoverage ?? 0 : 0,
    spousePrivateLifeCoverage: nextClientType === "couple" ? updates.spousePrivateLifeCoverage ?? client.profile.spousePrivateLifeCoverage ?? 0 : 0,
    spouseNonQualifiedAssets: nextClientType === "couple" ? updates.spouseNonQualifiedAssets ?? client.profile.spouseNonQualifiedAssets ?? 0 : 0,
    ltdCoveragePercent: updates.ltdCoveragePercent ?? client.profile.ltdCoveragePercent ?? 0.60,
    ltdMonthlyCap: updates.ltdMonthlyCap ?? client.profile.ltdMonthlyCap ?? 0,
    ltdTaxable: updates.ltdTaxable ?? client.profile.ltdTaxable ?? true,
    privateDisabilityBenefitMonthly: updates.privateDisabilityBenefitMonthly ?? client.profile.privateDisabilityBenefitMonthly ?? 0,
    privateDisabilityMonthlyPremium: updates.privateDisabilityMonthlyPremium ?? client.profile.privateDisabilityMonthlyPremium ?? 0,
    privateDisabilityBenefitPeriod: updates.privateDisabilityBenefitPeriod ?? client.profile.privateDisabilityBenefitPeriod ?? "",
    disabilityBreakEvenRateOfReturn: updates.disabilityBreakEvenRateOfReturn ?? client.profile.disabilityBreakEvenRateOfReturn ?? 0.06,
    disabilityBreakEvenMonthsWithoutIncome: updates.disabilityBreakEvenMonthsWithoutIncome ?? client.profile.disabilityBreakEvenMonthsWithoutIncome ?? 12,
    homeValue: 0,
    mortgageBalance: 0,
    homeEquity,
    savingsAssets: updates.emergencySavings ?? client.profile.emergencySavings ?? client.profile.savingsAssets ?? 0,
    investmentAssets: nonQualifiedAssets,
    autoLiabilityLimit: updates.autoLiabilityLimit ?? client.profile.autoLiabilityLimit ?? 0,
    umbrellaCoverage: updates.umbrellaCoverage ?? client.profile.umbrellaCoverage ?? 0,
  }
}

function prefillLifeInputs(profile: ClientFinancialProfile, clientId: string, scenarioId: string): LifeInputs {
  const yearsToRetirement = Math.max(0, (profile.expectedRetirementAge ?? DEFAULT_RETIREMENT_AGE) - (profile.currentAge ?? 40))
  return sanitizeLifeInputs({
    advisorId: DEFAULT_ADVISOR_ID,
    clientId,
    scenarioId,
    earnerName: profile.primaryIncomeEarnerName,
    currentAge: profile.currentAge ?? 40,
    retirementAge: profile.expectedRetirementAge ?? DEFAULT_RETIREMENT_AGE,
    annualIncome: profile.annualEarnedIncome ?? 0,
    spouseAnnualIncome: profile.clientType === "couple" ? profile.spouseAnnualIncome ?? 0 : 0,
    incomeReplacementYears: yearsToRetirement,
    incomeReplacementRatio: 0.70,
    groupLifeCoverage: profile.groupLifeCoverage ?? 0,
    privateLifeCoverage: profile.privateLifeCoverage ?? 0,
    nonQualifiedAssets: (profile.nonQualifiedAssets ?? 0) + (profile.spouseNonQualifiedAssets ?? 0),
    debtsTotal: profile.debtsTotal ?? 0,
    educationGoal: profile.educationFundingGoal ?? 0,
    finalExpenses: profile.finalExpenses ?? 25000,
    liquidAssetsAllocated: profile.savingsAssets ?? 0,
    netIncomeFactor: 0.85,
    incomeGapRoi: 0.05,
  })
}

function prefillDisabilityInputs(profile: ClientFinancialProfile, clientId: string, scenarioId: string): DisabilityInputs {
  return {
    advisorId: DEFAULT_ADVISOR_ID,
    clientId,
    scenarioId,
    annualEarnedIncome: profile.annualEarnedIncome ?? 0,
    currentAge: profile.currentAge ?? 40,
    retirementAge: profile.expectedRetirementAge ?? DEFAULT_RETIREMENT_AGE,
    ltdCoveragePercent: profile.ltdCoveragePercent ?? 0.60,
    ltdMonthlyCap: profile.ltdMonthlyCap ?? 0,
    ltdTaxable: profile.ltdTaxable ?? true,
    privateDiBenefitMonthly: profile.privateDisabilityBenefitMonthly ?? 0,
    privateDiBenefitPeriod: profile.privateDisabilityBenefitPeriod ?? "",
    privateDiMonthlyPremium: profile.privateDisabilityMonthlyPremium ?? 0,
    breakEvenRateOfReturn: profile.disabilityBreakEvenRateOfReturn ?? 0.06,
    breakEvenMonthsWithoutIncome: profile.disabilityBreakEvenMonthsWithoutIncome ?? 12,
  }
}

function prefillUnemploymentInputs(profile: ClientFinancialProfile): UnemploymentInputs {
  return {
    annualIncome: profile.annualEarnedIncome ?? 0,
    monthlyExpenses: profile.monthlyHouseholdExpenses ?? Math.round((profile.annualEarnedIncome ?? 0) / 12),
    emergencySavings: profile.emergencySavings ?? 0,
    severanceMonthly: 0,
    severanceDurationMonths: 0,
    unemploymentBenefitMonthly: 0,
    unemploymentBenefitDurationMonths: 0,
    estimatedJobSearchMonths: 6,
    spouseIncome: profile.clientType === "couple" ? profile.spouseAnnualIncome ?? 0 : 0,
  }
}

function prefillLiabilityInputs(profile: ClientFinancialProfile): LiabilityInputs {
  const nonQualifiedAssets = (profile.nonQualifiedAssets ?? 0) + (profile.spouseNonQualifiedAssets ?? 0)
  const legacyHomeEquity = Math.max(0, (profile.homeValue ?? 0) - (profile.mortgageBalance ?? 0))
  return {
    annualIncome: profile.annualEarnedIncome ?? 0,
    spouseAnnualIncome: profile.clientType === "couple" ? profile.spouseAnnualIncome ?? 0 : 0,
    currentAge: profile.currentAge ?? 40,
    spouseCurrentAge: profile.spouseCurrentAge ?? profile.currentAge ?? 40,
    retirementAge: profile.expectedRetirementAge ?? DEFAULT_RETIREMENT_AGE,
    garnishmentRate: 0.25,
    incomeGrowthRate: 0.03,
    disposableIncomeRatio: 0.65,
    nonQualifiedAssets,
    businessOwnershipValue: 0,
    homeEquity: profile.homeEquity ?? legacyHomeEquity,
    investmentAssets: profile.investmentAssets ?? nonQualifiedAssets,
    savingsAssets: profile.emergencySavings ?? profile.savingsAssets ?? 0,
    autoLiabilityLimit: profile.autoLiabilityLimit ?? 0,
    umbrellaCoverage: profile.umbrellaCoverage ?? 0,
  }
}

type SharedProjectionInputs = { annualIncome: number; currentAge: number; retirementAge: number }
function syncSharedAnnualIncome(records: ScenarioModuleRecords, annualIncome: number, timestamp: string): ScenarioModuleRecords {
  const synced: ScenarioModuleRecords = { ...records }
  if (synced.life) synced.life = { ...synced.life, inputs: { ...synced.life.inputs, annualIncome }, output: null, updatedAt: timestamp, lastCalculatedAt: undefined }
  if (synced.disability) synced.disability = { ...synced.disability, inputs: { ...synced.disability.inputs, annualEarnedIncome: annualIncome }, output: null, updatedAt: timestamp, lastCalculatedAt: undefined }
  if (synced.unemployment) synced.unemployment = { ...synced.unemployment, inputs: { ...synced.unemployment.inputs, annualIncome }, output: null, updatedAt: timestamp, lastCalculatedAt: undefined }
  if (synced.liability) synced.liability = { ...synced.liability, inputs: { ...synced.liability.inputs, annualIncome }, output: null, updatedAt: timestamp, lastCalculatedAt: undefined }
  return synced
}

function syncSharedProjectionInputs(records: ScenarioModuleRecords, shared: SharedProjectionInputs, timestamp: string): ScenarioModuleRecords {
  const synced = syncSharedAnnualIncome(records, shared.annualIncome, timestamp)
  const incomeReplacementYears = Math.max(0, shared.retirementAge - shared.currentAge)
  if (synced.life) synced.life = { ...synced.life, inputs: { ...synced.life.inputs, currentAge: shared.currentAge, retirementAge: shared.retirementAge, incomeReplacementYears } }
  if (synced.disability) synced.disability = { ...synced.disability, inputs: { ...synced.disability.inputs, currentAge: shared.currentAge, retirementAge: shared.retirementAge } }
  if (synced.liability) synced.liability = { ...synced.liability, inputs: { ...synced.liability.inputs, currentAge: shared.currentAge, retirementAge: shared.retirementAge } }
  return synced
}

function syncModuleRecordsForClientUpdate(state: AppState, clientId: string, profile: ClientFinancialProfile, timestamp: string) {
  const updatedRecords = { ...state.moduleRecordsByScenarioId }
  for (const scenario of state.scenarios) {
    if (scenario.clientId !== clientId) continue
    const existing = updatedRecords[scenario.id]
    if (!existing) continue
    updatedRecords[scenario.id] = {
      ...existing,
      life: existing.life ? { ...existing.life, inputs: prefillLifeInputs(profile, clientId, scenario.id), output: null, updatedAt: timestamp, lastCalculatedAt: undefined } : undefined,
      disability: existing.disability ? { ...existing.disability, inputs: prefillDisabilityInputs(profile, clientId, scenario.id), output: null, updatedAt: timestamp, lastCalculatedAt: undefined } : undefined,
      unemployment: existing.unemployment ? { ...existing.unemployment, inputs: prefillUnemploymentInputs(profile), output: null, updatedAt: timestamp, lastCalculatedAt: undefined } : undefined,
      liability: existing.liability ? { ...existing.liability, inputs: prefillLiabilityInputs(profile), output: null, updatedAt: timestamp, lastCalculatedAt: undefined } : undefined,
    }
  }
  return updatedRecords
}

function updateScenarioForSave(scenario: ScenarioRecord, timestamp: string): ScenarioRecord {
  return { ...scenario, status: scenario.status === "inputs_needed" || scenario.status === "draft" ? "calculated" : scenario.status, updatedAt: timestamp, lastCalculatedAt: timestamp }
}

interface AppState {
  clients: ClientRecord[]
  scenarios: ScenarioRecord[]
  moduleRecordsByScenarioId: Record<string, ScenarioModuleRecords>
  globalLifeAssumptions: LifeAssumptions
  globalDisabilityAssumptions: DisabilityAssumptions
  updateGlobalLifeAssumptions: (updates: Partial<LifeAssumptions>) => void
  updateGlobalDisabilityAssumptions: (updates: Partial<DisabilityAssumptions>) => void
  updateDisabilityAssumptions: (scenarioId: string, updates: Partial<DisabilityAssumptions>) => void
  createClient: (payload: CreateClientPayload) => string
  updateClient: (clientId: string, updates: Partial<CreateClientPayload>) => void
  archiveClient: (clientId: string) => void
  createScenario: (payload: CreateScenarioPayload) => string
  setScenarioActiveModule: (scenarioId: string, module: RiskModuleType) => void
  updateLifeInputs: (scenarioId: string, inputs: LifeInputs) => void
  updateDisabilityInputs: (scenarioId: string, inputs: DisabilityInputs) => void
  updateUnemploymentInputs: (scenarioId: string, inputs: UnemploymentInputs) => void
  updateLiabilityInputs: (scenarioId: string, inputs: LiabilityInputs) => void
  saveLifeCalculation: (scenarioId: string, output: LifeOutputs) => void
  saveDisabilityCalculation: (scenarioId: string, output: DisabilityOutputs) => void
  saveUnemploymentCalculation: (scenarioId: string, output: UnemploymentOutputs) => void
  saveLiabilityCalculation: (scenarioId: string, output: LiabilityOutputs) => void
  importAppData: (data: PersistedAppData) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      clients: [],
      scenarios: [],
      moduleRecordsByScenarioId: {},
      globalLifeAssumptions: { ...defaultLifeAssumptions },
      globalDisabilityAssumptions: { ...defaultDisabilityAssumptions },

      updateGlobalLifeAssumptions: (updates) => set((state) => ({ globalLifeAssumptions: { ...state.globalLifeAssumptions, ...updates } })),
      updateGlobalDisabilityAssumptions: (updates) => set((state) => ({ globalDisabilityAssumptions: { ...state.globalDisabilityAssumptions, ...updates } })),
      updateDisabilityAssumptions: (scenarioId, updates) => set((state) => {
        const record = state.moduleRecordsByScenarioId[scenarioId]?.disability
        if (!record) return state
        return {
          moduleRecordsByScenarioId: {
            ...state.moduleRecordsByScenarioId,
            [scenarioId]: {
              ...state.moduleRecordsByScenarioId[scenarioId],
              disability: {
                ...record,
                assumptions: { ...record.assumptions, ...updates },
                output: null,
                updatedAt: nowIso(),
                lastCalculatedAt: undefined,
              },
            },
          },
        }
      }),

      createClient: (payload) => {
        const timestamp = nowIso()
        const id = crypto.randomUUID()
        const firstName = payload.firstName.trim()
        const lastName = payload.lastName.trim()
        const profile = buildProfileFromPayload(id, payload)
        const record: ClientRecord = {
          id,
          ownerId: DEFAULT_ADVISOR_ID,
          firstName,
          lastName,
          displayName: toDisplayName(firstName, lastName, payload.displayName),
          email: payload.email?.trim() ?? "",
          phone: payload.phone?.trim() ?? "",
          status: getClientStatus(profile),
          profileCompletionStatus: getProfileCompletion(profile),
          createdAt: timestamp,
          updatedAt: timestamp,
          profile,
        }
        set((state) => ({ clients: [record, ...state.clients] }))
        return id
      },

      updateClient: (clientId, updates) => set((state) => {
        const timestamp = nowIso()
        let updatedProfile: ClientFinancialProfile | null = null
        const clients = state.clients.map((client) => {
          if (client.id !== clientId) return client
          const firstName = updates.firstName?.trim() ?? client.firstName
          const lastName = updates.lastName?.trim() ?? client.lastName
          const profile = buildUpdatedProfile(client, updates, firstName, lastName)
          updatedProfile = profile
          return { ...client, firstName, lastName, displayName: toDisplayName(firstName, lastName, updates.displayName ?? client.displayName), email: updates.email?.trim() ?? client.email, phone: updates.phone?.trim() ?? client.phone, status: getClientStatus(profile), profile, profileCompletionStatus: getProfileCompletion(profile), updatedAt: timestamp }
        })
        if (!updatedProfile) return state
        return { clients, scenarios: state.scenarios.map((scenario) => scenario.clientId === clientId ? { ...scenario, status: "inputs_needed" as ScenarioStatus, updatedAt: timestamp, lastCalculatedAt: undefined } : scenario), moduleRecordsByScenarioId: syncModuleRecordsForClientUpdate(state, clientId, updatedProfile, timestamp) }
      }),

      archiveClient: (clientId) => set((state) => ({ clients: state.clients.map((client) => client.id === clientId ? { ...client, status: "archived", updatedAt: nowIso() } : client) })),

      createScenario: (payload) => {
        const client = get().clients.find((item) => item.id === payload.clientId)
        if (!client) return ""
        const timestamp = nowIso()
        const scenarioId = crypto.randomUUID()
        const includedModules: RiskModuleType[] = payload.includedModules.length ? payload.includedModules : ["life", "disability", "liability", "unemployment"]
        const activeModule = includedModules.includes(payload.activeModule) ? payload.activeModule : includedModules[0]
        const scenario: ScenarioRecord = { id: scenarioId, clientId: payload.clientId, advisorId: DEFAULT_ADVISOR_ID, name: payload.name.trim() || `${client.lastName} Household Risk Review`, notes: payload.notes?.trim(), includedModules, activeModule, status: "inputs_needed", createdAt: timestamp, updatedAt: timestamp, reportStatus: "not_started" }
        const moduleRecords: ScenarioModuleRecords = {}
        if (includedModules.includes("life")) moduleRecords.life = { inputs: prefillLifeInputs(client.profile, payload.clientId, scenarioId), assumptions: { ...get().globalLifeAssumptions }, output: null, updatedAt: timestamp }
        if (includedModules.includes("disability")) moduleRecords.disability = { inputs: prefillDisabilityInputs(client.profile, payload.clientId, scenarioId), assumptions: { ...get().globalDisabilityAssumptions }, output: null, updatedAt: timestamp }
        if (includedModules.includes("unemployment")) moduleRecords.unemployment = { inputs: prefillUnemploymentInputs(client.profile), output: null, updatedAt: timestamp }
        if (includedModules.includes("liability")) moduleRecords.liability = { inputs: prefillLiabilityInputs(client.profile), output: null, updatedAt: timestamp }
        set((state) => ({ scenarios: [scenario, ...state.scenarios], moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: moduleRecords } }))
        return scenarioId
      },

      setScenarioActiveModule: (scenarioId, module) => set((state) => ({ scenarios: state.scenarios.map((scenario) => scenario.id === scenarioId ? { ...scenario, activeModule: module, updatedAt: nowIso() } : scenario) })),
      updateLifeInputs: (scenarioId, inputs) => set((state) => {
        const scenarioRecords = state.moduleRecordsByScenarioId[scenarioId]
        const record = scenarioRecords?.life
        if (!scenarioRecords || !record) return state
        const timestamp = nowIso()
        const syncedLifeInputs = sanitizeLifeInputs(inputs)
        const withLifeInputs: ScenarioModuleRecords = { ...scenarioRecords, life: { ...record, inputs: syncedLifeInputs, output: null, updatedAt: timestamp, lastCalculatedAt: undefined } }
        const synced = syncSharedProjectionInputs(withLifeInputs, { annualIncome: syncedLifeInputs.annualIncome, currentAge: syncedLifeInputs.currentAge, retirementAge: syncedLifeInputs.retirementAge }, timestamp)
        return { moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: synced } }
      }),
      updateDisabilityInputs: (scenarioId, inputs) => set((state) => {
        const scenarioRecords = state.moduleRecordsByScenarioId[scenarioId]
        const record = scenarioRecords?.disability
        if (!scenarioRecords || !record) return state
        const timestamp = nowIso()
        const synced = syncSharedProjectionInputs({ ...scenarioRecords, disability: { ...record, inputs, output: null, updatedAt: timestamp, lastCalculatedAt: undefined } }, { annualIncome: inputs.annualEarnedIncome, currentAge: inputs.currentAge, retirementAge: inputs.retirementAge }, timestamp)
        return { moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: synced } }
      }),
      updateUnemploymentInputs: (scenarioId, inputs) => set((state) => {
        const scenarioRecords = state.moduleRecordsByScenarioId[scenarioId]
        const record = scenarioRecords?.unemployment
        if (!scenarioRecords || !record) return state
        const timestamp = nowIso()
        const synced = syncSharedAnnualIncome({ ...scenarioRecords, unemployment: { ...record, inputs, output: null, updatedAt: timestamp, lastCalculatedAt: undefined } }, inputs.annualIncome, timestamp)
        return { moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: synced } }
      }),
      updateLiabilityInputs: (scenarioId, inputs) => set((state) => {
        const scenarioRecords = state.moduleRecordsByScenarioId[scenarioId]
        const record = scenarioRecords?.liability
        if (!scenarioRecords || !record) return state
        const timestamp = nowIso()
        const synced = syncSharedProjectionInputs({ ...scenarioRecords, liability: { ...record, inputs, output: null, updatedAt: timestamp, lastCalculatedAt: undefined } }, { annualIncome: inputs.annualIncome ?? 0, currentAge: inputs.currentAge ?? 0, retirementAge: inputs.retirementAge ?? 0 }, timestamp)
        return { moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: synced } }
      }),

      saveLifeCalculation: (scenarioId, output) => {
        const timestamp = nowIso()
        set((state) => {
          const record = state.moduleRecordsByScenarioId[scenarioId]?.life
          if (!record) return state
          return { moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: { ...state.moduleRecordsByScenarioId[scenarioId], life: { ...record, output, updatedAt: timestamp, lastCalculatedAt: timestamp } } }, scenarios: state.scenarios.map((scenario) => scenario.id === scenarioId ? updateScenarioForSave(scenario, timestamp) : scenario) }
        })
      },
      saveDisabilityCalculation: (scenarioId, output) => {
        const timestamp = nowIso()
        set((state) => {
          const record = state.moduleRecordsByScenarioId[scenarioId]?.disability
          if (!record) return state
          return { moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: { ...state.moduleRecordsByScenarioId[scenarioId], disability: { ...record, output, updatedAt: timestamp, lastCalculatedAt: timestamp } } }, scenarios: state.scenarios.map((scenario) => scenario.id === scenarioId ? updateScenarioForSave(scenario, timestamp) : scenario) }
        })
      },
      saveUnemploymentCalculation: (scenarioId, output) => {
        const timestamp = nowIso()
        set((state) => {
          const record = state.moduleRecordsByScenarioId[scenarioId]?.unemployment
          if (!record) return state
          return { moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: { ...state.moduleRecordsByScenarioId[scenarioId], unemployment: { ...record, output, updatedAt: timestamp, lastCalculatedAt: timestamp } } }, scenarios: state.scenarios.map((scenario) => scenario.id === scenarioId ? updateScenarioForSave(scenario, timestamp) : scenario) }
        })
      },
      saveLiabilityCalculation: (scenarioId, output) => {
        const timestamp = nowIso()
        set((state) => {
          const record = state.moduleRecordsByScenarioId[scenarioId]?.liability
          if (!record) return state
          return { moduleRecordsByScenarioId: { ...state.moduleRecordsByScenarioId, [scenarioId]: { ...state.moduleRecordsByScenarioId[scenarioId], liability: { ...record, output, updatedAt: timestamp, lastCalculatedAt: timestamp } } }, scenarios: state.scenarios.map((scenario) => scenario.id === scenarioId ? updateScenarioForSave(scenario, timestamp) : scenario) }
        })
      },

      importAppData: (data) => set({ clients: data.clients ?? [], scenarios: data.scenarios ?? [], moduleRecordsByScenarioId: data.moduleRecordsByScenarioId ?? {}, globalLifeAssumptions: data.globalLifeAssumptions ?? { ...defaultLifeAssumptions }, globalDisabilityAssumptions: data.globalDisabilityAssumptions ?? { ...defaultDisabilityAssumptions } }),
    }),
    {
      name: "gap-tool-app-state-v1",
      storage: createJSONStorage(() => localStorage),
      version: 6,
      migrate: (persistedState: unknown) => {
        if (persistedState === null || typeof persistedState !== "object") return undefined
        const state = persistedState as Record<string, unknown>
        const clients = state.clients as ClientRecord[] | undefined
        if (Array.isArray(clients)) {
          for (const client of clients) {
            const profile = client.profile
            if (!profile) continue
            if (profile.homeEquity === undefined) profile.homeEquity = Math.max(0, (profile.homeValue ?? 0) - (profile.mortgageBalance ?? 0))
            profile.homeValue = 0
            profile.mortgageBalance = 0
            profile.emergencySavings = profile.emergencySavings ?? profile.savingsAssets ?? 0
            profile.savingsAssets = profile.emergencySavings
            profile.umbrellaCoverage = profile.umbrellaCoverage ?? 0
            profile.expectedRetirementAge = profile.expectedRetirementAge ?? DEFAULT_RETIREMENT_AGE
          }
        }
        return state
      },
      partialize: (state) => ({ clients: state.clients, scenarios: state.scenarios, moduleRecordsByScenarioId: state.moduleRecordsByScenarioId, globalLifeAssumptions: state.globalLifeAssumptions, globalDisabilityAssumptions: state.globalDisabilityAssumptions }),
    },
  ),
)
