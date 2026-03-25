/**
 * benchify/src/index.js
 * Public API — bench(), group(), run()
 * This is what .bench.js files import from 'benchify'.
 *
 * Usage in a .bench.js file:
 *   import { bench, group, run } from 'benchify';
 *
 *   group('Array creation', () => {
 *     bench('Array.from', () => Array.from({ length: 100 }, (_, i) => i));
 *     bench('new Array fill', () => new Array(100).fill(0).map((_, i) => i));
 *   });
 *
 *   await run();
 */

import { sample } from './sampler.js';
import { computeStats } from './stats.js';
import { formatReport, formatJson } from './reporter.js';

// ─── Global Registry ──────────────────────────────────────────────────────────
// Module-level singleton. Since Node.js caches module imports, multiple
// bench() calls from the same file all register in the same list.

const _registry = {
  entries: [],
  currentGroup: null,
};

/**
 * Register a benchmark function.
 * @param {string} name - Display name for this benchmark
 * @param {Function} fn - Sync or async function to benchmark
 * @param {object} [options] - Sampling options (minSamples, minTimeMs, etc.)
 */
export function bench(name, fn, options = {}) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('bench() requires a non-empty string name');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('bench() requires a function as the second argument');
  }
  _registry.entries.push({
    name: name.trim(),
    fn,
    group: _registry.currentGroup,
    options,
  });
}

/**
 * Group related benchmarks together.
 * @param {string} name - Group display name
 * @param {Function} fn - Function that calls bench() inside it
 */
export function group(name, fn) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('group() requires a non-empty string name');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('group() requires a function as the second argument');
  }
  const prev = _registry.currentGroup;
  _registry.currentGroup = name.trim();
  fn();
  _registry.currentGroup = prev;
}

/**
 * Execute all registered benchmarks and output results.
 *
 * @param {object} [options]
 * @param {boolean} [options.json=false] - Output machine-readable JSON instead of pretty table
 * @param {boolean} [options.color=true] - Enable/disable ANSI colors
 * @param {boolean} [options.quiet=false] - Suppress output (useful when run programmatically)
 * @param {number} [options.minSamples] - Override minimum samples
 * @param {number} [options.minTimeMs] - Override minimum time per benchmark
 * @returns {Promise<object[]>} Array of group result objects
 */
export async function run(options = {}) {
  const {
    json = false,
    color = process.stdout.isTTY !== false,
    quiet = false,
    minSamples,
    minTimeMs,
  } = options;

  // Detect if we're being called from the CLI runner (subprocess mode)
  // In that case, output JSON regardless of options
  const isCliSubprocess = process.env.BENCHIFY_SUBPROCESS === '1';
  const outputJson = json || isCliSubprocess;

  const entries = [..._registry.entries];
  if (entries.length === 0) {
    if (!quiet) process.stderr.write('benchify: No benchmarks registered.\n');
    return [];
  }

  // Clear registry so run() can be called multiple times in tests
  _registry.entries = [];

  const startTime = Date.now();
  const groupMap = new Map();

  for (const entry of entries) {
    const groupName = entry.group || '';
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }

    if (!quiet && !outputJson && process.stderr.isTTY) {
      const label = entry.group ? `${entry.group} › ${entry.name}` : entry.name;
      process.stderr.write(`\r\x1b[2m  Running: ${label.substring(0, 60)}...\x1b[0m`);
    }

    const sampleOptions = {};
    if (minSamples != null) sampleOptions.minSamples = minSamples;
    if (minTimeMs != null) sampleOptions.minTimeMs = minTimeMs;
    if (entry.options) Object.assign(sampleOptions, entry.options);

    const times = await sample(entry.fn, sampleOptions);
    const stats = computeStats(times);

    groupMap.get(groupName).push({ name: entry.name, stats });
  }

  // Clear spinner line
  if (!quiet && !outputJson && process.stderr.isTTY) {
    process.stderr.write('\r\x1b[K');
  }

  const totalTimeMs = Date.now() - startTime;

  // Build groups array in registration order
  const groups = [];
  const seenGroups = new Set();
  for (const entry of entries) {
    const groupName = entry.group || '';
    if (!seenGroups.has(groupName)) {
      seenGroups.add(groupName);
      groups.push({
        name: entry.group || null,
        results: groupMap.get(groupName),
      });
    }
  }

  const meta = { totalTimeMs, benchmarkCount: entries.length };

  if (!quiet) {
    if (outputJson) {
      process.stdout.write(formatJson(groups, meta) + '\n');
    } else {
      process.stdout.write(formatReport(groups, meta, color));
    }
  }

  return groups;
}

// Re-export stats utilities for advanced users
export { computeStats } from './stats.js';
export { formatOps, formatDuration } from './stats.js';
