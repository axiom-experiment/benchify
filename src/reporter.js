/**
 * benchify/src/reporter.js
 * Terminal output formatting for benchmark results.
 * Supports pretty TTY output and machine-readable JSON mode.
 */

import { formatOps, formatDuration } from './stats.js';

// ─── ANSI Color Helpers ────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  bgGreen: '\x1b[42m',
};

/**
 * Apply color if output supports it.
 * @param {string} text
 * @param {string} color
 * @param {boolean} useColor
 * @returns {string}
 */
export function colorize(text, color, useColor = true) {
  if (!useColor || !COLORS[color]) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/**
 * Pad a string to a fixed width.
 * @param {string} str
 * @param {number} width
 * @param {string} direction - 'left' or 'right'
 */
export function pad(str, width, direction = 'right') {
  const s = String(str);
  const diff = Math.max(0, width - s.length);
  const padding = ' '.repeat(diff);
  return direction === 'left' ? padding + s : s + padding;
}

/**
 * Calculate relative speed compared to the fastest result.
 * @param {number} ops - This benchmark's ops/sec
 * @param {number} fastestOps - Fastest benchmark's ops/sec
 * @returns {string}
 */
export function formatRelativeSpeed(ops, fastestOps) {
  if (ops >= fastestOps) return 'fastest';
  const ratio = fastestOps / ops;
  return `${ratio.toFixed(2)}x slower`;
}

/**
 * Format a single benchmark result row for TTY output.
 * @param {object} result
 * @param {boolean} isFastest
 * @param {number} fastestOps
 * @param {boolean} useColor
 * @returns {string}
 */
export function formatResultRow(result, isFastest, fastestOps, useColor = true) {
  const nameWidth = 40;
  const opsWidth = 18;
  const moeWidth = 12;
  const speedWidth = 16;

  const name = pad(result.name, nameWidth);
  const ops = pad(formatOps(result.stats.opsPerSecond), opsWidth, 'left');
  const moe = pad(`±${result.stats.moe.toFixed(1)}%`, moeWidth, 'left');
  const samples = pad(`(${result.stats.samples} samples)`, 16);

  let speed = formatRelativeSpeed(result.stats.opsPerSecond, fastestOps);
  if (isFastest) {
    speed = colorize('fastest', 'green', useColor);
  } else {
    speed = colorize(speed, 'yellow', useColor);
  }

  const nameStr = isFastest
    ? colorize(name, 'bold', useColor)
    : colorize(name, 'white', useColor);

  const opsStr = colorize(ops, 'cyan', useColor);
  const moeStr = colorize(moe, 'gray', useColor);
  const samplesStr = colorize(samples, 'gray', useColor);

  return `  ${nameStr} ${opsStr} ${moeStr} ${samplesStr} ${speed}`;
}

/**
 * Format a group of benchmark results.
 * @param {string} groupName
 * @param {object[]} results - Array of {name, stats} objects
 * @param {boolean} useColor
 * @returns {string}
 */
export function formatGroup(groupName, results, useColor = true) {
  if (!results || results.length === 0) return '';

  const lines = [];

  // Group header
  const header = groupName
    ? colorize(`\n  ${groupName}`, 'bold', useColor)
    : '';
  if (header) lines.push(header);

  // Find fastest
  const fastestOps = Math.max(...results.map(r => r.stats.opsPerSecond));

  // Column headers
  const nameW = 40;
  const opsW = 18;
  const moeW = 12;
  const sampleW = 16;
  const headerRow = colorize(
    `  ${'Benchmark'.padEnd(nameW)} ${'ops/sec'.padStart(opsW)} ${'±'.padStart(moeW)} ${'Samples'.padEnd(sampleW)} Relative`,
    'dim',
    useColor
  );
  lines.push(headerRow);
  lines.push(colorize('  ' + '─'.repeat(nameW + opsW + moeW + sampleW + 20), 'dim', useColor));

  // Result rows
  for (const result of results) {
    const isFastest = result.stats.opsPerSecond >= fastestOps;
    lines.push(formatResultRow(result, isFastest, fastestOps, useColor));
  }

  return lines.join('\n');
}

/**
 * Format all benchmark results as a complete report.
 * @param {object[]} groups - Array of {name, results} group objects
 * @param {object} meta - {totalTime, fileCount, benchmarkCount}
 * @param {boolean} useColor
 * @returns {string}
 */
export function formatReport(groups, meta = {}, useColor = true) {
  const lines = [];

  // Header
  lines.push('');
  lines.push(colorize('  benchify', 'bold', useColor) + colorize(' — micro-benchmark runner', 'dim', useColor));
  lines.push('');

  // Groups
  for (const group of groups) {
    lines.push(formatGroup(group.name, group.results, useColor));
    lines.push('');
  }

  // Footer summary
  const totalBenches = groups.reduce((acc, g) => acc + g.results.length, 0);
  const totalTime = meta.totalTimeMs != null
    ? colorize(`  Completed ${totalBenches} benchmark${totalBenches !== 1 ? 's' : ''} in ${formatDuration(meta.totalTimeMs)}`, 'dim', useColor)
    : colorize(`  Completed ${totalBenches} benchmark${totalBenches !== 1 ? 's' : ''}`, 'dim', useColor);

  lines.push(totalTime);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format results as machine-readable JSON.
 * @param {object[]} groups
 * @param {object} meta
 * @returns {string}
 */
export function formatJson(groups, meta = {}) {
  const output = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    meta,
    groups: groups.map(g => ({
      name: g.name || null,
      results: g.results.map(r => ({
        name: r.name,
        stats: r.stats,
      })),
    })),
  };
  return JSON.stringify(output, null, 2);
}

/**
 * Print a spinner/progress indicator line (overwrite in-place on TTY).
 * @param {string} message
 * @param {boolean} useColor
 * @returns {string}
 */
export function formatProgress(message, useColor = true) {
  return colorize(`  ⏱  ${message}`, 'dim', useColor);
}
