/* Assertions */
import assert from 'node:assert/strict';

/* MCP */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/* Engine Types */
import type { BranchInteraction } from '@openfate/bazi-engine';

/* Node */
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE_MODE = process.argv.includes('--source');
const STDIO_ENTRY = resolve(__dirname, SOURCE_MODE ? '../src/stdio.ts' : '../dist/stdio.js');
const SOURCE_TSCONFIG = resolve(__dirname, 'tsconfig.source.json');
const ENGINE_SOURCE_ENTRY = resolve(__dirname, '../../bazi-engine/src/index.ts');

interface TextContent {
  type: string;
  text: string;
}

interface ToolCallResult {
  content: TextContent[];
  structuredContent?: unknown;
  isError?: boolean;
}

interface InteractionPayload {
  data: { interactions: BranchInteraction[] };
  attribution: { brand: string };
}

interface InteractionArguments {
  yearBranch: string;
  monthBranch: string;
  dayBranch: string;
  hourBranch?: string;
  annualBranch?: string;
  dayunBranch?: string;
}

/** Verify the real transport preserves the engine's raw occurrence contract. */
async function checkInteractionContract(client: Client): Promise<void> {
  async function detect(input: InteractionArguments): Promise<BranchInteraction[]> {
    const result = await client.callTool({
      name: 'detect_bazi_interactions',
      arguments: { ...input },
    }) as ToolCallResult;
    assert.notEqual(result.isError, true);
    const payload = JSON.parse(result.content[0].text) as InteractionPayload;
    assert.equal(payload.attribution.brand, 'OpenFate.ai');
    assert.deepEqual(result.structuredContent, payload, 'structured and text envelopes must agree');
    assert.ok(Array.isArray(payload.data.interactions));
    const interactions = payload.data.interactions;
    assert.equal(new Set(interactions.map((item) => item.id)).size, interactions.length, 'IDs distinguish pillar occurrences');
    for (const interaction of interactions) {
      assert.equal(typeof interaction.id, 'string');
      assert.equal(interaction.branches.length, interaction.pillars.length);
      assert.equal(new Set(interaction.pillars).size, interaction.pillars.length, 'one pillar cannot fill two positions');
      assert.equal('weight' in interaction, false, 'raw presence has no score');
      if (['COMBINATION_2', 'COMBINATION_HALF', 'TRINE', 'DIRECTIONAL'].includes(interaction.type)) {
        assert.equal(interaction.transformationStatus, 'NOT_EVALUATED');
        if (interaction.type === 'TRINE' || interaction.type === 'DIRECTIONAL') {
          assert.equal(interaction.resultElement, interaction.targetElement, 'legacy full-group element remains only an affinity');
        } else {
          assert.equal('resultElement' in interaction, false, 'half-trines and six-combinations must not claim transformed energy');
        }
      } else {
        assert.equal(interaction.transformationStatus, 'NOT_APPLICABLE');
      }
      if (input.hourBranch === undefined) {
        assert.equal(interaction.pillars.includes('hour'), false, 'unknown hour must not become a pillar');
      }
    }
    return interactions;
  }

  function hasPair(
    item: BranchInteraction,
    type: BranchInteraction['type'],
    first: BranchInteraction['pillars'][number],
    second: BranchInteraction['pillars'][number],
  ): boolean {
    return item.type === type && item.pillars.length === 2 && item.pillars.includes(first) && item.pillars.includes(second);
  }

  for (const [yearBranch, hourBranch, expectedCount] of [
    ['子', '子', 1],
    ['申', '子', 2],
    ['申', '申', 3],
  ] as const) {
    const interactions = await detect({ yearBranch, monthBranch: '寅', dayBranch: '申', hourBranch });
    assert.equal(interactions.filter((item) => item.type === 'CLASH').length, expectedCount, 'each 寅申 pillar pair survives');
  }

  const repeated = await detect({ yearBranch: '子', monthBranch: '丑', dayBranch: '子', hourBranch: '午' });
  assert.equal(repeated.filter((item) => item.type === 'COMBINATION_2').length, 2);
  assert.ok(repeated.some((item) => hasPair(item, 'COMBINATION_2', 'year', 'month')));
  assert.ok(repeated.some((item) => hasPair(item, 'COMBINATION_2', 'day', 'month')));
  assert.equal(repeated.filter((item) => item.type === 'CLASH').length, 2, 'a raw combination does not cancel either clash');

  for (const [hourBranch, expectedCount] of [['寅', 3], ['午', 6]] as const) {
    const interactions = await detect({ yearBranch: '午', monthBranch: '午', dayBranch: '午', hourBranch });
    assert.equal(interactions.filter((item) => item.type === 'PUNISHMENT').length, expectedCount, 'self-punishment enumerates pairs');
  }

  for (const [yearBranch, monthBranch, element] of [
    ['申', '子', 'water'], ['子', '辰', 'water'],
    ['寅', '午', 'fire'], ['午', '戌', 'fire'],
    ['亥', '卯', 'wood'], ['卯', '未', 'wood'],
    ['巳', '酉', 'metal'], ['酉', '丑', 'metal'],
  ] as const) {
    const interactions = await detect({ yearBranch, monthBranch, dayBranch: '丑' });
    const half = interactions.find((item) => hasPair(item, 'COMBINATION_HALF', 'year', 'month'));
    assert.ok(half, `${yearBranch}${monthBranch} central-branch half-trine is present`);
    assert.equal(half.targetElement, element);
  }

  for (const [yearBranch, monthBranch] of [['申', '辰'], ['寅', '戌'], ['亥', '未'], ['巳', '丑']] as const) {
    const interactions = await detect({ yearBranch, monthBranch, dayBranch: '丑' });
    assert.equal(interactions.some((item) => hasPair(item, 'COMBINATION_HALF', 'year', 'month')), false, 'endpoint-only pairs are not 旺支 half-trines');
  }

  const fullTrine = await detect({ yearBranch: '申', monthBranch: '子', dayBranch: '辰' });
  assert.equal(fullTrine.filter((item) => item.type === 'TRINE').length, 1);
  assert.equal(fullTrine.filter((item) => item.type === 'COMBINATION_HALF').length, 2, 'raw half-trines coexist with the full trine');

  const annualOnly = await detect({ yearBranch: '申', monthBranch: '寅', dayBranch: '子', annualBranch: '申' });
  assert.equal(annualOnly.filter((item) => item.type === 'CLASH').length, 2, 'annual-only calls remain supported');
  assert.ok(annualOnly.some((item) => hasPair(item, 'CLASH', 'month', 'annual')));
  const dayunOnly = await detect({ yearBranch: '申', monthBranch: '寅', dayBranch: '子', dayunBranch: '申' });
  assert.equal(dayunOnly.filter((item) => item.type === 'CLASH').length, 2);
  assert.ok(dayunOnly.some((item) => hasPair(item, 'CLASH', 'month', 'dayun')));
  assert.equal(dayunOnly.some((item) => item.pillars.includes('annual')), false);
  const layered = await detect({ yearBranch: '申', monthBranch: '寅', dayBranch: '子', annualBranch: '申', dayunBranch: '申' });
  assert.equal(layered.filter((item) => item.type === 'CLASH').length, 3);
  assert.ok(layered.some((item) => hasPair(item, 'CLASH', 'month', 'annual')));
  assert.ok(layered.some((item) => hasPair(item, 'CLASH', 'month', 'dayun')));
  assert.deepEqual(
    layered.filter((item) => !item.pillars.includes('dayun')),
    annualOnly,
    'adding a Da Yun node does not rewrite existing raw occurrence IDs or relationships',
  );
  const dynamicPair = await detect({ yearBranch: '申', monthBranch: '寅', dayBranch: '子', annualBranch: '酉', dayunBranch: '丑' });
  assert.ok(dynamicPair.some((item) => hasPair(item, 'COMBINATION_HALF', 'annual', 'dayun')), 'dynamic-to-dynamic occurrences are retained');

  const invalid = await client.callTool({
    name: 'detect_bazi_interactions',
    arguments: { yearBranch: '申', monthBranch: '寅', dayBranch: '子', dayunBranch: 'invalid' },
  });
  assert.equal(invalid.isError, true, 'new dynamic input remains schema-validated');
  assert.deepEqual(
    await detect({ yearBranch: '申', monthBranch: '寅', dayBranch: '子', dayunBranch: '申' }),
    dayunOnly,
    'a rejected input does not corrupt the next valid request or close the server',
  );
}

/** Exercise the packaged or source stdio server through the MCP client. */
async function main(): Promise<void> {
  const serverEnvironment = getDefaultEnvironment();
  if (SOURCE_MODE) {
    assert.ok(existsSync(ENGINE_SOURCE_ENTRY), 'source smoke requires the sibling bazi-engine source checkout');
    serverEnvironment.TSX_TSCONFIG_PATH = SOURCE_TSCONFIG;
    // Use the same loader and environment as the SDK-spawned server. This must
    // resolve source even when npm ci restores the older published dependency.
    const resolution = spawnSync(process.execPath, [
      '--import', 'tsx', '--input-type=module', '--eval',
      "process.stdout.write(import.meta.resolve('@openfate/bazi-engine'))",
    ], { env: serverEnvironment, cwd: resolve(__dirname, '..'), encoding: 'utf8' });
    assert.equal(resolution.status, 0, resolution.stderr);
    assert.equal(
      resolution.stdout,
      pathToFileURL(realpathSync(ENGINE_SOURCE_ENTRY)).href,
      'source smoke must not silently exercise an installed engine',
    );
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: SOURCE_MODE ? ['--import', 'tsx', STDIO_ENTRY] : [STDIO_ENTRY],
    env: serverEnvironment,
    cwd: resolve(__dirname, '..'),
  });
  const client = new Client(
    { name: 'openfate-bazi-mcp-smoke', version: '0.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    assert.ok(toolNames.includes('calculate_bazi_chart'));
    assert.ok(toolNames.includes('detect_bazi_interactions'));
    assert.ok(toolNames.includes('calculate_true_solar_time'));
    assert.ok(toolNames.includes('reverse_bazi_to_solar_times'));
    assert.ok(toolNames.includes('get_openfate_bazi_policy'));
    const chartTool = tools.tools.find((tool) => tool.name === 'calculate_bazi_chart');
    assert.ok(chartTool?.inputSchema.properties?.second, 'clients can pass second-resolved birth time');
    const interactionTool = tools.tools.find((tool) => tool.name === 'detect_bazi_interactions');
    assert.ok(interactionTool);
    assert.ok(interactionTool.inputSchema.properties?.dayunBranch, 'clients can discover the Da Yun input');
    assert.equal(interactionTool.inputSchema.required?.includes('hourBranch'), false);
    assert.equal(interactionTool.inputSchema.required?.includes('annualBranch'), false);
    assert.equal(interactionTool.inputSchema.required?.includes('dayunBranch'), false);

    const chartResult = await client.callTool({
      name: 'calculate_bazi_chart',
      arguments: {
        year: 1998,
        month: 12,
        day: 13,
        hour: 12,
        minute: 0,
        gender: 'female',
        longitude: 116.39,
        timezone: 8,
        dayBoundaryMode: 'ZI_HOUR_23',
      },
    }) as ToolCallResult;
    const chartPayload = JSON.parse(chartResult.content[0].text);
    assert.equal(chartPayload.attribution.brand, 'OpenFate.ai');
    assert.equal(chartPayload.data.chart.pillars.year.stem + chartPayload.data.chart.pillars.year.branch, '戊寅');
    assert.equal(chartPayload.data.chart.pillars.year.ganZhi, '戊寅');
    assert.equal(chartPayload.data.chart.pillars.year.naYin, '城头土');
    assert.deepEqual(chartPayload.data.chart.pillars.year.voidBranches, ['申', '酉']);
    assert.equal(chartPayload.data.chart.daYun.startYear, 2000);
    assert.equal(chartPayload.data.chart.daYun.startAge, 2);
    assert.equal(chartPayload.data.chart.daYun.startDate, '2000-11-23 08:00:00');
    assert.equal(chartPayload.data.chart.daYun.timing.status, 'CALCULATED');
    assert.equal(chartPayload.data.chart.daYun.timing.version, 'DAYUN_SECOND_V2');
    assert.equal(chartPayload.data.chart.metadata.daYunTimingVersion, 'DAYUN_SECOND_V2');
    assert.equal(chartPayload.data.policy.daYunTimingVersion, 'DAYUN_SECOND_V2');
    assert.equal(chartPayload.data.chart.calendar.zodiac, '虎');
    assert.equal(chartPayload.data.chart.metadata.trueSolarTimeApplied, true);

    const kaipingResult = await client.callTool({
      name: 'calculate_bazi_chart',
      arguments: {
        year: 2001,
        month: 7,
        day: 2,
        hour: 3,
        minute: 14,
        second: 0,
        gender: 'male',
        longitude: 112.6986,
        timezoneId: 'Asia/Shanghai',
        dayBoundaryMode: 'ZI_HOUR_23',
      },
    }) as ToolCallResult;
    const kaipingPayload = JSON.parse(kaipingResult.content[0].text);
    assert.equal(kaipingPayload.data.chart.daYun.startDate, '2010-03-23 19:14:00');
    assert.deepEqual(kaipingPayload.data.chart.daYun.startOffset,
      { years: 8, months: 8, days: 21, hours: 16 });
    assert.equal(kaipingPayload.data.chart.daYun.timing.birthUtc, '2001-07-01T19:14:00Z');
    assert.equal(kaipingPayload.data.chart.daYun.timing.jieUtc, '2001-06-05T14:53:35Z');
    assert.equal(kaipingPayload.data.chart.daYun.timing.intervalSeconds, 2262025);

    const unknownTimeResult = await client.callTool({
      name: 'calculate_bazi_chart',
      arguments: { year: 2001, month: 7, day: 2, gender: 'male' },
    }) as ToolCallResult;
    assert.notEqual(unknownTimeResult.isError, true);
    const unknownTimePayload = JSON.parse(unknownTimeResult.content[0].text);
    assert.equal(unknownTimePayload.data.chart.pillars.hour, null);
    assert.equal(unknownTimePayload.data.chart.daYun.timing.status, 'UNAVAILABLE');
    assert.equal(unknownTimePayload.data.chart.daYun.timing.reason, 'UNKNOWN_BIRTH_TIME');

    const missingTimezoneResult = await client.callTool({
      name: 'calculate_bazi_chart',
      arguments: { year: 2001, month: 7, day: 2, hour: 3, minute: 14, gender: 'male' },
    }) as ToolCallResult;
    assert.notEqual(missingTimezoneResult.isError, true);
    const missingTimezonePayload = JSON.parse(missingTimezoneResult.content[0].text);
    assert.equal(missingTimezonePayload.data.chart.daYun.timing.status, 'UNAVAILABLE');
    assert.equal(missingTimezonePayload.data.chart.daYun.timing.reason, 'MISSING_TIMEZONE');

    // DST civil correction must survive the server boundary (the ...input passthrough) with
    // True Solar Time disabled — 1988-07-15 15:20 DST=1 is physically 14:20 standard, so the
    // hour pillar must be 未, not the raw-clock 申. Regression guard for engine >=1.1.1.
    const dstResult = await client.callTool({
      name: 'calculate_bazi_chart',
      arguments: {
        year: 1988,
        month: 7,
        day: 15,
        hour: 15,
        minute: 20,
        gender: 'male',
        longitude: 116.4,
        timezone: 8,
        dstOffset: 1,
        enableTrueSolarTime: false,
        dayBoundaryMode: 'ZI_HOUR_23',
      },
    }) as ToolCallResult;
    const dstPayload = JSON.parse(dstResult.content[0].text);
    assert.equal(dstPayload.data.chart.pillars.hour.branch, '未', 'DST-off dstOffset must shift 15:20→14:20 (未时) through the server');
    assert.equal(dstPayload.data.chart.metadata.trueSolarTimeApplied, false);

    const interactionResult = await client.callTool({
      name: 'detect_bazi_interactions',
      arguments: {
        yearBranch: '子',
        monthBranch: '午',
        dayBranch: '卯',
        hourBranch: '酉',
      },
    }) as ToolCallResult;
    const interactionPayload = JSON.parse(interactionResult.content[0].text);
    assert.ok(interactionPayload.data.interactions.length > 0);

    await checkInteractionContract(client);

    const policyResult = await client.callTool({
      name: 'get_openfate_bazi_policy',
      arguments: {},
    }) as ToolCallResult;
    const policyPayload = JSON.parse(policyResult.content[0].text);
    assert.equal(policyPayload.data.policy.daYunTimingVersion, 'DAYUN_SECOND_V2');
    assert.match(policyPayload.data.policy.daYunTimingGuidance, /timing\.status/);
  } finally {
    // Await subprocess shutdown on assertion failures as well as successful runs.
    try {
      await client.close();
    } finally {
      await transport.close();
    }
  }
  console.log(`[openfate-bazi-mcp] ${SOURCE_MODE ? 'source' : 'dist'} smoke passed`);
}

main().catch((error: unknown) => {
  console.error('[openfate-bazi-mcp] smoke failed:', error);
  process.exit(1);
});
