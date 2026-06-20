import { CHART_SERIES, TECHNOLOGIES } from "./technologies";
import type { CapacityByTechnology, NormalizedScenarioData } from "./types";

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

const cache = new Map<string, { expiresAt: number; data: NormalizedScenarioData }>();

export async function getAustriaScenarioData(start: string, end: string) {
  const cacheKey = `${start}:${end}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [publicPower, installedPower, crossBorder] = await Promise.all([
    fetchJson<PublicPowerResponse>(
      `/public_power?country=at&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    ),
    fetchJson<InstalledPowerResponse>("/installed_power?country=at"),
    fetchJson<CrossBorderResponse>(
      `/cbet?country=at&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    ).catch(() => null)
  ]);

  const normalized = normalizeEnergyChartsData({
    start,
    end,
    publicPower,
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
  installedPower,
  crossBorder
}: {
  start: string;
  end: string;
  publicPower: PublicPowerResponse;
  installedPower: InstalledPowerResponse;
  crossBorder: CrossBorderResponse | null;
}): NormalizedScenarioData {
  if (!publicPower.unix_seconds?.length || !publicPower.production_types?.length) {
    throw new Error("Energy-Charts public power response did not include time series data.");
  }

  const periodYear = new Date(`${start}T00:00:00Z`).getUTCFullYear();
  const capacityYear = findCapacityYear(installedPower.time, periodYear);
  const productionByName = toSeriesMap(publicPower.production_types, publicPower.unix_seconds.length);
  const crossBorderByName = toSeriesMap(crossBorder?.countries ?? [], publicPower.unix_seconds.length);
  const installedByName = toInstalledCapacityMap(installedPower, capacityYear);
  const fallbackTrading = productionByName.get("Cross border electricity trading");

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
    historicalSeriesMw: Object.fromEntries(
      CHART_SERIES.map((series) => [
        series.id,
        sumSeries(series.sourceNames.map((name) => getSeries(productionByName, name, publicPower.unix_seconds!.length)))
      ])
    ) as NormalizedScenarioData["historicalSeriesMw"],
    sourceUpdatedAt: installedPower.last_update ? new Date(installedPower.last_update * 1000).toISOString() : null,
    sourceDeprecated: Boolean(publicPower.deprecated || installedPower.deprecated || crossBorder?.deprecated)
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

function emptySeries(length: number) {
  return Array.from({ length }, () => 0);
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

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${ENERGY_CHARTS_API}${path}`, {
    headers: {
      accept: "application/json"
    },
    next: {
      revalidate: 900
    }
  });

  if (!response.ok) {
    throw new Error(`Energy-Charts request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}
