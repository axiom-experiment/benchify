/**
 * benchify/test/cli.test.js
 * CLI integration tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'benchify.js');
const FIXTURES_DIR = join(__dirname, '..', 'fixtures');
const INDEX = join(__dirname, '..', 'src', 'index.js');

// Helper: run CLI with given args
async function runCLI(args = [], options = {}) {
  try {
    const result = await execFileAsync(
      process.execPath,
      [CLI, ...args],
      { timeout: 30_000, ...options }
    );
    return { stdout: result.stdout, stderr: result.stderr, code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.code || 1 };
  }
}

// Helper: create a temporary bench fixture file
async function createFixture(filename, content) {
  if (!existsSync(FIXTURES_DIR)) {
    await mkdir(FIXTURES_DIR, { recursive: true });
  }
  const filePath = join(FIXTURES_DIR, filename);
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

// ─── --version ────────────────────────────────────────────────────────────────

describe('CLI --version', () => {
  it('outputs version number', async () => {
    const { stdout, code } = await runCLI(['--version']);
    assert.equal(code, 0, 'Should exit 0');
    assert.match(stdout, /benchify v\d+\.\d+\.\d+/, 'Should include version');
  });

  it('-v flag works as alias', async () => {
    const { stdout, code } = await runCLI(['-v']);
    assert.equal(code, 0);
    assert.match(stdout, /benchify v/);
  });
});

// ─── --help ───────────────────────────────────────────────────────────────────

describe('CLI --help', () => {
  it('outputs usage information', async () => {
    const { stdout, code } = await runCLI(['--help']);
    assert.equal(code, 0);
    assert.match(stdout, /Usage/i);
    assert.match(stdout, /benchify/);
  });

  it('-h flag works as alias', async () => {
    const { stdout, code } = await runCLI(['-h']);
    assert.equal(code, 0);
    assert.match(stdout, /Usage/i);
  });

  it('includes --json option in help', async () => {
    const { stdout } = await runCLI(['--help']);
    assert.match(stdout, /--json/);
  });
});

// ─── No files found ───────────────────────────────────────────────────────────

describe('CLI with no matching files', () => {
  it('exits with code 1 when no files found', async () => {
    const { code } = await runCLI(['no-match-at-all-xyz.bench.js'], {
      cwd: join(__dirname, '..'),
    });
    assert.equal(code, 1, 'Should exit 1');
  });
});

// ─── Fixture: valid bench file ────────────────────────────────────────────────

describe('CLI with valid bench file', () => {
  it('runs a simple bench file successfully', async () => {
    const fixture = await createFixture('simple.bench.js', `
import { bench, run } from '${INDEX.replace(/\\/g, '/')}';

bench('add', () => 1 + 1);
bench('multiply', () => 2 * 3);

await run({ minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
`);
    const { stdout, code } = await runCLI([fixture], { timeout: 30_000 });
    assert.equal(code, 0, `Should succeed. stderr: ${''}`);
    assert.ok(stdout.length > 0, 'Should produce output');
  });

  it('--json flag outputs valid JSON', async () => {
    const fixture = await createFixture('json-test.bench.js', `
import { bench, run } from '${INDEX.replace(/\\/g, '/')}';

bench('string ops', () => 'hello'.toUpperCase());

await run({ minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
`);
    const { stdout, code } = await runCLI([fixture, '--json'], { timeout: 30_000 });
    assert.equal(code, 0);
    // Find JSON in output (may have some prefix text)
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    assert.ok(jsonMatch, 'Should contain JSON output');
    const parsed = JSON.parse(jsonMatch[0]);
    assert.ok(parsed.groups, 'JSON should have groups');
  });
});

// ─── Fixture: grouped bench file ──────────────────────────────────────────────

describe('CLI with grouped benchmarks', () => {
  it('handles group() in bench files', async () => {
    const fixture = await createFixture('grouped.bench.js', `
import { bench, group, run } from '${INDEX.replace(/\\/g, '/')}';

group('Array creation', () => {
  bench('Array.from', () => Array.from({ length: 10 }, (_, i) => i));
  bench('spread', () => [...Array(10).keys()]);
});

await run({ minSamples: 5, minTimeMs: 50, maxTimeMs: 500 });
`);
    const { stdout, code } = await runCLI([fixture], { timeout: 30_000 });
    assert.equal(code, 0, 'Should succeed with groups');
  });
});
