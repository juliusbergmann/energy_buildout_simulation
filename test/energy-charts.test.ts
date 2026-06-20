import { afterEach, describe, expect, it, vi } from "vitest";
import { getAustriaScenarioData, normalizeEnergyChartsData } from "@/lib/energy-charts";

const timestamps = [1, 2, 3, 4];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("normalizeEnergyChartsData", () => {
  it("uses full-year generation for TWh baselines and builds policy presets from 2020", () => {
    const data = normalizeEnergyChartsData({
      start: "2025-01-01",
      end: "2025-01-07",
      publicPower: {
        unix_seconds: timestamps,
        production_types: [
          series("Load", [100, 100, 100, 100]),
          series("Residual load", [20, 20, 20, 20]),
          series("Solar", [1, 1, 1, 1]),
          series("Wind onshore", [2, 2, 2, 2]),
          series("Hydro Run-of-River", [3, 3, 3, 3]),
          series("Hydro water reservoir", [4, 4, 4, 4]),
          series("Hydro pumped storage", [5, 5, 5, 5]),
          series("Hydro pumped storage consumption", [-1, -1, -1, -1]),
          series("Fossil gas", [6, 6, 6, 6]),
          series("Biomass", [7, 7, 7, 7]),
          series("Waste", [8, 8, 8, 8])
        ],
        deprecated: false
      },
      annualPublicPower: {
        unix_seconds: timestamps,
        production_types: [
          annualSeries("Solar", 10),
          annualSeries("Wind onshore", 20),
          annualSeries("Hydro Run-of-River", 30),
          annualSeries("Hydro water reservoir", 40),
          annualSeries("Hydro pumped storage", 50),
          annualSeries("Hydro pumped storage consumption", -5),
          annualSeries("Fossil gas", 60),
          annualSeries("Biomass", 70),
          annualSeries("Waste", 80)
        ],
        deprecated: false
      },
      policyBaselinePublicPower: {
        unix_seconds: timestamps,
        production_types: [
          annualSeries("Solar", 1),
          annualSeries("Wind onshore", 2),
          annualSeries("Hydro Run-of-River", 3),
          annualSeries("Hydro water reservoir", 1),
          annualSeries("Biomass", 4)
        ],
        deprecated: false
      },
      installedPower: {
        time: ["2025"],
        production_types: [
          capacity("Solar AC", 11),
          capacity("Wind onshore", 12),
          capacity("Hydro Run-of-River", 13),
          capacity("Hydro water reservoir", 14),
          capacity("Hydro pumped storage", 15),
          capacity("Fossil gas", 16),
          capacity("Biomass", 17),
          capacity("Waste", 18)
        ],
        last_update: null,
        deprecated: false
      },
      crossBorder: null
    });

    expect(data.baselineAnnualGenerationTwh.solar).toBe(10);
    expect(data.baselineAnnualGenerationTwh.windOnshore).toBe(20);
    expect(data.baselineCapacityGw.fossilGas).toBe(16);

    expect(data.policyPresets[0]).toMatchObject({
      id: "eag2030",
      annualGenerationTwh: {
        solar: 12,
        windOnshore: 12,
        hydroRunRiver: 6.75,
        hydroReservoir: 2.25,
        biomass: 5
      }
    });
  });

  it("falls back to a local installed-power snapshot when Energy-Charts rate-limits installed capacity", async () => {
    const yearTimestamps = [
      Date.parse("2025-02-01T00:00:00Z") / 1000,
      Date.parse("2025-02-01T00:15:00Z") / 1000,
      Date.parse("2025-02-01T00:30:00Z") / 1000,
      Date.parse("2025-02-01T00:45:00Z") / 1000
    ];
    const publicPower = {
      unix_seconds: yearTimestamps,
      production_types: [
        series("Load", [100, 100, 100, 100]),
        series("Residual load", [20, 20, 20, 20]),
        annualSeries("Solar", 1),
        annualSeries("Wind onshore", 2),
        annualSeries("Hydro Run-of-River", 3),
        annualSeries("Hydro water reservoir", 4),
        annualSeries("Hydro pumped storage", 5),
        annualSeries("Hydro pumped storage consumption", -1),
        annualSeries("Fossil gas", 6),
        annualSeries("Biomass", 7),
        annualSeries("Waste", 8)
      ],
      deprecated: false
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);

        if (href.includes("/installed_power")) {
          return jsonResponse({ error: "rate limited" }, 429);
        }

        if (href.includes("/cbet")) {
          return jsonResponse({ error: "not needed" }, 404);
        }

        return jsonResponse(publicPower);
      })
    );

    const data = await getAustriaScenarioData("2025-02-01", "2025-02-01");

    expect(data.baselineCapacityGw.hydroPumped).toBe(4.02);
    expect(data.baselineCapacityGw.fossilGas).toBe(4.28);
    expect(data.sourceUpdatedAt).toBe("2026-05-29T03:01:17.000Z");
  });

  it(
    "fails fast without retrying public-power requests when Energy-Charts returns a rate limit",
    async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn(async (url: string | URL | Request) => {
        const href = String(url);

        if (href.includes("/public_power")) {
          return jsonResponse({ error: "rate limited" }, 429, { "retry-after": "20" });
        }

        if (href.includes("/installed_power")) {
          return jsonResponse({
            time: ["2025"],
            production_types: [],
            last_update: null,
            deprecated: false
          });
        }

        return jsonResponse({ unix_seconds: [], countries: [], deprecated: false });
      });

      vi.stubGlobal("fetch", fetchMock);

      await expect(getAustriaScenarioData("2024-02-01", "2024-02-01")).rejects.toThrow(
        "Energy-Charts request failed with status 429"
      );

      const publicPowerCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/public_power"));
      expect(publicPowerCalls.length).toBeGreaterThan(0);

      await vi.advanceTimersByTimeAsync(20_000);
      const publicPowerCallsAfterRetryWindow = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/public_power")
      );
      expect(publicPowerCallsAfterRetryWindow).toHaveLength(publicPowerCalls.length);
    },
    1_000
  );

  it("reports a controlled error when Energy-Charts returns an HTML page instead of JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);

        if (href.includes("/public_power")) {
          return new Response("<!DOCTYPE html><html><body>not json</body></html>", {
            status: 200,
            headers: {
              "content-type": "text/html"
            }
          });
        }

        if (href.includes("/installed_power")) {
          return jsonResponse({
            time: ["2025"],
            production_types: [],
            last_update: null,
            deprecated: false
          });
        }

        return jsonResponse({ unix_seconds: [], countries: [], deprecated: false });
      })
    );

    await expect(getAustriaScenarioData("2023-03-01", "2023-03-01")).rejects.toThrow(
      "Energy-Charts returned a non-JSON response"
    );
  });
});

function series(name: string, data: number[]) {
  return { name, data };
}

function annualSeries(name: string, twh: number) {
  return series(name, Array.from({ length: timestamps.length }, () => twh * 1_000_000));
}

function capacity(name: string, value: number) {
  return { name, data: [value] };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });
}
