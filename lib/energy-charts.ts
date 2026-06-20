import { CHART_SERIES, TECHNOLOGIES } from "./technologies";
import type {
  AnnualGenerationByTechnology,
  CapacityByTechnology,
  NormalizedScenarioData,
  PolicyPreset
} from "./types";

type NamedData = {
  name: string;
  data: Array<number | null>;
};

type PublicPowerResponse = {
  unix_seconds: number[] | null;
  production_types: NamedData[] | null;
  deprecated: boolean;
};

type InstalledPowerResponse = {
  time: string[];
  production_types: NamedData[] | null;
  last_update: number | null;
  deprecated: boolean;
};

type CrossBorderResponse = {
  unix_seconds: number[] | null;
  countries: NamedData[] | null;
  deprecated: boolean;
};

const ENERGY_CHARTS_API = "https://api.energy-charts.info";
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 2_000;
const FETCH_TIMEOUT_MS = 10_000;
const QUARTER_HOUR = 0.25;
const POLICY_BASELINE_YEAR = 2020;
const EAG_ADDITIONS_TWH = {
  solar: 11,
  windOnshore: 10,
  hydro: 5,
  biomass: 1
};
const NECP_WAM_ADDITIONS_TWH = {
  solar: 17,
  windOnshore: 12,
  hydro: 5,
  biomass: 1
};
const FALLBACK_INSTALLED_POWER_LAST_UPDATE = 1_780_023_677;
const FALLBACK_INSTALLED_POWER: InstalledPowerResponse = {
  time: ["2025"],
  production_types: [
    { name: "Solar AC", data: [9.77] },
    { name: "Wind onshore", data: [4.14] },
    { name: "Hydro Run-of-River", data: [5.94] },
    { name: "Hydro water reservoir", data: [2.55] },
    { name: "Hydro pumped storage", data: [4.02] },
    { name: "Fossil gas", data: [4.28] },
    { name: "Biomass", data: [0.58] },
    { name: "Waste", data: [0.97] }
  ],
  last_update: FALLBACK_INSTALLED_POWER_LAST_UPDATE,
  deprecated: false
};

const cache = new Map<string, { expiresAt: number; data: NormalizedScenarioData }>();
const fetchCache = new Map<string, { expiresAt: number; data: unknown }>();

export async function getAustriaScenarioData(start: string, end: string) {
  const cacheKey = `${start}:${end}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const periodYear = getUtcYear(start);
  const annualRange = getFullYearRange(periodYear);
  const policyBaselineRange = getFullYearRange(POLICY_BASELINE_YEAR);
  const endYear = getUtcYear(end);
  const selectedPublicPowerPromise =
    endYear === periodYear
      ? Promise.resolve<PublicPowerResponse | null>(null)
      : fetchJson<PublicPowerResponse>(
          `/public_power?country=at&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        );

  const [selectedPublicPower, annualPublicPower, policyBaselinePublicPower, installedPower, crossBorder] =
    await Promise.all([
      selectedPublicPowerPromise,
      fetchJson<PublicPowerResponse>(
        `/public_power?country=at&start=${encodeURIComponent(annualRange.start)}&end=${encodeURIComponent(
          annualRange.end
        )}`
      ),
      fetchJson<PublicPowerResponse>(
        `/public_power?country=at&start=${encodeURIComponent(policyBaselineRange.start)}&end=${encodeURIComponent(
          policyBaselineRange.end
        )}`
      ),
      fetchJson<InstalledPowerResponse>("/installed_power?country=at").catch(() => FALLBACK_INSTALLED_POWER),
      fetchJson<CrossBorderResponse>(
        `/cbet?country=at&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      ).catch(() => null)
    ]);
  const publicPower = selectedPublicPower ?? slicePublicPowerResponse(annualPublicPower, start, end);

  const normalized = normalizeEnergyChartsData({
    start,
    end,
    publicPower,
    annualPublicPower,
    policyBaselinePublicPower,
    installedPower,
    crossBorder
  });

  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data: normalized
  });

  return normalized;
}

export function normalizeEnergyChartsData({
  start,
  end,
  publicPower,
  annualPublicPower,
  policyBaselinePublicPower,
  installedPower,
  crossBorder
}: {
  start: string;
  end: string;
  publicPower: PublicPowerResponse;
  annualPublicPower: PublicPowerResponse;
  policyBaselinePublicPower: PublicPowerResponse;
  installedPower: InstalledPowerResponse;
  crossBorder: CrossBorderResponse | null;
}): NormalizedScenarioData {
  assertPublicPowerData(publicPower, "selected range");
  assertPublicPowerData(annualPublicPower, "full-year baseline");
  assertPublicPowerData(policyBaselinePublicPower, "2020 policy baseline");

  const periodYear = getUtcYear(start);
  const capacityYear = findCapacityYear(installedPower.time, periodYear);
  const productionByName = toSeriesMap(publicPower.production_types, publicPower.unix_seconds.length);
  const annualProductionByName = toSeriesMap(
    annualPublicPower.production_types,
    annualPublicPower.unix_seconds.length
  );
  const policyBaselineProductionByName = toSeriesMap(
    policyBaselinePublicPower.production_types,
    policyBaselinePublicPower.unix_seconds.length
  );
  const crossBorderByName = toSeriesMap(crossBorder?.countries ?? [], publicPower.unix_seconds.length);
  const installedByName = toInstalledCapacityMap(installedPower, capacityYear);
  const fallbackTrading = productionByName.get("Cross border electricity trading");
  const policyBaselineAnnualGenerationTwh = buildAnnualGenerationTwh(
    policyBaselineProductionByName,
    policyBaselinePublicPower.unix_seconds.length
  );

  return {
    start,
    end,
    periodYear,
    capacityYear,
    timestamps: publicPower.unix_seconds,
    isoTimes: publicPower.unix_seconds.map((seconds) => new Date(seconds * 1000).toISOString()),
    loadMw: getSeries(productionByName, "Load", publicPower.unix_seconds.length),
    historicalResidualMw: getSeries(productionByName, "Residual load", publicPower.unix_seconds.length),
    historicalCrossBorderMw: getCrossBorderSeries(crossBorderByName, fallbackTrading, publicPower.unix_seconds.length),
    baselineCapacityGw: buildBaselineCapacity(installedByName),
    baselineAnnualGenerationTwh: buildAnnualGenerationTwh(
      annualProductionByName,
      annualPublicPower.unix_seconds.length
    ),
    policyPresets: buildPolicyPresets(policyBaselineAnnualGenerationTwh),
    historicalSeriesMw: Object.fromEntries(
      CHART_SERIES.map((series) => [
        series.id,
        sumSeries(series.sourceNames.map((name) => getSeries(productionByName, name, publicPower.unix_seconds!.length)))
      ])
    ) as NormalizedScenarioData["historicalSeriesMw"],
    sourceUpdatedAt: installedPower.last_update ? new Date(installedPower.last_update * 1000).toISOString() : null,
    sourceDeprecated: Boolean(
      publicPower.deprecated ||
        annualPublicPower.deprecated ||
        policyBaselinePublicPower.deprecated ||
        installedPower.deprecated ||
        crossBorder?.deprecated
    )
  };
}

function slicePublicPowerResponse(publicPower: PublicPowerResponse, start: string, end: string): PublicPowerResponse {
  assertPublicPowerData(publicPower, "full-year baseline");

  const startSeconds = Date.parse(`${start}T00:00:00Z`) / 1000;
  const endExclusiveSeconds = Date.parse(`${end}T00:00:00Z`) / 1000 + 24 * 60 * 60;
  const indexes = publicPower.unix_seconds
    .map((seconds, index) => ({ seconds, index }))
    .filter(({ seconds }) => seconds >= startSeconds && seconds < endExclusiveSeconds)
    .map(({ index }) => index);

  return {
    ...publicPower,
    unix_seconds: indexes.map((index) => publicPower.unix_seconds[index]),
    production_types: publicPower.production_types.map((item) => ({
      ...item,
      data: indexes.map((index) => item.data[index] ?? null)
    }))
  };
}

function buildBaselineCapacity(installedByName: Map<string, number>): CapacityByTechnology {
  return Object.fromEntries(
    TECHNOLOGIES.map((technology) => [
      technology.id,
      roundToThree(sumValues(technology.installedCapacityNames.map((name) => installedByName.get(name) ?? 0)))
    ])
  ) as CapacityByTechnology;
}

function buildAnnualGenerationTwh(
  productionByName: Map<string, number[]>,
  length: number
): AnnualGenerationByTechnology {
  return Object.fromEntries(
    TECHNOLOGIES.map((technology) => {
      const generationMwh = technology.productionNames
        .map((name) => getSeries(productionByName, name, length))
        .reduce((total, series) => total + sumPositiveEnergy(series), 0);

      return [technology.id, roundToThree(generationMwh / 1_000_000)];
    })
  ) as AnnualGenerationByTechnology;
}

function buildPolicyPresets(policyBaselineAnnualGenerationTwh: AnnualGenerationByTechnology): PolicyPreset[] {
  return [
    {
      id: "eag2030",
      label: "EAG 2030",
      description: "+27 TWh vs 2020",
      annualGenerationTwh: buildRenewablePolicyTargets(policyBaselineAnnualGenerationTwh, EAG_ADDITIONS_TWH)
    },
    {
      id: "necpWam2030",
      label: "NECP WAM 2030",
      description: "+35 TWh vs 2020",
      annualGenerationTwh: buildRenewablePolicyTargets(policyBaselineAnnualGenerationTwh, NECP_WAM_ADDITIONS_TWH)
    }
  ];
}

function buildRenewablePolicyTargets(
  policyBaselineAnnualGenerationTwh: AnnualGenerationByTechnology,
  additionsTwh: typeof EAG_ADDITIONS_TWH
): PolicyPreset["annualGenerationTwh"] {
  const hydroBaseline =
    policyBaselineAnnualGenerationTwh.hydroRunRiver + policyBaselineAnnualGenerationTwh.hydroReservoir;
  const runRiverShare = hydroBaseline > 0 ? policyBaselineAnnualGenerationTwh.hydroRunRiver / hydroBaseline : 0.5;
  const reservoirShare = 1 - runRiverShare;

  return {
    solar: roundToThree(policyBaselineAnnualGenerationTwh.solar + additionsTwh.solar),
    windOnshore: roundToThree(policyBaselineAnnualGenerationTwh.windOnshore + additionsTwh.windOnshore),
    hydroRunRiver: roundToThree(policyBaselineAnnualGenerationTwh.hydroRunRiver + additionsTwh.hydro * runRiverShare),
    hydroReservoir: roundToThree(policyBaselineAnnualGenerationTwh.hydroReservoir + additionsTwh.hydro * reservoirShare),
    biomass: roundToThree(policyBaselineAnnualGenerationTwh.biomass + additionsTwh.biomass)
  };
}

function getCrossBorderSeries(
  crossBorderByName: Map<string, number[]>,
  fallbackTrading: number[] | undefined,
  length: number
) {
  const cbetSumGw = crossBorderByName.get("sum");

  if (cbetSumGw) {
    return cbetSumGw.map((value) => value * 1000);
  }

  return fallbackTrading ?? emptySeries(length);
}

function toSeriesMap(items: NamedData[], length: number) {
  const map = new Map<string, number[]>();

  for (const item of items) {
    map.set(item.name, item.data.slice(0, length).map((value) => value ?? 0));
  }

  return map;
}

function toInstalledCapacityMap(installedPower: InstalledPowerResponse, year: string) {
  const index = installedPower.time.indexOf(year);
  const map = new Map<string, number>();

  if (index === -1) {
    return map;
  }

  for (const item of installedPower.production_types ?? []) {
    map.set(item.name, Number(item.data[index] ?? 0));
  }

  return map;
}

function getSeries(map: Map<string, number[]>, name: string, length: number) {
  return map.get(name) ?? emptySeries(length);
}

function sumSeries(seriesList: number[][]) {
  if (!seriesList.length) {
    return [];
  }

  return seriesList[0].map((_, index) => sumValues(seriesList.map((series) => series[index] ?? 0)));
}

function sumValues(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function sumPositiveEnergy(valuesMw: number[]) {
  return valuesMw.reduce((sum, value) => sum + Math.max(value, 0) * QUARTER_HOUR, 0);
}

function emptySeries(length: number) {
  return Array.from({ length }, () => 0);
}

function getUtcYear(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCFullYear();
}

function getFullYearRange(year: number) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  };
}

function assertPublicPowerData(
  response: PublicPowerResponse,
  label: string
): asserts response is PublicPowerResponse & { unix_seconds: number[]; production_types: NamedData[] } {
  if (!response.unix_seconds?.length || !response.production_types?.length) {
    throw new Error(`Energy-Charts public power response did not include ${label} time series data.`);
  }
}

function findCapacityYear(years: string[], periodYear: number) {
  const numericYears = years.map((year) => Number(year)).filter((year) => Number.isFinite(year)).sort((a, b) => a - b);
  const nearestEarlier = numericYears.filter((year) => year <= periodYear).at(-1);
  const fallback = numericYears.at(-1);

  return String(nearestEarlier ?? fallback ?? periodYear);
}

function roundToThree(value: number) {
  return Math.round(value * 1000) / 1000;
}

async function fetchJson<T>(path: string, attempt = 1): Promise<T> {
  const cached = fetchCache.get(path);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${ENERGY_CHARTS_API}${path}`, {
      headers: {
        accept: "application/json"
      },
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Energy-Charts request timed out after ${FETCH_TIMEOUT_MS / 1000}s for ${path}.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (shouldRetryResponse(response) && attempt < MAX_FETCH_ATTEMPTS) {
      await delay(getRetryDelayMs(response, attempt));
      return fetchJson<T>(path, attempt + 1);
    }

    throw new Error(`Energy-Charts request failed with status ${response.status} for ${path}.`);
  }

  const data = await readJsonResponse<T>(response, path);

  fetchCache.set(path, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data
  });

  return data;
}

async function readJsonResponse<T>(response: Response, path: string): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Energy-Charts returned a non-JSON response for ${path}.`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`Energy-Charts returned invalid JSON for ${path}.`);
  }
}

function shouldRetryResponse(response: Response) {
  return response.status >= 500;
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, MAX_RETRY_DELAY_MS);
  }

  return Math.min(RETRY_BASE_DELAY_MS * attempt, MAX_RETRY_DELAY_MS);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
