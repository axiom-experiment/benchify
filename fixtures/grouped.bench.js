
import { bench, group, run } from 'C:/Users/User/Desktop/claude-workspace/axiom/code/benchify/src/index.js';

group('Array creation', () => {
  bench('Array.from', () => Array.from({ length: 10 }, (_, i) => i));
  bench('spread', () => [...Array(10).keys()]);
});

await run({ minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
