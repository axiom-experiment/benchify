/**
 * benchify/src/sampler.js
 * Core timing and sampling engine.
 * Handles JIT warmup, auto-calibration of batch size, and measurement loops.
 */

import { performance } from 'node:perf_hooks';

/**
 * Default sampling options.
 */
export const DEFAULTS = {
  warmupIterations: 10,
  minSamples: 50,
  minTimeMs: 500,
  maxTimeMs: 10_000,
  batchTargetMs: 1, // aim for each batch to take ~1ms
};

/**
 * Run warmup iterations to allow JIT compilation before measurement.
 * @param {Function} fn - Benchmark function (sync or async)
 * @param {number} iterations
 */
export async function warmup(fn, iterations = DEFAULTS.warmupIterations) {
  for (let i = 0; i < iterations; i++) {
    const result = fn();
    if (result instanceof Promise) await result;
  }
}

/**
 * Determine how many iterations to batch together so each batch takes ~targetMs.
 * @param {Function} fn
 * @param {number} targetMs
 * @returns {Promise<number>} batch size
 */
export async function calibrateBatchSize(fn, targetMs = DEFAULTS.batchTargetMs) {
  // Start with batch of 1, double until we exceed targetMs
  let batchSize = 1;
  let elapsed = 0;

  while (elapsed < targetMs && batchSize < 1_000_000) {
    const start = performance.now();
    for (let i = 0; i < batchSize; i++) {
      const result = fn();
      if (result instanceof Promise) await result;
    }
    elapsed = performance.now() - start;

    if (elapsed < targetMs) {
      batchSize *= 2;
    }
  }

  // Scale batchSize so one batch ≈ targetMs
  if (elapsed > 0) {
    batchSize = Math.max(1, Math.round((batchSize * targetMs) / elapsed));
  }

  return batchSize;
}

/**
 * Run the benchmark and collect timing samples.
 * Returns per-iteration elapsed times in milliseconds.
 *
 * @param {Function} fn - Benchmark function (sync or async)
 * @param {object} options
 * @param {number} options.minSamples - Minimum number of samples to collect
 * @param {number} options.minTimeMs - Minimum total sampling time in ms
 * @param {number} options.maxTimeMs - Maximum total sampling time in ms
 * @param {number} options.warmupIterations - How many warmup runs before sampling
 * @returns {Promise<number[]>} Array of per-iteration times in milliseconds
 */
export async function sample(fn, options = {}) {
  const opts = { ...DEFAULTS, ...options };

  // Warmup phase
  await warmup(fn, opts.warmupIterations);

  // Calibrate batch size
  const batchSize = await calibrateBatchSize(fn, opts.batchTargetMs);

  // Measurement phase
  const samples = [];
  const totalStart = performance.now();

  while (true) {
    const batchStart = performance.now();
    for (let i = 0; i < batchSize; i++) {
      const result = fn();
      if (result instanceof Promise) await result;
    }
    const batchElapsed = performance.now() - batchStart;

    // Record per-iteration time
    samples.push(batchElapsed / batchSize);

    const totalElapsed = performance.now() - totalStart;

    // Stop conditions: must satisfy both minSamples AND minTime
    const hasEnoughSamples = samples.length >= opts.minSamples;
    const hasEnoughTime = totalElapsed >= opts.minTimeMs;

    if (hasEnoughSamples && hasEnoughTime) break;

    // Hard stop at maxTime
    if (totalElapsed >= opts.maxTimeMs) break;
  }

  return samples;
}
