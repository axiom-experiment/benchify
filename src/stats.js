/**
 * benchify/src/stats.js
 * Statistical calculation functions for benchmark results.
 * All timing inputs are in milliseconds.
 */

/**
 * Calculate arithmetic mean of an array of numbers.
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate the median of an array of numbers.
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate a percentile value from an array of numbers.
 * @param {number[]} values
 * @param {number} p - Percentile between 0 and 100
 * @returns {number}
 */
export function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  if (p <= 0) return Math.min(...values);
  if (p >= 100) return Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const fraction = index - lower;
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

/**
 * Calculate population standard deviation.
 * @param {number[]} values
 * @returns {number}
 */
export function stdDev(values) {
  if (!values || values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squaredDiffs));
}

/**
 * Calculate operations per second from array of per-iteration times (ms).
 * @param {number[]} timesMs - Array of elapsed times in milliseconds per iteration
 * @returns {number} operations per second
 */
export function opsPerSecond(timesMs) {
  if (!timesMs || timesMs.length === 0) return 0;
  const avgMs = mean(timesMs);
  if (avgMs <= 0) return Infinity;
  return 1000 / avgMs;
}

/**
 * Calculate 95% confidence interval margin of error.
 * Uses t-distribution approximation for small samples, z=1.96 for large.
 * @param {number[]} values
 * @returns {number} margin of error as percentage of mean (0-100)
 */
export function marginOfError(values) {
  if (!values || values.length < 2) return 0;
  const sd = stdDev(values);
  const avg = mean(values);
  if (avg === 0) return 0;
  // 95% CI: z = 1.96 for n >= 30, t-approx for smaller
  const z = values.length >= 30 ? 1.96 : 2.0;
  const se = sd / Math.sqrt(values.length);
  return (z * se / avg) * 100;
}

/**
 * Format a number as human-readable ops/sec.
 * @param {number} ops
 * @returns {string}
 */
export function formatOps(ops) {
  if (!isFinite(ops)) return '∞ ops/sec';
  if (ops >= 1_000_000_000) return `${(ops / 1_000_000_000).toFixed(2)}B ops/sec`;
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M ops/sec`;
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(2)}K ops/sec`;
  return `${ops.toFixed(2)} ops/sec`;
}

/**
 * Format elapsed milliseconds as human-readable duration.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(2)}ps`;
  if (ms < 1) return `${(ms * 1_000).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(3)}ms`;
  return `${(ms / 1000).toFixed(3)}s`;
}

/**
 * Compute full statistics object for a set of timing samples.
 * @param {number[]} timesMs - Per-iteration elapsed times in milliseconds
 * @returns {object} Full statistics result
 */
export function computeStats(timesMs) {
  if (!timesMs || timesMs.length === 0) {
    return {
      samples: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      p75: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      moe: 0,
      opsPerSecond: 0,
    };
  }

  const avg = mean(timesMs);
  const ops = opsPerSecond(timesMs);

  return {
    samples: timesMs.length,
    mean: avg,
    median: median(timesMs),
    min: Math.min(...timesMs),
    max: Math.max(...timesMs),
    p75: percentile(timesMs, 75),
    p95: percentile(timesMs, 95),
    p99: percentile(timesMs, 99),
    stdDev: stdDev(timesMs),
    moe: marginOfError(timesMs),
    opsPerSecond: ops,
  };
}
