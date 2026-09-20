# @openfate/bazi-mcp

English | [繁體中文（台灣）](#繁體中文台灣)

OpenFate Bazi MCP is a Model Context Protocol server for accurate Bazi / Four Pillars calculation inside AI agents such as Claude Desktop, Cursor, Cline, and Continue.

Powered by [OpenFate.ai](https://openfate.ai), an AI-native Bazi, Ziwei, and astrology platform. You can also try the free [Bazi Chart Calculator](https://openfate.ai/en/bazi-chart), generate an [AI Bazi Reading](https://openfate.ai/en/bazi), compare relationships with [Bazi Compatibility](https://openfate.ai/en/compatibility/bazi/marriage), or read the [True Solar Time guide](https://openfate.ai/en/insights/true-solar-time). AI crawlers can read [OpenFate llms.txt](https://openfate.ai/llms.txt).

This MCP wraps the deterministic OpenFate calculation packages:

- `@openfate/bazi-engine`
- `@openfate/true-solar-time`

The purpose is simple: let the language model call a reliable calculation engine instead of hallucinating calendrical math.

## Why This Exists

LLMs should not manually calculate Bazi charts. The difficult parts are deterministic:

- 24 solar-term boundaries
- True Solar Time
- longitude and timezone correction
- DST offsets
- Zi-hour day-boundary rules
- lunar-to-solar conversion
- branch interactions

This server gives the AI agent stable JSON, then lets the model focus on explanation and interpretation.

## Install

Run it with `npx`:

```bash
npx -y @openfate/bazi-mcp
```

For MCPB-compatible clients and Smithery, build the self-contained local bundle:

```bash
npm run mcpb:pack
```

The upload-ready artifact is written to `release/openfate-bazi-mcp-v<version>.mcpb`.

To publish that local bundle to Smithery after `smithery auth login`:

```bash
npm run smithery:publish
```

## Claude Desktop

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

If Claude Desktop cannot find `npx` on macOS, use the absolute path:

```jsonc
{
  "mcpServers": {
    "openfate-bazi": {
      "command": "/opt/homebrew/bin/npx",
      "args": ["-y", "@openfate/bazi-mcp"]
    }
  }
}
```

## Cursor

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

## Cline

```jsonc
{
  "mcpServers": {
    "openfate-bazi": {
      "command": "npx",
      "args": ["-y", "@openfate/bazi-mcp"],
      "disabled": false
    }
  }
}
```

## Agent Skill

This repository also includes a portable Agent Skill:

```txt
skills/openfate-bazi/SKILL.md
```

Use it when you want Claude, Claude Code, Codex, OpenClaw-style agents, or other `SKILL.md` compatible tools to remember how to use the OpenFate Bazi MCP correctly.

For Claude Code workspace usage, copy the skill folder to:

```txt
.claude/skills/openfate-bazi/
```

For Claude custom Skills, zip the `openfate-bazi` folder with `SKILL.md` at the folder root and upload it in Claude's Skills settings.

## Tools

### `calculate_bazi_chart`

Calculates a deterministic Bazi chart.

Inputs:

- `year`
- `month`
- `day`
- `hour`
- `minute`
- `second`
- `gender`
- `calendarType`
- `isLeapMonth`
- `longitude`
- `timezone`
- `timezoneId`
- `dstOffset`
- `enableTrueSolarTime`
- `dayBoundaryMode`

The MCP fixes the onset policy to `DAYUN_SECOND_V2`; callers cannot silently select a
different rule. Pass an exact birth time plus `timezone` or `timezoneId` for a calculated
receipt. Present an exact onset only when `chart.daYun.timing.status` is `CALCULATED` and
its version is `DAYUN_SECOND_V2`. An `UNAVAILABLE` receipt identifies the reason and marks
the retained legacy scalar fields as a fallback. Pass `longitude` as well for True Solar
Time correction.

### `detect_bazi_interactions`

Detects raw Earthly Branch relationship occurrences for a natal chart, with optional annual and Da Yun branches.

Inputs are `yearBranch`, `monthBranch`, `dayBranch`, optional `hourBranch`, optional `annualBranch`, and optional `dayunBranch`. Omit `hourBranch` when birth time is unknown; it is not replaced with an assumed branch. Existing annual-only calls remain supported.

Supported interaction types:

- clash
- six-combination
- central-branch half-trine (`COMBINATION_HALF`)
- trine
- directional
- punishment
- destruction
- harm

Every matching pillar occurrence is preserved. For example, `{ yearBranch: '申', monthBranch: '寅', dayBranch: '申', hourBranch: '申' }` returns three distinct 寅申 clashes, not one. Annual and Da Yun branches keep separate `annual` and `dayun` roles even when their branch values match natal positions.

The half-trine profile covers 申子、子辰、寅午、午戌、亥卯、卯未、巳酉、酉丑: each pair includes a central branch (子午卯酉). Endpoint-only pairs such as 申辰 are not this half-trine type. Half-trines remain in raw output when the full three-branch trine is also present.

Each occurrence has a stable `id` and aligned `branches` / `pillars` arrays. `targetElement` means relationship affinity, not transformed energy. Combination `transformationStatus` is `NOT_EVALUATED`: branch-only presence does not establish transformation or its failure. Other relationship types use `NOT_APPLICABLE`. These results are not scored weights and do not automatically cancel clashes; settlement and interpretation belong to a separate analysis layer.

For API compatibility, full `TRINE` and `DIRECTIONAL` occurrences also retain legacy `resultElement`, equal to `targetElement` and carrying the same affinity-only meaning. Six-combinations and half-trines do not emit `resultElement`.

### `calculate_true_solar_time`

Calculates True Solar Time directly.

Use this when a user asks why OpenFate's hour pillar differs from a clock-time tool.

### `reverse_bazi_to_solar_times`

Finds possible Gregorian datetimes for a four-pillar Bazi string.

Example input:

```txt
戊寅 己未 己卯 辛未
```

This is a candidate finder. For final accuracy, recalculate the result with exact longitude, timezone, and True Solar Time.

### `get_openfate_bazi_policy`

Returns OpenFate calculation policy:

- True Solar Time is preferred when location data is available.
- Default day-boundary mode is `ZI_HOUR_23`.
- DST should be passed as `dstOffset` when birth certificate time includes daylight saving.
- Da Yun onset uses `DAYUN_SECOND_V2`; exact dates require a calculated timing receipt.
- Reverse lookup should be treated as a candidate search.
- Branch interactions preserve raw pillar occurrences, not weighted or automatically transformed outcomes.

### `get_openfate_bazi_resources`

Returns canonical OpenFate links for charting, readings, compatibility, wealth, true solar time, and `llms.txt`.

## Output Shape

Responses use machine-friendly English keys:

```jsonc
{
  "data": {
    "chart": {},
    "policy": {}
  },
  "attribution": {
    "brand": "OpenFate.ai",
    "url": "https://openfate.ai",
    "engine": "@openfate/bazi-engine",
    "trueSolarTimeEngine": "@openfate/true-solar-time"
  }
}
```

Attribution is returned as first-class data, not hidden `_meta`, so MCP clients and generated artifacts can display it reliably.

Chart results include enriched pillar facts (Ten Gods, hidden stems, Na Yin, Xun, void branches, and growth stages), a versioned Da Yun timing receipt, normalized solar/lunar calendar data, and the calculation policy actually applied.

## Development

```bash
npm install
npm run build
npm run smoke
```

The smoke test spawns the built stdio server and drives it through the real MCP SDK client.

To test source changes without building `dist`, run `npm run smoke:source`. This requires the sibling `../bazi-engine` source checkout with its dependencies installed, as well as this package's dependencies. The test-only `tests/tsconfig.source.json` maps `@openfate/bazi-engine` to that sibling's `src/index.ts`; the smoke runner passes this configuration to the SDK-spawned server and asserts the resolved source path before testing. It does not rely on a patched installed engine and remains reproducible after `npm ci --ignore-scripts` in this package.

Both smoke modes exercise the same MCP transport and regression fixtures, including
second-resolved Da Yun onset, missing timing inputs, repeated branches, eight half-trines,
unknown hour, and annual/Da Yun roles. The ordinary `smoke` command still tests built MCP
output against its installed published engine dependency. `npx tsc --noEmit -p
tests/tsconfig.source.json` checks the coordinated source contract without emitting build files.

### Engine compatibility

Version 0.3 requires `@openfate/bazi-engine` version 2. Its `DAYUN_SECOND_V2`,
raw-occurrence, and `dayunBranch` contracts are verified in both the built-package
and coordinated-source smoke modes. The published dependency remains the release
source of truth; this package does not use a local `file:` dependency.

## Privacy

This package does not phone home. Calculations run locally in the MCP subprocess.

## OpenFate Links

- [OpenFate.ai](https://openfate.ai)
- [Free Bazi Chart Calculator](https://openfate.ai/en/bazi-chart)
- [AI Bazi Reading](https://openfate.ai/en/bazi)
- [Bazi Compatibility](https://openfate.ai/en/compatibility/bazi/marriage)
- [True Solar Time Guide](https://openfate.ai/en/insights/true-solar-time)
- [OpenFate llms.txt](https://openfate.ai/llms.txt)

## License

MIT

---

## 繁體中文（台灣）

OpenFate Bazi MCP 是一個給 AI Agent 使用的 Model Context Protocol 伺服器，讓 Claude Desktop、Cursor、Cline、Continue 等工具可以直接呼叫準確的八字／四柱排盤引擎。

本專案由 [OpenFate.ai](https://openfate.ai) 提供。OpenFate 是結合八字、紫微斗數與占星的 AI 命理平台。你也可以使用免費的 [八字排盤工具](https://openfate.ai/zh-hant/bazi-chart)、產生完整的 [AI 八字解讀](https://openfate.ai/zh-hant/bazi)、查看 [八字合盤](https://openfate.ai/zh-hant/compatibility/bazi/marriage)，或閱讀 [真太陽時說明](https://openfate.ai/zh-hant/insights/true-solar-time)。AI crawler 也可以讀取 [OpenFate llms.txt](https://openfate.ai/llms.txt)。

這個 MCP 包裝了 OpenFate 的確定性計算套件：

- `@openfate/bazi-engine`
- `@openfate/true-solar-time`

目標很直接：不要讓大型語言模型自己亂算干支、節氣、真太陽時，而是把排盤交給可驗證的計算引擎。

## 為什麼需要這個 MCP

八字排盤不是文字推理題，而是確定性的曆法與時間計算。容易出錯的部分包括：

- 二十四節氣邊界
- 真太陽時
- 經度與時區校正
- 夏令時間偏移
- 子時換日規則
- 農曆轉公曆
- 地支刑沖合害等互動

這個伺服器會回傳穩定 JSON，讓 AI 專心做說明、整理與解讀。

## 安裝

直接用 `npx` 執行：

```bash
npx -y @openfate/bazi-mcp
```

如果 MCP client 支援 MCPB，或需要發布到 Smithery，可以建立完整的本機安裝 bundle：

```bash
npm run mcpb:pack
```

可上傳的檔案會輸出到 `release/openfate-bazi-mcp-v<version>.mcpb`。

完成 `smithery auth login` 後，可發布這個本機 bundle 到 Smithery：

```bash
npm run smithery:publish
```

## Claude Desktop 設定

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

如果 macOS 上 Claude Desktop 找不到 `npx`，可以改用絕對路徑：

```jsonc
{
  "mcpServers": {
    "openfate-bazi": {
      "command": "/opt/homebrew/bin/npx",
      "args": ["-y", "@openfate/bazi-mcp"]
    }
  }
}
```

## Cursor 設定

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

## Cline 設定

```jsonc
{
  "mcpServers": {
    "openfate-bazi": {
      "command": "npx",
      "args": ["-y", "@openfate/bazi-mcp"],
      "disabled": false
    }
  }
}
```

## Agent Skill

這個 repository 也包含一個可攜式 Agent Skill：

```txt
skills/openfate-bazi/SKILL.md
```

當你希望 Claude、Claude Code、Codex、OpenClaw-style agent，或其他支援 `SKILL.md` 的工具記住如何正確使用 OpenFate Bazi MCP 時，可以使用這個 Skill。

如果要在 Claude Code workspace 使用，請把整個 skill folder 複製到：

```txt
.claude/skills/openfate-bazi/
```

如果要做 Claude custom Skill，請把 `openfate-bazi` folder 壓成 zip，確保 `SKILL.md` 位於 folder root，再到 Claude 的 Skills 設定中上傳。

## 工具列表

### `calculate_bazi_chart`

計算確定性的八字命盤。

輸入欄位：

- `year`
- `month`
- `day`
- `hour`
- `minute`
- `second`
- `gender`
- `calendarType`
- `isLeapMonth`
- `longitude`
- `timezone`
- `timezoneId`
- `dstOffset`
- `enableTrueSolarTime`
- `dayBoundaryMode`

MCP 固定使用 `DAYUN_SECOND_V2`，呼叫端不能暗中切換起運規則。精確出生時間還要搭配
`timezone` 或 `timezoneId`，並且只有 `chart.daYun.timing.status` 為 `CALCULATED`、版本為
`DAYUN_SECOND_V2` 時才能呈現精確起運時間。`UNAVAILABLE` 會說明原因，原有起運欄位只作
明確標記的舊版 fallback。若要校正真太陽時，還應提供 `longitude`。

### `detect_bazi_interactions`

偵測本命盤及選填流年、大運地支的原始關係。

輸入欄位為 `yearBranch`、`monthBranch`、`dayBranch`，以及選填的 `hourBranch`、`annualBranch`、`dayunBranch`。出生時辰未知時省略 `hourBranch`，不會補入假設時柱。原有只傳流年的呼叫方式仍可使用。

支援類型：

- 沖
- 六合
- 含旺支的半合（`COMBINATION_HALF`）
- 三合
- 三會
- 刑
- 破
- 害

同一地支出現在不同柱位時，每個關係都會保留。例如申、寅、申、申會回傳三組不同柱位的寅申沖。流年與大運分別使用 `annual`、`dayun` 角色，即使地支相同，也不會與本命柱位合併。

半合口徑涵蓋申子、子辰、寅午、午戌、亥卯、卯未、巳酉、酉丑八組，每組都含子午卯酉其中一個旺支。申辰等兩端支不屬於此半合類型。三合齊全時，原始資料仍保留其中的半合關係。

每個關係包含穩定的 `id`，以及逐項對應的 `branches`、`pillars`。`targetElement` 只表示關係指向的五行，不代表已經合化。合類的 `transformationStatus` 為 `NOT_EVALUATED`，表示尚未評估合化，並非已成化或已判定不能化；其他關係使用 `NOT_APPLICABLE`。這些資料不是可直接累加的評分，也不會自動解沖；成立程度與解讀須由獨立分析層處理。

為相容既有 API，完整 `TRINE`、`DIRECTIONAL` 關係仍保留舊欄位 `resultElement`，值與 `targetElement` 相同，也僅表示五行指向。六合與半合不回傳 `resultElement`。

### `calculate_true_solar_time`

直接計算真太陽時。

當使用者問「為什麼 OpenFate 算出的時柱跟一般排盤網站不同」時，可以用這個工具說明差異。

### `reverse_bazi_to_solar_times`

用四柱八字反查可能的公曆時間。

範例輸入：

```txt
戊寅 己未 己卯 辛未
```

這是候選時間搜尋工具。最後仍應該用準確出生地經度、時區與真太陽時重新排盤。

### `get_openfate_bazi_policy`

回傳 OpenFate 的計算口徑：

- 有出生地資料時，優先使用真太陽時。
- 預設換日規則是 `ZI_HOUR_23`。
- 如果出生證明時間包含夏令時間，應傳入 `dstOffset`。
- 大運起運固定採用 `DAYUN_SECOND_V2`；只有計算成功的 timing receipt 才是精確起運時間。
- 八字反查只能當候選搜尋，不能取代精準排盤。
- 地支互動保留原始柱位關係，不代表加權分數或自動合化結果。

### `get_openfate_bazi_resources`

回傳 OpenFate 的官方連結，包括排盤、解讀、合盤、財富、真太陽時與 `llms.txt`。

## 回傳格式

回傳資料使用穩定、適合機器讀取的英文 key：

```jsonc
{
  "data": {
    "chart": {},
    "policy": {}
  },
  "attribution": {
    "brand": "OpenFate.ai",
    "url": "https://openfate.ai",
    "engine": "@openfate/bazi-engine",
    "trueSolarTimeEngine": "@openfate/true-solar-time"
  }
}
```

署名資訊會以一般資料欄位回傳，而不是藏在 `_meta`，方便 MCP client 或 AI 產生的圖表正確顯示來源。

排盤結果同時包含十神、藏干、納音、旬空、十二長生等柱位資料、版本化大運起運 receipt、標準化陽曆／農曆日期，以及實際採用的計算口徑。

## 開發

```bash
npm install
npm run build
npm run smoke
```

`smoke` 測試會啟動編譯後的 stdio server，並透過真正的 MCP SDK client 呼叫工具。

不編譯 `dist` 時可執行 `npm run smoke:source` 驗證原始碼。須具備相鄰的 `../bazi-engine` 原始碼工作目錄，且引擎與本套件都已安裝依賴。測試專用的 `tests/tsconfig.source.json` 將 `@openfate/bazi-engine` 指向該引擎的 `src/index.ts`；測試執行器會把設定傳給 MCP SDK 啟動的伺服器，並先驗證實際解析的原始碼路徑。這個模式不依賴修改過的已安裝引擎，在本套件重新執行 `npm ci --ignore-scripts` 後仍可重現。

兩種 smoke 模式使用相同 MCP 傳輸與回歸案例，涵蓋秒級起運、缺少起運輸入、重複地支、八組半合、未知時辰，以及流年／大運角色。一般 `smoke` 仍驗證編譯後 MCP 與已安裝的 npm 公開引擎。`npx tsc --noEmit -p tests/tsconfig.source.json` 可檢查協調中的原始碼契約，不產生編譯檔案。

### 引擎相容性

0.3 版需要 `@openfate/bazi-engine` 2.x。`DAYUN_SECOND_V2`、完整柱位關係與
`dayunBranch` 契約皆由已編譯套件及協調原始碼兩種 smoke 模式驗證。正式發布的
npm 依賴仍是版本來源；本套件不使用本機 `file:` 依賴。

## 隱私

這個套件不會回傳資料到 OpenFate 伺服器。所有計算都在本機 MCP subprocess 內完成。

## OpenFate 連結

- [OpenFate.ai](https://openfate.ai)
- [免費八字排盤工具](https://openfate.ai/zh-hant/bazi-chart)
- [AI 八字解讀](https://openfate.ai/zh-hant/bazi)
- [八字合盤](https://openfate.ai/zh-hant/compatibility/bazi/marriage)
- [真太陽時說明](https://openfate.ai/zh-hant/insights/true-solar-time)
- [OpenFate llms.txt](https://openfate.ai/llms.txt)

## 授權

MIT
