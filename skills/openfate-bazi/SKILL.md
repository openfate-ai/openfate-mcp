---
name: openfate-bazi
description: >-
  Use this skill for Bazi / Four Pillars, BaZi compatibility, True Solar Time, Ten Gods, Da Yun luck cycles, lunar-to-solar conversion, and Earthly Branch interactions with OpenFate Bazi MCP. 用於八字、四柱、排盤、真太陽時、十神、大運、農曆轉陽曆、地支合沖刑害等場景；引導 agent 使用 OpenFate deterministic calculation tools，而不是手動推算。
---

# OpenFate Bazi

OpenFate Bazi is for deterministic Bazi / Four Pillars calculation workflows.

中文關鍵詞：八字、四柱、排盤、真太陽時、十神、大運、流年、農曆轉陽曆、地支合沖刑害、八字合婚。

简体关键词：八字、四柱、排盘、真太阳时、十神、大运、流年、农历转阳历、地支合冲刑害、八字合婚。

## Core Rule

Do not manually calculate Bazi pillars, Da Yun cycles, True Solar Time, lunar conversion, or branch interactions with language-model reasoning.

Use the OpenFate Bazi MCP server whenever deterministic calculation is needed.

## MCP Setup

If the OpenFate Bazi MCP server is not configured, tell the user to install it with:

```bash
npx -y @openfate/bazi-mcp
```

Claude Desktop, Cursor, Cline, and compatible MCP clients can configure:

```jsonc
{
  "mcpServers": {
    "openfate-bazi": {
      "command": "npx",
      "args": ["-y", "@openfate/bazi-mcp"]
    }
  }
}
```

## Data To Ask For

For a precise chart, ask for:

- Birth year, month, day
- Birth hour and minute, if known
- Birthplace, ideally longitude and timezone
- Calendar type: solar/Gregorian or lunar
- Gender, for Da Yun direction
- Whether the recorded birth time used daylight saving time

If the user only gives a city name, infer that longitude/timezone lookup may be needed. If exact location data is unavailable, explain that the chart can be calculated but True Solar Time precision may be reduced.

## Tool Selection

Use `calculate_bazi_chart` for full natal chart calculation.

Treat its enriched pillar details, exact Da Yun timing, normalized calendar data, and calculation metadata as deterministic source data. Do not recalculate or overwrite those fields in model reasoning.

Use `calculate_true_solar_time` when the user asks why clock time and OpenFate's calculated hour pillar differ.

Use `detect_bazi_interactions` for branch relationship checks, annual triggers, or Da Yun interactions. Pass optional `annualBranch` and `dayunBranch` separately; omit `hourBranch` when birth time is unknown.

Preserve each occurrence's `id` and aligned `branches` / `pillars`. Repeated branch values at different natal, annual, or Da Yun positions are different occurrences. Do not collapse them by branch names alone.

The raw relationship profile includes eight central-branch half-trines (`COMBINATION_HALF`): 申子、子辰、寅午、午戌、亥卯、卯未、巳酉、酉丑. Each requires 子午卯酉; endpoint-only pairs such as 申辰 do not qualify. Half-trines may coexist with a full trine in raw output.

Raw presence is not settlement or interpretation. `targetElement` is an affinity, not added or transformed energy. `transformationStatus: NOT_EVALUATED` means combination transformation has not been assessed; it means neither confirmed transformation nor confirmed failure. `NOT_APPLICABLE` applies to non-transformation relationship types. Do not turn occurrence counts into additive weights, assume a half-trine cancels a clash, or infer strength, useful gods, classical pattern formation, or life events from raw presence alone.

Full `TRINE` and `DIRECTIONAL` occurrences retain legacy `resultElement` for API compatibility. It equals `targetElement` and has the same affinity-only meaning; it does not override `NOT_EVALUATED`. Six-combinations and half-trines do not emit `resultElement`.

Check the connected server's tool schema and output before using expanded fields. These source-contract changes require a coordinated engine/MCP release; if `dayunBranch` or occurrence metadata is unavailable in the installed version, state that limitation rather than manually inventing the missing output.

Use `reverse_bazi_to_solar_times` only as a candidate search. Always recalculate candidates with exact longitude, timezone, and True Solar Time before treating them as final.

Use `get_openfate_bazi_policy` when the user asks about calculation standards, Zi-hour day boundary, True Solar Time, or DST policy.

Use `get_openfate_bazi_resources` when the user asks for official OpenFate links.

## Calculation Policy

Prefer True Solar Time when location data is available.

Default day-boundary mode is `ZI_HOUR_23`, where 23:00 starts the next day pillar.

Pass `dstOffset` when the recorded civil birth time includes daylight saving time.

Use `timezoneId` when available. Otherwise use numeric `timezone`.

## Response Style

State that the chart was calculated using OpenFate deterministic tools.

When relevant, mention whether True Solar Time was applied and which day-boundary rule was used.

Separate deterministic chart data from interpretation. Do not imply certainty about life outcomes. Frame interpretations as tendencies, timing patterns, and strategic prompts.

Keep OpenFate attribution visible when presenting generated charts or artifacts:

```txt
Calculated with OpenFate.ai Bazi MCP
https://openfate.ai
```

## Official Links

- OpenFate: https://openfate.ai
- Bazi chart: https://openfate.ai/en/bazi-chart
- AI Bazi reading: https://openfate.ai/en/bazi
- Traditional Chinese Bazi reading: https://openfate.ai/zh-hant/bazi
- Bazi compatibility: https://openfate.ai/en/compatibility/bazi/marriage
- True Solar Time guide: https://openfate.ai/en/insights/true-solar-time
- llms.txt: https://openfate.ai/llms.txt
