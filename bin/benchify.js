#!/usr/bin/env node
/**
 * benchify CLI
 * Discovers .bench.js files and runs them, aggregating results into a
 * unified report. Files are run in-process via dynamic import.
 *
 * Usage:
 *   benchify                        # Run all *.bench.js files in cwd
 *   benchify src/**\/*.bench.js      # Glob pattern
 *   benchify ./my.bench.js          # Single file
 *   benchify --json                 # Output JSON
 *   benchify --no-color             # Disable ANSI colors
 *   benchify --min-samples 100      # Override sampling options
 *   benchify --min-time 1000        # Minimum time per benchmark (ms)
 *   benchify --version
 *   benchify --help
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

// ─── Argument Parser ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    patterns: [],
    json: false,
    color: true,
    quiet: false,
    minSamples: null,
    minTimeMs: null,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') opts.json = true;
    else if (arg === '--no-color') opts.color = false;
    else if (arg === '--quiet' || arg === '-q') opts.quiet = true;
    else if (arg === '--version' || arg === '-v') opts.version = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--min-samples' && args[i + 1]) {
      opts.minSamples = parseInt(args[++i], 10);
    } else if (arg === '--min-time' && args[i + 1]) {
      opts.minTimeMs = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      opts.patterns.push(arg);
    }
  }

  if (opts.patterns.length === 0) {
    opts.patterns = ['**/*.bench.js'];
  }

  return opts;
}

// ─── File Discovery ───────────────────────────────────────────────────────────

async function discoverFiles(patterns, cwd) {
  const files = new Set();

  for (const pattern of patterns) {
    // Check if it's a direct file path first
    const direct = resolve(cwd, pattern);
    if (existsSync(direct) && direct.endsWith('.js')) {
      files.add(direct);
      continue;
    }

    // Use Node.js built-in glob (Node 22+) or manual walk
    try {
      // Node.js 22+ has fs/promises glob
      for await (const match of glob(pattern, { cwd, absolute: true })) {
        if (match.endsWith('.js')) {
          files.add(match);
        }
      }
    } catch {
      // Fallback: manual directory walk for *.bench.js
      await walkDir(cwd, pattern, files);
    }
  }

  return [...files].sort();
}

async function walkDir(dir, pattern, results) {
  const { readdir, stat } = await import('node:fs/promises');
  // Simple pattern match: just check if filename ends with .bench.js
  const isBenchFile = (name) => name.endsWith('.bench.js');

  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && isBenchFile(entry.name)) {
        results.add(full);
      }
    }
  }

  await walk(dir);
}

// ─── ANSI Helpers ─────────────────────────────────────────────────────────────

function c(text, code, useColor) {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

// ─── Help Text ────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
  ${c('benchify', '1', true)} ${c(`v${pkg.version}`, '2', true)} — Modern zero-dependency micro-benchmark runner

  ${c('Usage:', '1', true)}
    benchify [pattern] [options]

  ${c('Arguments:', '1', true)}
    pattern             Glob pattern or file path (default: **/*.bench.js)

  ${c('Options:', '1', true)}
    --json              Output machine-readable JSON
    --no-color          Disable ANSI color output
    --quiet, -q         Suppress output
    --min-samples N     Minimum number of samples per benchmark (default: 50)
    --min-time N        Minimum sampling time in ms per benchmark (default: 500)
    --version, -v       Show version number
    --help, -h          Show this help message

  ${c('Benchmark file format:', '1', true)}
    import { bench, group, run } from 'benchify';

    group('String methods', () => {
      bench('split + join', () => 'hello world'.split(' ').join('-'));
      bench('replaceAll', () => 'hello world'.replaceAll(' ', '-'));
    });

    await run();

  ${c('Examples:', '1', true)}
    benchify                          Run all *.bench.js files
    benchify src/perf.bench.js        Run a specific file
    benchify --json > results.json    Save results as JSON
    benchify --min-time 2000          Longer sampling (2s per benchmark)
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.version) {
    console.log(`benchify v${pkg.version}`);
    process.exit(0);
  }

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const cwd = process.cwd();
  const files = await discoverFiles(opts.patterns, cwd);

  if (files.length === 0) {
    console.error(c('  benchify: No benchmark files found.', '2', opts.color));
    console.error(c(`  Searched for: ${opts.patterns.join(', ')}`, '2', opts.color));
    process.exit(1);
  }

  if (!opts.quiet && !opts.json) {
    console.log('');
    console.log(
      c('  benchify', '1', opts.color) +
      c(` v${pkg.version} — `, '2', opts.color) +
      c(`${files.length} file${files.length !== 1 ? 's' : ''} found`, '36', opts.color)
    );
    console.log('');
  }

  // Import the sampler/stats/reporter for aggregation
  const { computeStats } = await import('../src/stats.js');
  const { formatReport, formatJson: fmtJson } = await import('../src/reporter.js');
  const { sample } = await import('../src/sampler.js');

  // We run bench files in-process. Each file uses the global registry.
  // To support this, we set up a capture mechanism.
  const allGroups = [];
  const startTime = Date.now();

  for (const filePath of files) {
    const relPath = relative(cwd, filePath);

    if (!opts.quiet && !opts.json) {
      process.stderr.write(c(`  Running: ${relPath}\n`, '2', opts.color));
    }

    try {
      // Set subprocess env so index.js knows to output JSON
      process.env.BENCHIFY_SUBPROCESS = '1';

      // Dynamically import the bench file.
      // Since it calls run() internally and run() collects results,
      // we capture stdout to grab the JSON output.
      const chunks = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk, ...args) => {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      };

      try {
        // Clear module cache by appending a cache-busting query (ESM)
        const fileUrl = new URL(`file://${filePath}?t=${Date.now()}`);
        await import(fileUrl.href);
      } finally {
        process.stdout.write = originalWrite;
        process.env.BENCHIFY_SUBPROCESS = '0';
      }

      // Parse captured JSON
      const output = chunks.join('').trim();
      if (output) {
        try {
          const parsed = JSON.parse(output);
          if (parsed.groups) {
            for (const grp of parsed.groups) {
              allGroups.push({
                name: grp.name ? `${relPath} › ${grp.name}` : relPath,
                results: grp.results,
              });
            }
          }
        } catch {
          // If file didn't output valid JSON, just skip
        }
      }
    } catch (err) {
      process.stderr.write(c(`  Error in ${relPath}: ${err.message}\n`, '31', opts.color));
    }
  }

  const totalTimeMs = Date.now() - startTime;
  const meta = {
    totalTimeMs,
    fileCount: files.length,
    benchmarkCount: allGroups.reduce((acc, g) => acc + g.results.length, 0),
  };

  if (!opts.quiet) {
    if (opts.json) {
      console.log(fmtJson(allGroups, meta));
    } else {
      process.stdout.write(formatReport(allGroups, meta, opts.color));
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(`benchify: Fatal error — ${err.message}`);
  process.exit(1);
});
