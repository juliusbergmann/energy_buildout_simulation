# Austria Electricity Buildout Simulator

Date: 2026-06-20

## Summary

- Build a greenfield Next.js + TypeScript single-page app for Austria.
- v1 is a transparent balance model: no dispatch optimization yet, but data structures should allow a future optimizer.
- Use Energy-Charts power chart as the visualization reference, Energy-Charts API as the data source, and LADE V2G as inspiration for polished simulator controls.
- Fixed v1 decisions: English UI, selectable historical days/weeks, fixed historical load, period-year capacity defaults, absolute GW capacity inputs, URL-shareable scenarios.

Reference links:

- Energy-Charts Austria power chart: <https://www.energy-charts.info/charts/power/chart.htm?l=de&c=AT>
- Energy-Charts API: <https://api.energy-charts.info/>
- LADE V2G simulator: <https://v2g.lade.de/>

## Key Changes

- Scaffold a Next.js app with one main route for the simulator and API routes for cached data access.
- Add `GET /api/scenario-data?start=YYYY-MM-DD&end=YYYY-MM-DD` for Austria data. It fetches and caches:
  - `/public_power?country=at&start=...&end=...`
  - `/installed_power?country=at`
  - `/cbet?country=at&start=...&end=...`
- Normalize all data into 15-minute series. Treat Energy-Charts power values as MW and installed capacity as GW, converting capacity to MW before scaling.
- Add Energy-Charts attribution and CC BY 4.0 source notice in the UI.

## Simulation Behavior

- Default capacity values use installed capacity for the selected period's year. If unavailable, use the nearest earlier available year.
- Users edit absolute `generation_unit_power` values in GW. Scenario values are encoded in URL query params.
- Scale each adjustable technology by capacity ratio:

```ts
simulatedMw = historicalMw * (scenarioCapacityGw / baselineCapacityGw)
```

- Major grouped controls:
  - Solar AC
  - Wind onshore
  - Hydro run-of-river
  - Hydro reservoir
  - Hydro pumped storage, including generation and pumping consumption scaled together
  - Fossil gas
  - Biomass
  - Waste / other small sources
- Exclude `Load`, `Residual load`, renewable-share series, and historical `Cross border electricity trading` from domestic generation totals.
- Compute simulated residual:

```ts
residualMw = fixedHistoricalLoadMw - simulatedDomesticNetSupplyMw
```

Positive residual means import/dispatch need. Negative residual means surplus/export potential.

- Show historical cross-border trading as a reference line only; do not use it as fixed supply.

## UI

- One Energy-Charts-style page:
  - Compact top toolbar for date/week selection, reset, and share URL.
  - Capacity control panel with numeric GW inputs and sliders.
  - Large stacked 15-minute chart with generation areas, pumping consumption below zero, load line, residual/import-need line, and historical cross-border reference.
  - Legend toggles, zoom/data window, rich tooltips, and responsive mobile layout.
- Add summary metrics:
  - Total load
  - Total simulated domestic generation
  - Renewable share of load
  - Deficit/import-need energy
  - Surplus/export-potential energy
  - Peak deficit and peak surplus
- Add a 15-minute data table or tab below the chart with every generation type, load, residual, and optional CSV export.

## Test Plan

- Unit-test data normalization, technology mapping, capacity-ratio scaling, MW/GW conversion, residual calculation, and MWh integration.
- Mock API tests for successful Energy-Charts responses, missing years, zero baseline capacity, 429/rate-limit handling, and cache fallback.
- UI tests for default scenario reproducing historical data, URL scenario reload, date/week changes, chart rendering, mobile layout, and CSV export.
- Acceptance check: changing solar capacity to 2x doubles only the solar profile, load stays fixed, cross-border remains reference-only, and residual updates correctly.

## Assumptions

- v1 is Austria-only.
- No cost, CO2, sector load, dispatch, or optimization logic in the first implementation.
- Dispatchable/storage technologies are still adjustable in v1 by historical-profile scaling, with clear UI wording that this is not optimized dispatch.
- Historical load remains fixed for v1.
