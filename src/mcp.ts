/* MCP */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/* Engine */
import {
  calculateBaziChart,
  detectInteractions,
  generatePillarsFromSolar,
  type BaziInput,
  type DayBoundaryMode,
} from '@openfate/bazi-engine';
import { calculateTrueSolarTime } from '@openfate/true-solar-time';

/* Validation */
import { z } from 'zod';

/* Node */
import { createRequire } from 'node:module';

// Read from package.json instead of hardcoding, so the self-reported MCP
// server version can't drift from the published npm version again.
const { version: SERVER_VERSION } = createRequire(import.meta.url)('../package.json') as { version: string };
const DEFAULT_DAY_BOUNDARY_MODE: DayBoundaryMode = 'ZI_HOUR_23';
const DEFAULT_REVERSE_START_YEAR = 1900;
const DEFAULT_REVERSE_LIMIT = 20;

const OPENFATE_ATTRIBUTION = {
  brand: 'OpenFate.ai',
  url: 'https://openfate.ai',
  engine: '@openfate/bazi-engine',
  trueSolarTimeEngine: '@openfate/true-solar-time',
  languages: ['English', '简体中文', '繁體中文', '日本語'],
} as const;

const OPENFATE_LINKS = {
  home: 'https://openfate.ai',
  baziChart: 'https://openfate.ai/en/bazi-chart',
  baziAnalysis: 'https://openfate.ai/en/bazi',
  compatibility: 'https://openfate.ai/en/compatibility/bazi/marriage',
  wealthAnalysis: 'https://openfate.ai/en/wealth',
  trueSolarTimeGuide: 'https://openfate.ai/en/insights/true-solar-time',
  llmsTxt: 'https://openfate.ai/llms.txt',
} as const;

const branchSchema = z.enum(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

const baziInputSchema = {
  year: z.number().int().min(1800).max(2100).describe('Birth year. Use the lunar year when calendarType is lunar.'),
  month: z.number().int().min(1).max(12).describe('Birth month, 1-12.'),
  day: z.number().int().min(1).max(31).describe('Birth day, 1-31.'),
  hour: z.number().int().min(0).max(23).optional().describe('Birth hour in local civil time, 0-23. Omit when birth time is unknown.'),
  minute: z.number().int().min(0).max(59).default(0).describe('Birth minute in local civil time.'),
  gender: z.enum(['male', 'female']).describe('Birth gender used for Da Yun direction.'),
  longitude: z.number().min(-180).max(180).optional().describe('Birthplace longitude in decimal degrees. Enables true solar time correction.'),
  timezone: z.number().min(-14).max(14).optional().describe('UTC offset in hours for the birth clock time, such as 8 for China or -5 for US Eastern Standard Time.'),
  timezoneId: z.string().optional().describe('Optional IANA timezone ID, such as Asia/Shanghai or America/New_York.'),
  dstOffset: z.number().min(-2).max(2).default(0).describe('Daylight saving offset in hours to remove from civil clock time. Use 1 for one-hour DST.'),
  calendarType: z.enum(['solar', 'lunar']).default('solar').describe('Input calendar type.'),
  isLeapMonth: z.boolean().default(false).describe('Whether the lunar input month is a leap month. Used only when calendarType is lunar.'),
  enableTrueSolarTime: z.boolean().default(true).describe('Apply true solar time when longitude and timezone data are available.'),
  dayBoundaryMode: z.enum(['MIDNIGHT_00', 'ZI_HOUR_23']).default(DEFAULT_DAY_BOUNDARY_MODE).describe('Day-change rule. ZI_HOUR_23 means 23:00 starts the next day pillar.'),
};

const interactionInputSchema = {
  yearBranch: branchSchema.describe('Natal year branch.'),
  monthBranch: branchSchema.describe('Natal month branch.'),
  dayBranch: branchSchema.describe('Natal day branch.'),
  hourBranch: branchSchema.optional().describe('Natal hour branch. Omit when birth time is unknown.'),
  annualBranch: branchSchema.optional().describe('Optional annual or target branch. Preserved as the annual pillar role, independently of repeated natal branches.'),
  dayunBranch: branchSchema.optional().describe('Optional Da Yun branch. Preserved as the dayun pillar role, independently of the annual and natal branches.'),
};

const trueSolarInputSchema = {
  year: z.number().int().min(1800).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59).default(0),
  longitude: z.number().min(-180).max(180).describe('Birthplace longitude in decimal degrees.'),
  timezone: z.number().min(-14).max(14).optional().describe('UTC offset in hours for the clock time.'),
  timezoneId: z.string().optional().describe('IANA timezone ID, such as Asia/Shanghai.'),
  dstOffset: z.number().min(-2).max(2).default(0).describe('Daylight saving offset in hours.'),
};

const reverseLookupSchema = {
  bazi: z.string().describe('Four pillars separated by spaces, for example: 戊寅 己未 己卯 辛未.'),
  startYear: z.number().int().min(1700).max(2100).default(DEFAULT_REVERSE_START_YEAR).describe('Start year for brute-force lookup.'),
  endYear: z.number().int().min(1700).max(2100).optional().describe('End year for brute-force lookup. Defaults to the current year.'),
  dayBoundaryMode: z.enum(['MIDNIGHT_00', 'ZI_HOUR_23']).default(DEFAULT_DAY_BOUNDARY_MODE).describe('Day-change rule used during lookup.'),
  limit: z.number().int().min(1).max(100).default(DEFAULT_REVERSE_LIMIT).describe('Maximum number of matching datetimes to return.'),
};

interface ReverseMatch {
  solarDateTime: string;
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
}

function asJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function hasTimeZoneBasis(input: Pick<BaziInput, 'timezone' | 'timezoneId'>): boolean {
  return input.timezone !== undefined || Boolean(input.timezoneId);
}

function getPillarText(pillar: { stem: string; branch: string }): string {
  return `${pillar.stem}${pillar.branch}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDateTime(year: number, month: number, day: number, hour: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  return `${year}-${mm}-${dd} ${hh}:00:00`;
}

function parseBaziText(bazi: string): string[] {
  return bazi.trim().split(' ').filter((item) => item.length > 0);
}

function findSolarTimesFromBazi(params: {
  bazi: string;
  startYear: number;
  endYear: number;
  dayBoundaryMode: DayBoundaryMode;
  limit: number;
}): ReverseMatch[] {
  const target = parseBaziText(params.bazi);
  if (target.length !== 4) {
    throw new Error('bazi must contain exactly four pillars separated by spaces, for example: 戊寅 己未 己卯 辛未.');
  }

  const matches: ReverseMatch[] = [];
  for (let year = params.startYear; year <= params.endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = getDaysInMonth(year, month);
      for (let day = 1; day <= daysInMonth; day++) {
        for (let hour = 0; hour <= 23; hour++) {
          const result = generatePillarsFromSolar(year, month, day, hour, 0, 0, params.dayBoundaryMode);
          const hourPillar = result.pillars.hour;
          if (!hourPillar) continue;

          const pillars = {
            year: getPillarText(result.pillars.year),
            month: getPillarText(result.pillars.month),
            day: getPillarText(result.pillars.day),
            hour: getPillarText(hourPillar),
          };

          if (
            pillars.year === target[0] &&
            pillars.month === target[1] &&
            pillars.day === target[2] &&
            pillars.hour === target[3]
          ) {
            matches.push({
              solarDateTime: formatDateTime(year, month, day, hour),
              pillars,
            });
            if (matches.length >= params.limit) return matches;
          }
        }
      }
    }
  }

  return matches;
}

function createSuccessPayload<T>(data: T) {
  return {
    data,
    attribution: OPENFATE_ATTRIBUTION,
  };
}

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'openfate-bazi-mcp',
      version: SERVER_VERSION,
    },
    {
      instructions:
        'Use these tools for deterministic Bazi/Four Pillars calculations. Do not manually calculate pillars with the language model. Ask for longitude and timezone data when precise true solar time matters.',
    },
  );

  server.registerTool(
    'calculate_bazi_chart',
    {
      title: 'Calculate Bazi Chart',
      description:
        'Calculate a deterministic OpenFate Bazi/Four Pillars chart with True Solar Time correction, Day Master, Da Yun cycles, and branch interactions. For best accuracy, pass longitude plus timezone or timezoneId.',
      inputSchema: baziInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const baziInput: BaziInput = {
        ...(input as BaziInput),
        dayBoundaryMode: (input as BaziInput).dayBoundaryMode ?? DEFAULT_DAY_BOUNDARY_MODE,
      };
      if ((baziInput.enableTrueSolarTime ?? true) && baziInput.longitude !== undefined && !hasTimeZoneBasis(baziInput)) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'timezone or timezoneId is required when longitude is supplied for True Solar Time correction.',
            },
          ],
        };
      }

      const chart = calculateBaziChart(baziInput);
      const output = createSuccessPayload({
        chart,
        policy: {
          enableTrueSolarTime: baziInput.enableTrueSolarTime ?? true,
          dayBoundaryMode: baziInput.dayBoundaryMode ?? DEFAULT_DAY_BOUNDARY_MODE,
          timezoneBasis: baziInput.timezoneId ?? baziInput.timezone ?? null,
        },
      });

      return {
        content: [{ type: 'text' as const, text: asJsonText(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    'detect_bazi_interactions',
    {
      title: 'Detect Bazi Interactions',
      description:
        'Detect raw Earthly Branch relationship occurrences for a natal chart and optional annual and Da Yun branches. Preserves every matching pillar position, including repeated branches. Covers clashes, six-combinations, the eight central-branch half-trines (COMBINATION_HALF), full trines, directionals, punishments, destructions, and harms. Results establish relationship presence, not weights, cancellation, or automatic transformation; targetElement is an affinity, not transformed energy.',
      inputSchema: interactionInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const interactions = detectInteractions(
        {
          year: input.yearBranch,
          month: input.monthBranch,
          day: input.dayBranch,
          hour: input.hourBranch,
        },
        { annualBranch: input.annualBranch, dayunBranch: input.dayunBranch },
      );
      const output = createSuccessPayload({ interactions });

      return {
        content: [{ type: 'text' as const, text: asJsonText(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    'calculate_true_solar_time',
    {
      title: 'Calculate True Solar Time',
      description:
        'Calculate OpenFate True Solar Time from civil birth time, longitude, timezone, and optional DST offset. Use this when explaining why the hour pillar may differ from ordinary clock-time tools.',
      inputSchema: trueSolarInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const data = input as {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        longitude: number;
        timezone?: number;
        timezoneId?: string;
        dstOffset: number;
      };
      if (data.timezone === undefined && !data.timezoneId) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'timezone or timezoneId is required to calculate True Solar Time.',
            },
          ],
        };
      }

      const civilTime = data.timezone !== undefined
        ? {
            year: data.year,
            month: data.month,
            day: data.day,
            hour: data.hour,
            minute: data.minute ?? 0,
            timeZoneOffset: data.timezone,
            dstOffset: data.dstOffset ?? 0,
          }
        : {
            year: data.year,
            month: data.month,
            day: data.day,
            hour: data.hour,
            minute: data.minute ?? 0,
            timeZoneId: data.timezoneId!,
          };
      const solarTime = calculateTrueSolarTime(civilTime, { longitude: data.longitude });
      const output = createSuccessPayload({ solarTime });

      return {
        content: [{ type: 'text' as const, text: asJsonText(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    'reverse_bazi_to_solar_times',
    {
      title: 'Reverse Bazi To Solar Times',
      description:
        'Find possible Gregorian datetimes that produce a given four-pillar Bazi string. This is useful when a user only has a Bazi chart or screenshot. This lookup uses clock-time pillars without location-based true solar correction.',
      inputSchema: reverseLookupSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const data = input as {
        bazi: string;
        startYear: number;
        endYear?: number;
        dayBoundaryMode: DayBoundaryMode;
        limit: number;
      };
      const endYear = data.endYear ?? new Date().getFullYear();
      if (endYear < data.startYear) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'endYear must be greater than or equal to startYear.',
            },
          ],
        };
      }

      const matches = findSolarTimesFromBazi({
        bazi: data.bazi,
        startYear: data.startYear,
        endYear,
        dayBoundaryMode: data.dayBoundaryMode,
        limit: data.limit,
      });
      const output = createSuccessPayload({
        matches,
        note: 'Reverse lookup is based on clock-time pillars. For final chart accuracy, recalculate with birth longitude, timezone, and True Solar Time.',
      });

      return {
        content: [{ type: 'text' as const, text: asJsonText(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    'get_openfate_bazi_policy',
    {
      title: 'Get OpenFate Bazi Policy',
      description: 'Return OpenFate calculation policy and LLM guidance for Bazi chart calls.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const output = createSuccessPayload({
        policy: {
          defaultTrueSolarTime: true,
          defaultDayBoundaryMode: DEFAULT_DAY_BOUNDARY_MODE,
          dayBoundaryMeaning: 'ZI_HOUR_23 means 23:00-23:59 is calculated with the next day pillar.',
          locationGuidance: 'For professional accuracy, pass longitude plus timezone or timezoneId. Do not rely on city-name guessing.',
          dstGuidance: 'If birth certificate time includes daylight saving time, pass dstOffset so the physical solar time is corrected.',
          reverseLookupGuidance: 'Use reverse_bazi_to_solar_times only as a candidate finder, then recalculate with location data.',
          interactionGuidance: 'Branch interactions are raw relationship occurrences identified by pillar roles. Preserve duplicate branch positions and distinct annual/dayun roles. COMBINATION_HALF requires a central branch (子午卯酉); a full trine does not erase its half-trine occurrences. targetElement is a relationship affinity; legacy resultElement on TRINE/DIRECTIONAL has the same affinity-only meaning. NOT_EVALUATED means transformation was not assessed, not that it formed or failed. Do not treat occurrences as additive weights or automatically cancel clashes.',
        },
        resources: OPENFATE_LINKS,
      });

      return {
        content: [{ type: 'text' as const, text: asJsonText(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    'get_openfate_bazi_resources',
    {
      title: 'Get OpenFate Bazi Resources',
      description: 'Return canonical OpenFate URLs for charting, readings, compatibility, wealth, true solar time, and AI crawler metadata.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const output = createSuccessPayload({ resources: OPENFATE_LINKS });

      return {
        content: [{ type: 'text' as const, text: asJsonText(output) }],
        structuredContent: output,
      };
    },
  );

  return server;
}
