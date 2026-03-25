
import { bench, run } from 'C:/Users/User/Desktop/claude-workspace/axiom/code/benchify/src/index.js';

bench('string ops', () => 'hello'.toUpperCase());

await run({ minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
