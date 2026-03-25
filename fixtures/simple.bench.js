
import { bench, run } from 'C:/Users/User/Desktop/claude-workspace/axiom/code/benchify/src/index.js';

bench('add', () => 1 + 1);
bench('multiply', () => 2 * 3);

await run({ minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
