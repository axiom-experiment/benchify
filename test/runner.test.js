/**
 * benchify/test/runner.test.js
 * Integration tests for bench(), group(), and run() API.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Import the module under test
// We re-import to get fresh state for each test group
// Note: ESM modules are cached; we use a workaround via testing run() behavior

// ─── Helper: import fresh registry state ──────────────────────────────────────
// Since Node.js caches ESM modules, we test run() behavior indirectly
// by calling it with quiet:true and checking the returned groups structure.

async function getFreshModule() {
  // We can't truly clear ESM cache, but run() clears the registry after executing.
  // So as long as tests call run() after bench(), state is consumed.
  return import('../src/index.js');
}

// ─── bench() API ──────────────────────────────────────────────────────────────

describe('bench() and run() integration', () => {
  it('registers a benchmark and run() returns it', async () => {
    const { bench, run } = await getFreshModule();
    bench('simple add', () => 1 + 1);
    const groups = await run({ quiet: true, minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
    assert.ok(Array.isArray(groups));
    assert.ok(groups.length > 0);
    const allNames = groups.flatMap(g => g.results.map(r => r.name));
    assert.ok(allNames.includes('simple add'), 'Should find registered bench');
  });

  it('returns stats object for each benchmark', async () => {
    const { bench, run } = await getFreshModule();
    bench('stats check', () => Math.random());
    const groups = await run({ quiet: true, minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
    const result = groups[0]?.results[0];
    assert.ok(result, 'Should have a result');
    assert.ok(result.stats.opsPerSecond > 0, 'ops/sec should be positive');
    assert.ok(result.stats.samples >= 5, 'Should have at least 5 samples');
  });

  it('run() returns empty array when no benchmarks registered', async () => {
    const { run } = await getFreshModule();
    // Consume any stale registrations
    await run({ quiet: true, minSamples: 1, minTimeMs: 1, maxTimeMs: 100 });
    // Now registry is empty
    const groups = await run({ quiet: true });
    assert.deepEqual(groups, []);
  });

  it('handles multiple benchmarks in default group', async () => {
    const { bench, run } = await getFreshModule();
    bench('bench-x', () => 'x'.repeat(10));
    bench('bench-y', () => Array(10).fill('y'));
    const groups = await run({ quiet: true, minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
    const names = groups.flatMap(g => g.results.map(r => r.name));
    assert.ok(names.includes('bench-x'));
    assert.ok(names.includes('bench-y'));
  });

  it('handles async benchmark functions', async () => {
    const { bench, run } = await getFreshModule();
    bench('async noop', async () => await Promise.resolve(42));
    const groups = await run({ quiet: true, minSamples: 5, minTimeMs: 50, maxTimeMs: 1000 });
    const result = groups[0]?.results[0];
    assert.ok(result, 'Should have result for async benchmark');
    assert.ok(result.stats.samples >= 5);
  });
});

// ─── group() API ──────────────────────────────────────────────────────────────

describe('group() integration', () => {
  it('groups benchmarks together in output', async () => {
    const { bench, group, run } = await getFreshModule();
    group('My Group', () => {
      bench('in-group-1', () => 1 + 1);
      bench('in-group-2', () => 2 + 2);
    });
    const groups = await run({ quiet: true, minSamples: 5, minTimeMs: 50, maxTimeMs: 1000 });
    const myGroup = groups.find(g => g.name === 'My Group');
    assert.ok(myGroup, 'Should find My Group');
    const names = myGroup.results.map(r => r.name);
    assert.ok(names.includes('in-group-1'));
    assert.ok(names.includes('in-group-2'));
  });

  it('supports multiple groups', async () => {
    const { bench, group, run } = await getFreshModule();
    group('Group A', () => bench('a1', () => 'a'));
    group('Group B', () => bench('b1', () => 'b'));
    const groups = await run({ quiet: true, minSamples: 5, minTimeMs: 50, maxTimeMs: 1000 });
    const groupNames = groups.map(g => g.name);
    assert.ok(groupNames.includes('Group A'));
    assert.ok(groupNames.includes('Group B'));
  });

  it('supports nested groups (last group wins for inner benches)', async () => {
    const { bench, group, run } = await getFreshModule();
    group('Outer', () => {
      bench('outer-bench', () => 'outer');
      group('Inner', () => {
        bench('inner-bench', () => 'inner');
      });
    });
    const groups = await run({ quiet: true, minSamples: 5, minTimeMs: 50, maxTimeMs: 1000 });
    // Just verify it doesn't crash and returns results
    assert.ok(groups.length > 0);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('bench() error handling', () => {
  it('throws for non-string name', async () => {
    const { bench } = await getFreshModule();
    assert.throws(
      () => bench(42, () => {}),
      { message: /non-empty string/ }
    );
  });

  it('throws for empty string name', async () => {
    const { bench } = await getFreshModule();
    assert.throws(
      () => bench('', () => {}),
      { message: /non-empty string/ }
    );
  });

  it('throws for non-function second argument', async () => {
    const { bench } = await getFreshModule();
    assert.throws(
      () => bench('my bench', 'not a function'),
      { message: /function/ }
    );
  });

  it('throws for non-string group name', async () => {
    const { group } = await getFreshModule();
    assert.throws(
      () => group(null, () => {}),
      { message: /non-empty string/ }
    );
  });

  it('throws for non-function group callback', async () => {
    const { group } = await getFreshModule();
    assert.throws(
      () => group('valid name', 'not a function'),
      { message: /function/ }
    );
  });
});
