import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#?[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/, 'expected a hex color like #ff8800');

const keyToken = z.union([z.string(), z.number().int().min(0).max(255)]);

const colorBand = z.object({
  upTo: z.number().min(0).max(100),
  color: hexColor,
});

const baseBinding = {
  /** Stable id; also the GameSense event suffix. Letters/digits/underscore. */
  id: z.string().regex(/^[A-Za-z0-9_]+$/, 'id must be alphanumeric/underscore'),
  /** Which resolved metric drives this binding (uses its 0–100 `percent`). */
  metric: z.string().min(1),
  keys: z.array(keyToken).min(1),
};

const gaugeBinding = z.object({
  ...baseBinding,
  type: z.literal('gauge'),
  from: hexColor.default('#00ff00'),
  to: hexColor.default('#ff0000'),
});

const thresholdBinding = z.object({
  ...baseBinding,
  type: z.literal('threshold'),
  bands: z.array(colorBand).min(1),
  flash: z
    .object({ atOrAbove: z.number().min(0).max(100), hz: z.number().min(0).max(20) })
    .optional(),
});

const pulseBinding = z.object({
  ...baseBinding,
  type: z.literal('pulse'),
  color: hexColor.default('#8000ff'),
  minHz: z.number().min(0).max(20).default(1),
  maxHz: z.number().min(0).max(20).default(8),
});

const keyBinding = z.discriminatedUnion('type', [gaugeBinding, thresholdBinding, pulseBinding]);

const oledScreen = z.object({
  title: z.string().optional(),
  lines: z.array(z.string()).min(1),
});

const DEFAULT_SCREENS: z.input<typeof oledScreen>[] = [
  {
    title: 'Live block',
    lines: ['5h ${block.cost}  ${block.timeLeft}', 'use ${block.usagePct}  ${block.tokens}'],
  },
  { title: 'Burn', lines: ['burn ${block.burnRate}', 'proj ${block.projCost}'] },
  { title: 'Totals', lines: ['today ${today.cost}', 'month ${month.cost}'] },
];

const DEFAULT_BINDINGS: z.input<typeof keyBinding>[] = [
  {
    id: 'headroom',
    type: 'gauge',
    metric: 'block.usagePct',
    keys: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'],
    from: '#00ff00',
    to: '#ff0000',
  },
  { id: 'burn', type: 'pulse', metric: 'block.burnPct', keys: ['scrolllock'], color: '#8000ff' },
  {
    id: 'alert',
    type: 'threshold',
    metric: 'block.usagePct',
    keys: ['printscreen'],
    bands: [
      { upTo: 50, color: '#00ff00' },
      { upTo: 80, color: '#ffbf00' },
      { upTo: 100, color: '#ff0000' },
    ],
    flash: { atOrAbove: 95, hz: 4 },
  },
];

export const ConfigSchema = z
  .object({
    game: z
      .string()
      .regex(/^[A-Z0-9_-]+$/, 'game must be UPPERCASE A-Z, 0-9, hyphen, underscore')
      .default('CLAUDE_CODE_USAGE'),
    displayName: z.string().default('Claude Code Usage'),
    developer: z.string().default('MaySudios'),

    pollIntervalSeconds: z.number().min(1).max(3600).default(10),
    costMode: z.enum(['auto', 'calculate', 'display']).default('auto'),
    offlinePricing: z.boolean().default(false),
    sessionLengthHours: z.number().min(1).max(24).default(5),
    lookbackDays: z.number().min(0).max(3650).default(35),

    currencySymbol: z.string().default('$'),
    burnScaleTokensPerMin: z.number().min(1).default(3000),
    usageWarnPct: z.number().min(0).max(100).default(70),
    usageCriticalPct: z.number().min(0).max(100).default(90),

    oled: z
      .object({
        enabled: z.boolean().default(true),
        deviceType: z.string().default('screened'),
        rotateSeconds: z.number().min(0).max(3600).default(4),
        screens: z.array(oledScreen).min(1).default(DEFAULT_SCREENS),
      })
      .default({}),

    keys: z
      .object({
        enabled: z.boolean().default(true),
        bindings: z.array(keyBinding).default(DEFAULT_BINDINGS),
      })
      .default({}),

    planLimits: z
      .object({
        enabled: z.boolean().default(false),
        credentialsPath: z.string().optional(),
      })
      .default({}),
  })
  .strict();

export type Config = z.infer<typeof ConfigSchema>;
export type KeyBindingConfig = z.infer<typeof keyBinding>;
export type OledScreenConfig = z.infer<typeof oledScreen>;
