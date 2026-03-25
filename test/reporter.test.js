/**
 * benchify/test/reporter.test.js
 * Unit tests for output formatting functions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  colorize,
  pad,
  formatRelativeSpeed,
  formatResultRow,
  formatGroup,
  formatReport,
  formatJson,
  formatProgress,
} from '../src/reporter.js';

// ─── colorize() ───────────────────────────────────────────────────────────────

describe('colorize()', () => {
  it('adds ANSI escape codes when color is true', () => {
    const result = colorize('hello', 'green', true);
    assert.ok(result.includes('\x1b['), 'Should include escape sequence');
    assert.ok(result.includes('hello'), 'Should include original text');
  });

  it('returns plain text when color is false', () => {
    const result = colorize('hello', 'green', false);
    assert.equal(result, 'hello');
  });

  it('returns plain text for unknown color name', () => {
    const result = colorize('hello', 'nonexistentColor', true);
    assert.equal(result, 'hello');
  });
});

// ─── pad() ────────────────────────────────────────────────────────────────────

describe('pad()', () => {
  it('pads to the right by default', () => {
    const result = pad('abc', 6);
    assert.equal(result, 'abc   ');
    assert.equal(result.length, 6);
  });

  it('pads to the left when direction is left', () => {
    const result = pad('abc', 6, 'left');
    assert.equal(result, '   abc');
    assert.equal(result.length, 6);
  });

  it('does not truncate strings longer than width', () => {
    const result = pad('hello world', 5);
    assert.equal(result, 'hello world');
  });

  it('converts numbers to strings', () => {
    const result = pad(42, 5);
    assert.equal(result, '42   ');
  });
});

// ─── formatRelativeSpeed() ────────────────────────────────────────────────────

describe('formatRelativeSpeed()', () => {
  it('returns "fastest" when ops equals fastestOps', () => {
    assert.equal(formatRelativeSpeed(1000, 1000), 'fastest');
  });

  it('returns "fastest" when ops is greater than fastestOps', () => {
    // Shouldn't happen in practice but handle gracefully
    assert.equal(formatRelativeSpeed(2000, 1000), 'fastest');
  });

  it('returns correct ratio string', () => {
    const result = formatRelativeSpeed(500, 1000);
    assert.match(result, /2\.00x slower/);
  });

  it('formats ratio to 2 decimal places', () => {
    const result = formatRelativeSpeed(300, 1000);
    assert.match(result, /3\.33x slower/);
  });
});

// ─── formatResultRow() ────────────────────────────────────────────────────────

describe('formatResultRow()', () => {
  const mockResult = {
    name: 'Array.map',
    stats: {
      opsPerSecond: 1_000_000,
      moe: 1.5,
      samples: 100,
    },
  };

  it('includes benchmark name in output', () => {
    const row = formatResultRow(mockResult, true, 1_000_000, false);
    assert.ok(row.includes('Array.map'), 'Should include benchmark name');
  });

  it('produces output for non-fastest', () => {
    const row = formatResultRow(mockResult, false, 2_000_000, false);
    assert.ok(row.length > 0, 'Should produce output');
    assert.ok(row.includes('slower'), 'Should indicate slower');
  });

  it('produces output for fastest', () => {
    const row = formatResultRow(mockResult, true, 1_000_000, false);
    assert.ok(row.length > 0, 'Should produce output');
    assert.ok(row.includes('fastest'), 'Should indicate fastest');
  });
});

// ─── formatGroup() ────────────────────────────────────────────────────────────

describe('formatGroup()', () => {
  const results = [
    { name: 'bench-a', stats: { opsPerSecond: 1000, moe: 1, samples: 50 } },
    { name: 'bench-b', stats: { opsPerSecond: 500, moe: 2, samples: 50 } },
  ];

  it('returns empty string for empty results', () => {
    assert.equal(formatGroup('Group', [], false), '');
  });

  it('includes group name in output', () => {
    const output = formatGroup('My Group', results, false);
    assert.ok(output.includes('My Group'), 'Should include group name');
  });

  it('includes all benchmark names', () => {
    const output = formatGroup('Group', results, false);
    assert.ok(output.includes('bench-a'), 'Should include bench-a');
    assert.ok(output.includes('bench-b'), 'Should include bench-b');
  });

  it('handles null/empty group name', () => {
    const output = formatGroup('', results, false);
    assert.ok(output.length > 0, 'Should still produce output');
  });
});

// ─── formatReport() ───────────────────────────────────────────────────────────

describe('formatReport()', () => {
  const groups = [
    {
      name: 'String ops',
      results: [
        { name: 'split', stats: { opsPerSecond: 2000, moe: 1, samples: 50 } },
        { name: 'join', stats: { opsPerSecond: 1500, moe: 1.5, samples: 50 } },
      ],
    },
  ];

  it('includes benchify branding', () => {
    const report = formatReport(groups, {}, false);
    assert.ok(report.includes('benchify'), 'Should include brand name');
  });

  it('includes group name', () => {
    const report = formatReport(groups, {}, false);
    assert.ok(report.includes('String ops'), 'Should include group name');
  });

  it('includes all benchmark names', () => {
    const report = formatReport(groups, {}, false);
    assert.ok(report.includes('split'), 'Should include split benchmark');
    assert.ok(report.includes('join'), 'Should include join benchmark');
  });

  it('includes completion summary', () => {
    const report = formatReport(groups, { totalTimeMs: 1000 }, false);
    assert.ok(report.includes('2 benchmarks'), 'Should include count in summary');
  });
});

// ─── formatJson() ─────────────────────────────────────────────────────────────

describe('formatJson()', () => {
  const groups = [
    {
      name: 'Test group',
      results: [{ name: 'bench1', stats: { opsPerSecond: 1000, samples: 50 } }],
    },
  ];

  it('produces valid JSON', () => {
    const output = formatJson(groups, {});
    assert.doesNotThrow(() => JSON.parse(output));
  });

  it('includes groups in output', () => {
    const parsed = JSON.parse(formatJson(groups, {}));
    assert.ok(Array.isArray(parsed.groups));
    assert.equal(parsed.groups.length, 1);
  });

  it('includes version field', () => {
    const parsed = JSON.parse(formatJson(groups, {}));
    assert.ok(parsed.version);
  });

  it('includes timestamp', () => {
    const parsed = JSON.parse(formatJson(groups, {}));
    assert.ok(parsed.timestamp);
    assert.doesNotThrow(() => new Date(parsed.timestamp));
  });

  it('preserves benchmark names', () => {
    const parsed = JSON.parse(formatJson(groups, {}));
    assert.equal(parsed.groups[0].results[0].name, 'bench1');
  });
});

// ─── formatProgress() ─────────────────────────────────────────────────────────

describe('formatProgress()', () => {
  it('includes message text', () => {
    const output = formatProgress('Running benchmark...', false);
    assert.ok(output.includes('Running benchmark...'));
  });

  it('returns a non-empty string', () => {
    assert.ok(formatProgress('test', false).length > 0);
  });
});
