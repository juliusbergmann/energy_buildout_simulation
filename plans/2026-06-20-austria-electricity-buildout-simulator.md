# Austria Electricity Buildout Simulator

Date: 2026-06-20

## Summary

- Build a greenfield Next.js + TypeScript single-page app for Austria.
- v1 is a transparent balance model: no dispatch optimization yet, but data structures should allow a future optimizer.
- Use Energy-Charts power chart as the visualization reference, Energy-Charts API as the data source, and LADE V2G as inspiration for polished simulator controls.
- Fixed v1 decisions: English UI, selectable historical days/weeks, fixed historical load, full-year annual generation defaults for most technologies, URL-shareable scenarios.
- Update on 2026-06-20: scenario scaling now uses TWh/year targets for most generation technologies. Pumped storage and fossil gas remain GW-based because their historical dispatch profiles should not be interpreted as annual generation buildout targets.
- Earlier update on 2026-06-20: the main chart added an Energy-Charts-style inspection tooltip with visible series values, visible net supply, load, residual, and cross-border reference for each 15-minute interval.
- Update on 2026-06-20: simulated residual and historical cross-border trading remain available in the model but are hidden from the chart, tooltip, table, and CSV for now.
- Update on 2026-06-20: date selection now uses an Energy-Charts-style interval selector for day, week, month, and year choices, deriving the `start`/`end` query range for data loading and share URLs.
- Update on 2026-06-20: the date selector now sits in a compact page-level band below the masthead instead of occupying the main toolbar between the title and action buttons.
- Update on 2026-06-20: generation target controls use progressive disclosure to reduce visual noise. Simple mode is local UI state, groups technologies by decision area, shows changed rows by default, and keeps all scenario target values URL-shareable.
- Update on 2026-06-20: Energy-Charts proxy requests now fail fast on 429 rate limits, cap retry delays for 5xx responses, and use a hard upstream fetch timeout so the simulator does not sit indefinitely in the loading state.
- Update on 2026-06-20: opening the simulator without `start`/`end` query parameters now defaults to the current ISO week. Shared URLs with explicit dates continue to restore their encoded range.
- Update on 2026-06-20: the on-page 15-minute interval data table was removed to keep the chart view focused. Full interval data remains available through CSV export.
- Update on 2026-06-20: deployment now supports a production Docker image for VPS hosting using Next.js standalone output, plus a Docker Compose entrypoint for local or server operation.

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
- Users edit absolute annual generation targets in TWh/year for solar, wind, run-of-river hydro, reservoir hydro, biomass, and waste/other small sources. Pumped storage and fossil gas remain absolute `generation_unit_power` controls in GW. Scenario values are encoded in URL query params with unit-qualified names.
- Annual generation baselines always come from the full historical year for the selected period's start year, even when the displayed simulation range is a day or week.
- Scale annual-generation technologies by full-year generation ratio:

```ts
simulatedMw = historicalMw * (scenarioAnnualGenerationTwh / baselineAnnualGenerationTwh)
```

- Scale pumped storage and fossil gas by capacity ratio:

```ts
simulatedMw = historicalMw * (scenarioCapacityGw / baselineCapacityGw)
```

- Major grouped controls:
  - Solar AC
  - Wind onshore
  - Hydro run-of-river
  - Hydro reservoir
  - Hydro pumped storage in GW, including generation and pumping consumption scaled together
  - Fossil gas
  - Biomass
  - Waste / other small sources
- Add quick selectors for historical baseline, EAG 2030, and NECP WAM 2030. EAG/NECP presets apply their 2030 renewable additions relative to 2020 Energy-Charts full-year generation; hydropower additions are distributed across run-of-river and reservoir hydro in proportion to their 2020 annual generation.
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
  - Scenario control panel with compact preset selection, Simple/Advanced modes, grouped generation targets, changed-row emphasis, numeric TWh/year inputs for annual-generation technologies, and GW inputs for pumped storage and fossil gas.
  - Large stacked 15-minute chart with generation areas, pumping consumption below zero, and load line.
  - Legend toggles, zoom/data window, rich tooltips, and responsive mobile layout.
- Summary metric cards were removed after initial implementation because they duplicated chart/table information and added unnecessary visual weight above the controls.
- Target-control groups are Wind, Solar, Hydro (run-of-river and reservoir), Dispatch (gas), Storage (pumped hydro), and Other (biomass, waste, and other small sources). Group summaries show current target totals, changed counts, and the baseline source for those totals.
- Simple mode defaults to compact group headers plus changed rows. Advanced mode exposes all target rows. Exact inputs and sliders are shown only when a row is expanded.
- Keep full 15-minute interval data available through CSV export from the toolbar; do not render a long interval table below the chart.

## Test Plan

- Unit-test data normalization, technology mapping, annual-generation scaling, capacity-ratio scaling, MW/GW conversion, residual calculation, and MWh integration.
- Mock API tests for successful Energy-Charts responses, missing years, zero baseline capacity, 429/rate-limit handling, and cache fallback.
- UI tests for default scenario reproducing historical data, URL scenario reload, date/week changes, chart rendering, mobile layout, and CSV export.
- Acceptance check: changing solar annual generation to 2x doubles only the solar profile, load stays fixed, cross-border remains reference-only, and residual updates correctly. Changing pumped storage or fossil gas GW scales those profiles by capacity ratio.

## Assumptions

- v1 is Austria-only.
- No cost, CO2, sector load, dispatch, or optimization logic in the first implementation.
- Dispatchable/storage technologies are still adjustable in v1 by historical-profile scaling, with clear UI wording that this is not optimized dispatch.
- Historical load remains fixed for v1.
