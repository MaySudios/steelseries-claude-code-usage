/**
 * Public library surface. Importing the package gives access to the domain
 * model, application services and infrastructure adapters so the plugin can be
 * embedded or extended programmatically. The CLI lives at `cli/index.ts`.
 */

// Domain
export * from './domain/index.js';

// Application
export * from './application/cost-calculator.js';
export * from './application/usage-aggregator.js';
export * from './application/block-calculator.js';
export * from './application/usage-snapshot.js';
export * from './application/snapshot-provider.js';
export * from './application/metric-resolver.js';
export * from './application/formatters.js';
export * from './application/intervals.js';
export * from './application/plugin-service.js';
export * from './application/time.js';

// Infrastructure — Claude usage
export * from './infrastructure/claude/claude-paths.js';
export * from './infrastructure/claude/parse.js';
export * from './infrastructure/claude/jsonl-usage-source.js';

// Infrastructure — pricing
export * from './infrastructure/pricing/embedded-pricing.js';
export * from './infrastructure/pricing/litellm-pricing-provider.js';

// Infrastructure — GameSense
export * from './infrastructure/gamesense/core-props-locator.js';
export * from './infrastructure/gamesense/hid-keycodes.js';
export * from './infrastructure/gamesense/http-transport.js';
export * from './infrastructure/gamesense/gamesense-client.js';
export * from './infrastructure/gamesense/gamesense-display.js';
export * from './infrastructure/gamesense/handlers/color-handlers.js';
export * from './infrastructure/gamesense/handlers/screen-handlers.js';

// Infrastructure — Anthropic plan limits (optional)
export * from './infrastructure/anthropic/plan-usage-source.js';

// Infrastructure — config, logging, clock
export * from './infrastructure/config/schema.js';
export * from './infrastructure/config/config-loader.js';
export * from './infrastructure/config/config-paths.js';
export * from './infrastructure/config/config-template.js';
export * from './infrastructure/logging/console-logger.js';
export * from './infrastructure/system-clock.js';

// Composition
export * from './composition/build-display-plan.js';
export * from './composition/container.js';
