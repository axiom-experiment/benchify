/**
 * benchify/test/stats.test.js
 * Unit tests for statistical calculation functions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mean,
  median,
  percentile,
  stdDev,
  opsPerSecond,
  marginOfError,
  formatOps,
  formatDuration,
  computeStats,
} from '../src/stats.js';

// ─── mean() ───────────────────────────────────────────────────────────────────

describe('mean()', () => {
  it('returns correct mean of integers', () => {
    assert.equal(mean([1, 2, 3, 4, 5]), 3);
  });

  it('returns correct mean of floats', () => {
    assert.ok(Math.abs(mean([1.5, 2.5]) - 2.0) < 0.0001);
  });

  it('returns 0 for empty array', () => {
    assert.equal(mean([]), 0);
  });

  it('returns 0 for null/undefined input', () => {
    assert.equal(mean(null), 0);
    assert.equal(mean(undefined), 0);
  });

  it('handles single element', () => {
    assert.equal(mean([42]), 42);
  });
});

// ─── median() ─────────────────────────────────────────────────────────────────

describe('median()', () => {
  it('returns middle value for odd-length array', () => {
    assert.equal(median([1, 2, 3]), 2);
    assert.equal(median([5, 1, 3]), 3); // should sort internally
  });

  it('returns average of two middle values for even-length array', () => {
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([10, 20]), 15);
  });

  it('returns 0 for empty array', () => {
    assert.equal(median([]), 0);
  });

  it('handles single element', () => {
    assert.equal(median([7]), 7);
  });

  it('does not mutate original array', () => {
    const arr = [3, 1, 2];
    median(arr);
    assert.deepEqual(arr, [3, 1, 2]);
  });
});

// ─── percentile() ─────────────────────────────────────────────────────────────

describe('percentile()', () => {
  it('returns min for p=0', () => {
    assert.equal(percentile([1, 2, 3, 4, 5], 0), 1);
  });

  it('returns max for p=100', () => {
    assert.equal(percentile([1, 2, 3, 4, 5], 100), 5);
  });

  it('returns median for p=50', () => {
    assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  });

  it('interpolates between values', () => {
    const p75 = percentile([1, 2, 3, 4], 75);
    assert.ok(p75 >= 3 && p75 <= 4, `Expected between 3 and 4, got ${p75}`);
  });

  it('returns 0 for empty array', () => {
    assert.equal(percentile([], 50), 0);
  });

  it('handles p95 correctly for large array', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    const p95 = percentile(arr, 95);
    assert.ok(p95 >= 95 && p95 <= 100, `p95 should be near 95-100, got ${p95}`);
  });
});

// ─── stdDev() ─────────────────────────────────────────────────────────────────

describe('stdDev()', () => {
  it('returns 0 for identical values', () => {
    assert.equal(stdDev([5, 5, 5, 5]), 0);
  });

  it('returns correct std dev for known set', () => {
    // mean=3, diffs=[4,1,0,1,4], mean sq diff=2, stddev=sqrt(2)≈1.414
    const result = stdDev([1, 2, 3, 4, 5]);
    assert.ok(Math.abs(result - Math.sqrt(2)) < 0.001, `Expected ~1.414, got ${result}`);
  });

  it('returns 0 for single element', () => {
    assert.equal(stdDev([42]), 0);
  });

  it('returns 0 for empty array', () => {
    assert.equal(stdDev([]), 0);
  });
});

// ─── opsPerSecond() ───────────────────────────────────────────────────────────

describe('opsPerSecond()', () => {
  it('returns 1000 for 1ms per iteration', () => {
    assert.equal(opsPerSecond([1, 1, 1]), 1000);
  });

  it('returns 1,000,000 for 0.001ms per iteration', () => {
    assert.equal(opsPerSecond([0.001, 0.001]), 1_000_000);
  });

  it('returns 0 for empty array', () => {
    assert.equal(opsPerSecond([]), 0);
  });

  it('returns Infinity for zero-time operations', () => {
    assert.equal(opsPerSecond([0, 0, 0]), Infinity);
  });
});

// ─── marginOfError() ──────────────────────────────────────────────────────────

describe('marginOfError()', () => {
  it('returns 0 for identical values', () => {
    assert.equal(marginOfError([1, 1, 1, 1]), 0);
  });

  it('returns 0 for empty array', () => {
    assert.equal(marginOfError([]), 0);
  });

  it('returns 0 for single element', () => {
    assert.equal(marginOfError([5]), 0);
  });

  it('returns positive value for varying samples', () => {
    const moe = marginOfError([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(moe > 0, 'Expected positive margin of error');
    assert.ok(moe < 100, 'Expected MOE < 100%');
  });
});

// ─── formatOps() ──────────────────────────────────────────────────────────────

describe('formatOps()', () => {
  it('formats billions correctly', () => {
    assert.match(formatOps(1_500_000_000), /1\.50B ops\/sec/);
  });

  it('formats millions correctly', () => {
    assert.match(formatOps(2_500_000), /2\.50M ops\/sec/);
  });

  it('formats thousands correctly', () => {
    assert.match(formatOps(15_000), /15\.00K ops\/sec/);
  });

  it('formats small numbers correctly', () => {
    assert.match(formatOps(123.45), /123\.45 ops\/sec/);
  });

  it('handles Infinity', () => {
    assert.match(formatOps(Infinity), /∞/);
  });
});

// ─── formatDuration() ─────────────────────────────────────────────────────────

describe('formatDuration()', () => {
  it('formats microseconds', () => {
    assert.match(formatDuration(0.5), /µs/);
  });

  it('formats milliseconds', () => {
    assert.match(formatDuration(5), /ms/);
  });

  it('formats seconds', () => {
    assert.match(formatDuration(1500), /s/);
  });

  it('formats picoseconds for very small values', () => {
    assert.match(formatDuration(0.0001), /ps/);
  });
});

// ─── computeStats() ───────────────────────────────────────────────────────────

describe('computeStats()', () => {
  it('returns zero object for empty input', () => {
    const stats = computeStats([]);
    assert.equal(stats.samples, 0);
    assert.equal(stats.opsPerSecond, 0);
  });

  it('returns correct structure', () => {
    const stats = computeStats([1, 2, 3, 4, 5]);
    assert.ok('samples' in stats);
    assert.ok('mean' in stats);
    assert.ok('median' in stats);
    assert.ok('min' in stats);
    assert.ok('max' in stats);
    assert.ok('p75' in stats);
    assert.ok('p95' in stats);
    assert.ok('p99' in stats);
    assert.ok('stdDev' in stats);
    assert.ok('moe' in stats);
    assert.ok('opsPerSecond' in stats);
  });

  it('computes correct sample count', () => {
    const stats = computeStats([1, 2, 3]);
    assert.equal(stats.samples, 3);
  });

  it('computes min and max correctly', () => {
    const stats = computeStats([5, 1, 8, 2, 9]);
    assert.equal(stats.min, 1);
    assert.equal(stats.max, 9);
  });

  it('computes opsPerSecond for 1ms mean correctly', () => {
    const stats = computeStats([1, 1, 1, 1, 1]);
    assert.equal(stats.opsPerSecond, 1000);
  });
});
