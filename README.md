# OpenFate Bazi MCP

**Seven local BaZi tools for Claude Code, Claude Desktop and Cursor.** Give your assistant a birth time and it can calculate the Four Pillars, explain the solar-time correction or return a Traditional Chinese relationship chapter with the rule and chart fields behind it. The server runs on your computer and needs no OpenFate API key.

**中文快速開始**：[下載桌面安裝包](https://github.com/openfate-ai/openfate-mcp/releases/download/v0.4.0/openfate-bazi-mcp-v0.4.0.mcpb) · [一行接入 Claude Code](#connect-zh) · [試問一張盤](#first-chart-zh)

**[Install](#install)** · [Try the two-chart example](https://openfate-ai.github.io/bazi-engine/compare/) · [Tool reference](#tools) · [繁體中文](#zh-hant)

Building a charting website or looking for training data? The companion **OpenFate Bazi Engine** publishes the TypeScript SDK and a separate offline corpus of **1,112,328 chart samples and 14,460,264 life chapters**. The MCP server computes each chart on demand. [Engine and corpus downloads](https://github.com/openfate-ai/bazi-engine)

## Install

**Claude Desktop.** Download the [v0.4.0 desktop extension (.mcpb)](https://github.com/openfate-ai/openfate-mcp/releases/download/v0.4.0/openfate-bazi-mcp-v0.4.0.mcpb) and open it in a client that supports desktop extensions. The release includes its runtime dependencies. [Release notes](https://github.com/openfate-ai/openfate-mcp/releases/tag/v0.4.0)

**Claude Code.** With Node.js 20+ and `npx` on your path, run:

```sh
claude mcp add --transport stdio openfate-bazi -- npx -y @openfate/bazi-mcp@0.4.0
```

Run `claude mcp get openfate-bazi` to check the connection. **Cursor and Cline** can launch the same stdio server using the JSON configurations below. Running `npx -y @openfate/bazi-mcp@0.4.0` directly starts a process that waits for an MCP client on stdin. [Claude Code MCP setup](https://code.claude.com/docs/en/mcp)

### Try one chart

Paste this into your connected client:

> Use `read_bazi_relationship` for August 15, 1997, female, 08:30 local time, UTC+8, no DST, longitude 120° east. Run it again at 12:30. Show both hour pillars, the rule IDs and the chart evidence for each reading.

| Local time | Hour pillar | Selected rule | Evidence in `data.chart` |
| --- | --- | --- | --- |
| 08:30 | 戊辰 | `day-hour-destruction` | `DESTRUCTION:day:丑\|hour:辰` |
| 12:30 | 庚午 | `day-hour-harm` | `HARM:day:丑\|hour:午` |

Look in `data.reading.evidence` for the chart pointer. In both examples the relationship ID is at `/interactions/1/id`. Omit the birth time entirely and the reading reports `unknown-hour`. [Open these two charts in the browser](https://openfate-ai.github.io/bazi-engine/compare/) · [Chapter rules](https://github.com/openfate-ai/bazi-engine/blob/main/src/readings/relationship.ts)

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

Add the entry below to `.cursor/mcp.json` in your project, or to `~/.cursor/mcp.json` to make it available across projects. Keep any existing servers in the file. [Cursor MCP configuration](https://cursor.com/docs/mcp)

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

| If your user asks… | Call |
| --- | --- |
| “What are my four pillars and first luck cycle?” | `calculate_bazi_chart` |
| “What changed in the reading when I changed the hour?” | `read_bazi_relationship` |
| “Which two branches actually clash?” | `detect_bazi_interactions` |
| “How did 08:30 on the clock become a different solar time?” | `calculate_true_solar_time` |
| “I have four pillars from a book. Which dates could fit?” | `reverse_bazi_to_solar_times` |
| “Does this tool change the day at 23:00?” | `get_openfate_bazi_policy` |
| “Where can I open the chart or continue reading?” | `get_openfate_bazi_resources` |

### `read_bazi_relationship`

Returns the calculated chart and a Traditional Chinese relationship chapter in `data.reading`. The response includes `ruleId`, `rulesVersion`, and evidence pointers relative to `data.chart`. Omit the hour to receive the explicit `unknown-hour` status. This tool uses the same deterministic chapter function as the npm SDK and the [browser comparison](https://openfate-ai.github.io/bazi-engine/compare/).

Try `{"year":1997,"month":8,"day":15,"hour":8,"minute":30,"gender":"female","timezone":8,"dstOffset":0,"longitude":120}`. Change only the hour to 12 to compare a day–hour destruction with a day–hour harm.

When both timezone forms are supplied, an explicit numeric timezone **and** DST offset take precedence. Omit the DST offset to let the IANA zone resolve the historical clock. The response reports the basis actually used.

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

To build a desktop extension from a source checkout, install dependencies and run `npm run mcpb:pack`. The artifact is written to `release/openfate-bazi-mcp-v<version>.mcpb`. Maintainers publishing a local bundle to Smithery can use `npm run smithery:publish` after `smithery auth login`.

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

Version 0.4 uses `@openfate/bazi-engine@^2.1.0`. The stdio smoke test calls the installed server, compares its chapter and chart with the SDK, and checks unknown birth times and historical DST. [Test cases](tests/smoke-stdio.ts)

## Privacy

Chart calculations run in the local MCP subprocess. The host client receives the tool arguments and results and handles the conversation under its own settings.

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

<a id="zh-hant"></a>

## 繁體中文（台灣）

**7 個本機八字工具**，把排盤、真太陽時換算和感情解讀接進 Claude 或 Cursor。輸入出生年月日時，工具會交回四柱；問起運日期，回傳結果也保留取節與折算依據。使用這套工具無需 OpenFate API 金鑰。

可以先讀 1997 年 8 月 15 日的 08:30 和 12:30 兩張盤。前一篇問約好買菜卻沒買成，在哪一步漏了交接。後一篇問替對方做了哪個決定，讓原本的一番好意變了味。用瀏覽器打開兩篇，再用下面的工具輸入同一組資料，就能核對結果。[雙盤對照](https://openfate-ai.github.io/bazi-engine/compare/) · [命例教材](https://github.com/openfate-ai/bazi-engine/blob/main/learn/README.md) · [逐年命盤資料](https://github.com/openfate-ai/bazi-engine/releases/tag/corpus-v2.1.0)

## 安裝

<a id="connect-zh"></a>

**Claude Desktop** 可直接[下載 v0.4.0 桌面擴充套件](https://github.com/openfate-ai/openfate-mcp/releases/download/v0.4.0/openfate-bazi-mcp-v0.4.0.mcpb)，在支援 MCPB 的客戶端開啟。安裝包已包含所需依賴。

**Claude Code** 使用 Node.js 20 以上的環境，確認終端機找得到 `npx`，再執行：

```sh
claude mcp add --transport stdio openfate-bazi -- npx -y @openfate/bazi-mcp@0.4.0
```

用 `claude mcp get openfate-bazi` 查看連線狀態。Cursor 或 Cline 可使用下方 JSON 設定。若直接執行 `npx -y @openfate/bazi-mcp@0.4.0`，程式會等待客戶端從標準輸入送來請求。[Claude Code 安裝說明](https://code.claude.com/docs/en/mcp)

<a id="first-chart-zh"></a>

### 裝好後，把這句貼進對話

> 請用 `read_bazi_relationship` 比較兩張盤。1997 年 8 月 15 日，女，東經 120°、UTC+8、無夏令時間。第一張用 08:30，第二張用 12:30。請列出兩個時柱、各自選中的規則，以及命盤中對應的地支關係。

| 民用時刻 | 時柱 | 工具回傳的規則 | 正文從哪件事談起 |
| --- | --- | --- | --- |
| 08:30 | 戊辰 | `day-hour-destruction` | 兩人說好輪流買菜，哪一步交接漏了？ |
| 12:30 | 庚午 | `day-hour-harm` | 菜買好了，但邀朋友來吃飯這件事，對方想自己決定嗎？ |

兩次回傳的 `data.reading.evidence` 都可對回 `data.chart`。想改這段文字，打開同一份[解讀規則](https://github.com/openfate-ai/bazi-engine/blob/main/src/readings/relationship.ts)。想批次讀各年份的 13 章生活解讀，可到引擎專案下載 **111 萬筆排盤樣本、1,446 萬章生活解讀**的[開放資料集](https://github.com/openfate-ai/bazi-engine/releases/tag/corpus-v2.1.0)。

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

將下方設定併入專案的 `.cursor/mcp.json`。若要在不同專案使用，可放在 `~/.cursor/mcp.json`。[Cursor 設定檔位置](https://cursor.com/docs/mcp)

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

| 你想查什麼 | 工具 |
| --- | --- |
| 四柱、十神、九步大運與起運依據 | `calculate_bazi_chart` |
| 感情章的正文、規則與命盤引用 | `read_bazi_relationship` |
| 哪兩柱相沖，加入流年後多出哪些關係 | `detect_bazi_interactions` |
| 出生鐘點換成真太陽時的結果 | `calculate_true_solar_time` |
| 古書只留四柱，哪些公曆日期可能符合 | `reverse_bazi_to_solar_times` |
| 換日或起運採用的設定 | `get_openfate_bazi_policy` |
| 線上排盤與延伸閱讀入口 | `get_openfate_bazi_resources` |

### `read_bazi_relationship`

接受和排盤工具相同的出生輸入。感情章在 `data.reading`，其中的 `evidence` 記錄原始值與它在 `data.chart` 的位置。省略出生時辰時，回傳 `unknown-hour`。同時提供 IANA 時區名稱與數字時區時，明確填入的數字時區及夏令時間偏移優先；偏移資料填不齊時，依 IANA 時區換算。可從 `timezoneBasis` 查閱實際採用的設定。

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

若要從原始碼製作桌面擴充套件，請先安裝依賴，再執行 `npm run mcpb:pack`。成品位於 `release/openfate-bazi-mcp-v<version>.mcpb`。維護者可於 Smithery 登入後使用 `npm run smithery:publish`。

```bash
npm install
npm run build
npm run smoke
```

`smoke` 測試會啟動編譯後的 stdio server，並透過真正的 MCP SDK client 呼叫工具。

不編譯 `dist` 時可執行 `npm run smoke:source` 驗證原始碼。須具備相鄰的 `../bazi-engine` 原始碼工作目錄，且引擎與本套件都已安裝依賴。測試專用的 `tests/tsconfig.source.json` 將 `@openfate/bazi-engine` 指向該引擎的 `src/index.ts`；測試執行器會把設定傳給 MCP SDK 啟動的伺服器，並先驗證實際解析的原始碼路徑。這個模式不依賴修改過的已安裝引擎，在本套件重新執行 `npm ci --ignore-scripts` 後仍可重現。

兩種 smoke 模式使用相同 MCP 傳輸與回歸案例，涵蓋秒級起運、缺少起運輸入、重複地支、八組半合、未知時辰，以及流年／大運角色。一般 `smoke` 仍驗證編譯後 MCP 與已安裝的 npm 公開引擎。`npx tsc --noEmit -p tests/tsconfig.source.json` 可檢查協調中的原始碼契約，不產生編譯檔案。

### 引擎相容性

0.4 版使用 `@openfate/bazi-engine@^2.1.0`。測試會啟動 stdio 伺服器，比對 MCP 與 SDK 回傳的命盤和解讀，並涵蓋出生時辰不詳及歷史夏令時間。[測試命例](tests/smoke-stdio.ts)

## 隱私

排盤在本機 MCP 程序中執行。你選用的 AI 客戶端會收到工具輸入與結果，並依該客戶端的設定處理對話。

## OpenFate 連結

- [OpenFate.ai](https://openfate.ai)
- [免費八字排盤工具](https://openfate.ai/zh-hant/bazi-chart)
- [AI 八字解讀](https://openfate.ai/zh-hant/bazi)
- [八字合盤](https://openfate.ai/zh-hant/compatibility/bazi/marriage)
- [真太陽時說明](https://openfate.ai/zh-hant/insights/true-solar-time)
- [OpenFate llms.txt](https://openfate.ai/llms.txt)

## 授權

MIT
