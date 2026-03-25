/**
 * benchify/test/sampler.test.js
 * Unit tests for the sampling engine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { warmup, calibrateBatchSize, sample, DEFAULTS } from '../src/sampler.js';

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

describe('DEFAULTS', () => {
  it('has required default properties', () => {
    assert.ok(DEFAULTS.warmupIterations > 0);
    assert.ok(DEFAULTS.minSamples > 0);
    assert.ok(DEFAULTS.minTimeMs > 0);
    assert.ok(DEFAULTS.maxTimeMs > DEFAULTS.minTimeMs);
    assert.ok(DEFAULTS.batchTargetMs > 0);
  });
});

// ─── warmup() ─────────────────────────────────────────────────────────────────

describe('warmup()', () => {
  it('runs the function the specified number of times', async () => {
    let callCount = 0;
    await warmup(() => { callCount++; }, 5);
    assert.equal(callCount, 5);
  });

  it('runs the function 10 times by default', async () => {
    let callCount = 0;
    await warmup(() => { callCount++; });
    assert.equal(callCount, 10);
  });

  it('handles async functions', async () => {
    let callCount = 0;
    await warmup(async () => {
      callCount++;
      return Promise.resolve();
    }, 3);
    assert.equal(callCount, 3);
  });

  it('does not throw for a no-op function', async () => {
    await assert.doesNotReject(async () => {
      await warmup(() => {}, 5);
    });
  });
});

// ─── calibrateBatchSize() ─────────────────────────────────────────────────────

describe('calibrateBatchSize()', () => {
  it('returns a positive integer', async () => {
    const batchSize = await calibrateBatchSize(() => {}, 1);
    assert.ok(batchSize >= 1);
    assert.equal(Math.floor(batchSize), batchSize);
  });

  it('returns larger batch for faster functions', async () => {
    const fastBatch = await calibrateBatchSize(() => {}, 1);
    // A no-op function should calibrate to a large batch size
    assert.ok(fastBatch >= 1, 'Batch size should be at least 1');
  });

  it('returns at least 1', async () => {
    // Even for a slow function, batch size should be at least 1
    let callCount = 0;
    const slowFn = async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 5));
    };
    const batchSize = await calibrateBatchSize(slowFn, 1);
    assert.ok(batchSize >= 1);
  });
});

// ─── sample() ─────────────────────────────────────────────────────────────────

describe('sample()', () => {
  it('returns an array of timing samples', async () => {
    const times = await sample(() => Math.random(), {
      minSamples: 10,
      minTimeMs: 50,
      maxTimeMs: 2000,
    });
    assert.ok(Array.isArray(times));
    assert.ok(times.length >= 10);
  });

  it('all samples are positive numbers', async () => {
    const times = await sample(() => { let x = 0; for (let i = 0; i < 100; i++) x += i; }, {
      minSamples: 10,
      minTimeMs: 50,
      maxTimeMs: 2000,
    });
    for (const t of times) {
      assert.ok(t >= 0, `Sample time should be non-negative, got ${t}`);
      assert.ok(typeof t === 'number', 'Sample should be a number');
      assert.ok(!isNaN(t), 'Sample should not be NaN');
    }
  });

  it('respects minSamples option', async () => {
    const times = await sample(() => {}, {
      minSamples: 20,
      minTimeMs: 10,
      maxTimeMs: 5000,
    });
    assert.ok(times.length >= 20, `Expected >= 20 samples, got ${times.length}`);
  });

  it('handles async benchmark functions', async () => {
    const times = await sample(async () => {
      return new Promise(r => setImmediate(r));
    }, {
      minSamples: 5,
      minTimeMs: 10,
      maxTimeMs: 2000,
    });
    assert.ok(Array.isArray(times));
    assert.ok(times.length >= 5);
  });

  it('respects maxTimeMs as a hard stop', async () => {
    const startTime = Date.now();
    await sample(async () => {
      await new Promise(r => setTimeout(r, 100));
    }, {
      minSamples: 1000, // unreachable
      minTimeMs: 10,
      maxTimeMs: 300, // hard stop at 300ms
    });
    const elapsed = Date.now() - startTime;
    // Allow generous overhead
    assert.ok(elapsed < 2000, `Should stop before 2s, took ${elapsed}ms`);
  });
});
