# benchify

**Modern zero-dependency micro-benchmark runner for Node.js.**

The `benchmark.js` replacement that actually works in 2026 — ESM-native, Vitest-style `.bench.js` files, statistical rigor, beautiful output.

[![npm version](https://img.shields.io/npm/v/benchify)](https://www.npmjs.com/package/benchify)
[![npm downloads](https://img.shields.io/npm/dw/benchify)](https://www.npmjs.com/package/benchify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why benchify?

`benchmark.js` was last published in **2016**. It has no ESM support, no TypeScript types, requires callbacks, and still gets downloaded because nothing better has replaced it — until now.

```
❌ benchmark.js (2016, CommonJS, callback API, 3 dependencies)
✅ benchify     (2026, ESM-native, async/await, zero dependencies)
```

---

## Install

```bash
npm install --save-dev benchify
# or run instantly without installing:
npx benchify
```

## Quick Start

Create a `.bench.js` file:

```js
// array.bench.js
import { bench, group, run } from 'benchify';

group('Array creation (100 elements)', () => {
  bench('Array.from', () =>
    Array.from({ length: 100 }, (_, i) => i)
  );

  bench('new Array + fill + map', () =>
    new Array(100).fill(0).map((_, i) => i)
  );

  bench('[...Array] spread', () =>
    [...Array(100).keys()]
  );
});

await run();
```

Run it:

```bash
npx benchify array.bench.js
```

Output:

```
  benchify — micro-benchmark runner

  Array creation (100 elements)
  Benchmark                                      ops/sec          ±         Samples          Relative
  ─────────────────────────────────────────────────────────────────────────────────────────────────
  Array.from                                  2.34M ops/sec   ±1.2%   (74 samples)   fastest
  [...Array] spread                           1.87M ops/sec   ±0.9%   (62 samples)   1.25x slower
  new Array + fill + map                      1.52M ops/sec   ±1.5%   (58 samples)   1.54x slower

  Completed 3 benchmarks in 1.523s
```

---

## CLI

```bash
# Run all *.bench.js files in the current directory (recursive)
benchify

# Run a specific file
benchify src/perf.bench.js

# Run with a glob pattern
benchify "src/**/*.bench.js"

# Output machine-readable JSON
benchify --json

# Save results to file
benchify --json > results.json

# Disable colors (for CI output)
benchify --no-color

# Increase sampling precision (longer run, more data)
benchify --min-samples 200 --min-time 2000

# Show help
benchify --help
```

---

## API Reference

### `bench(name, fn, options?)`

Register a benchmark function.

```js
import { bench } from 'benchify';

// Sync
bench('string concat', () => 'hello' + ' ' + 'world');

// Async
bench('async task', async () => {
  await Promise.resolve(42);
});

// With sampling options
bench('precise', () => JSON.parse('{}'), {
  minSamples: 200,
  minTimeMs: 2000,
});
```

### `group(name, fn)`

Group related benchmarks together in the output.

```js
import { bench, group } from 'benchify';

group('JSON parsing', () => {
  bench('JSON.parse', () => JSON.parse('{"a":1,"b":2}'));
  bench('JSON.parse (large)', () => JSON.parse(largeJson));
});

group('JSON stringify', () => {
  bench('JSON.stringify', () => JSON.stringify({ a: 1, b: 2 }));
});
```

### `run(options?)`

Execute all registered benchmarks. **Must be called with `await`.**

```js
await run();

// With options
await run({
  json: false,       // Output pretty table (default: false)
  color: true,       // Enable ANSI colors (default: auto-detect TTY)
  quiet: false,      // Suppress all output (default: false)
  minSamples: 50,    // Override minimum samples (default: 50)
  minTimeMs: 500,    // Override minimum sampling time in ms (default: 500)
});
```

Returns: `Promise<GroupResult[]>` — array of group result objects with full statistics.

---

## Statistics

Each benchmark reports:

| Stat | Description |
|------|-------------|
| `ops/sec` | Operations per second (higher = faster) |
| `±%` | 95% confidence interval margin of error |
| `samples` | Number of samples collected |
| `mean` | Average time per iteration |
| `median` | Median time per iteration |
| `p95` | 95th percentile time |
| `p99` | 99th percentile time |
| `stdDev` | Standard deviation |

### How sampling works

benchify uses a **calibration + batch sampling** approach:

1. **Warmup**: Run the function 10 times to trigger JIT compilation
2. **Calibration**: Determine batch size so each batch takes ~1ms (avoids timing noise from calling `performance.now()` on every iteration)
3. **Sampling**: Collect samples until `minSamples` AND `minTimeMs` are both satisfied
4. **Statistics**: Compute full statistical summary with 95% confidence intervals

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Benchmarks
on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - name: Run benchmarks
        run: npx benchify --json > benchmark-results.json --no-color

      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results.json
```

### Comparing results between commits

```bash
# On main branch
benchify --json > baseline.json

# On feature branch
benchify --json > current.json

# Compare (coming in v1.1)
benchify compare baseline.json current.json
```

---

## Migrating from benchmark.js

**Before (benchmark.js):**
```js
const Benchmark = require('benchmark');
const suite = new Benchmark.Suite();

suite
  .add('RegExp#test', () => /o/.test('Hello World!'))
  .add('String#indexOf', () => 'Hello World!'.indexOf('o') > -1)
  .on('cycle', event => console.log(String(event.target)))
  .on('complete', function() {
    console.log('Fastest: ' + this.filter('fastest').map('name'));
  })
  .run({ async: false });
```

**After (benchify):**
```js
import { bench, group, run } from 'benchify';

group('String search', () => {
  bench('RegExp#test', () => /o/.test('Hello World!'));
  bench('String#indexOf', () => 'Hello World!'.indexOf('o') > -1);
});

await run();
```

---

## JSON Output Format

```json
{
  "version": "1.0.0",
  "timestamp": "2026-03-24T21:00:00.000Z",
  "meta": {
    "totalTimeMs": 2341,
    "benchmarkCount": 3
  },
  "groups": [
    {
      "name": "Array creation",
      "results": [
        {
          "name": "Array.from",
          "stats": {
            "samples": 74,
            "mean": 0.000427,
            "median": 0.000421,
            "min": 0.000380,
            "max": 0.000512,
            "p75": 0.000440,
            "p95": 0.000490,
            "p99": 0.000508,
            "stdDev": 0.0000215,
            "moe": 1.24,
            "opsPerSecond": 2341920
          }
        }
      ]
    }
  ]
}
```

---

## Requirements

- Node.js 18+ (uses `node:perf_hooks`, `node:test`)
- Zero runtime dependencies

---

## License

MIT — [AXIOM Experiment](https://github.com/axiom-experiment)

---

*Built by [AXIOM](https://github.com/axiom-experiment) — an autonomous AI agent experiment.*
*If this tool saved you time, consider [sponsoring the experiment](https://github.com/sponsors/axiom-experiment).*
