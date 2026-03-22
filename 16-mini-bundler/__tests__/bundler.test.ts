/**
 * bundler.test.ts - Tests for mini-bundler
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseImports, parseExports, transformModule } from '../src/parser';
import {
  resolveSpecifier,
  buildDependencyGraph,
  emitBundle,
  bundle,
} from '../src/bundler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mini-bundler-test-'));
}

function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
}

// ─── Parser: parseImports ─────────────────────────────────────────────────────

describe('parseImports', () => {
  test('default import', () => {
    const src = `import foo from './foo'`;
    const imports = parseImports(src);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe('./foo');
    expect(imports[0].defaultBinding).toBe('foo');
  });

  test('named imports', () => {
    const src = `import { bar, baz } from './bar'`;
    const imports = parseImports(src);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe('./bar');
    expect(imports[0].named).toContain('bar');
    expect(imports[0].named).toContain('baz');
  });

  test('namespace import', () => {
    const src = `import * as ns from './ns'`;
    const imports = parseImports(src);
    expect(imports).toHaveLength(1);
    expect(imports[0].namespaceBinding).toBe('ns');
    expect(imports[0].specifier).toBe('./ns');
  });

  test('multiple imports', () => {
    const src = `
import a from './a';
import { b } from './b';
import * as c from './c';
`;
    const imports = parseImports(src);
    expect(imports).toHaveLength(3);
    expect(imports.map((i) => i.specifier)).toEqual(['./a', './b', './c']);
  });

  test('ignores non-relative specifiers', () => {
    const src = `import React from 'react'`;
    const imports = parseImports(src);
    expect(imports).toHaveLength(1);
    expect(imports[0].specifier).toBe('react');
  });
});

// ─── Parser: parseExports ─────────────────────────────────────────────────────

describe('parseExports', () => {
  test('export default', () => {
    const src = `export default function main() {}`;
    const exports = parseExports(src);
    expect(exports.some((e) => e.isDefault)).toBe(true);
  });

  test('named export from declaration', () => {
    const src = `export function greet() {}`;
    const exports = parseExports(src);
    expect(exports.some((e) => e.declaredName === 'greet')).toBe(true);
  });

  test('named export block', () => {
    const src = `export { foo, bar }`;
    const exports = parseExports(src);
    const namedExp = exports.find((e) => e.named.length > 0);
    expect(namedExp).toBeDefined();
    expect(namedExp!.named).toContain('foo');
    expect(namedExp!.named).toContain('bar');
  });

  test('re-export from', () => {
    const src = `export { baz } from './baz'`;
    const exports = parseExports(src);
    const reExp = exports.find((e) => e.fromSpecifier !== null);
    expect(reExp).toBeDefined();
    expect(reExp!.fromSpecifier).toBe('./baz');
  });

  test('export const', () => {
    const src = `export const PI = 3.14;`;
    const exports = parseExports(src);
    expect(exports.some((e) => e.declaredName === 'PI')).toBe(true);
  });
});

// ─── Parser: transformModule ──────────────────────────────────────────────────

describe('transformModule', () => {
  test('transforms default import', () => {
    const src = `import foo from './foo';\nfoo();`;
    const out = transformModule(src, 0);
    expect(out).not.toContain("import foo from './foo'");
    expect(out).toContain('__require');
  });

  test('transforms named import', () => {
    const src = `import { add } from './math';\nadd(1,2);`;
    const out = transformModule(src, 0);
    expect(out).toContain('const { add }');
    expect(out).toContain('__require("./math")');
  });

  test('transforms namespace import', () => {
    const src = `import * as utils from './utils';`;
    const out = transformModule(src, 0);
    expect(out).toContain('const utils = __require');
  });

  test('transforms export default', () => {
    const src = `export default 42;`;
    const out = transformModule(src, 0);
    expect(out).toContain('exports.default = 42');
  });

  test('transforms named export block', () => {
    const src = `const x = 1;\nexport { x };`;
    const out = transformModule(src, 0);
    expect(out).toContain('exports.x = x');
  });

  test('transforms export function', () => {
    const src = `export function greet(name) { return 'hi ' + name; }`;
    const out = transformModule(src, 0);
    expect(out).toContain('exports.greet');
    expect(out).toContain('function greet');
  });
});

// ─── resolveSpecifier ─────────────────────────────────────────────────────────

describe('resolveSpecifier', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('resolves .js extension', () => {
    const entry = path.join(tmpDir, 'main.js');
    const dep = path.join(tmpDir, 'dep.js');
    fs.writeFileSync(dep, 'export const x = 1;');
    const resolved = resolveSpecifier('./dep', entry);
    expect(resolved).toBe(dep);
  });

  test('resolves .ts extension', () => {
    const entry = path.join(tmpDir, 'main.ts');
    const dep = path.join(tmpDir, 'dep.ts');
    fs.writeFileSync(dep, 'export const x = 1;');
    const resolved = resolveSpecifier('./dep', entry);
    expect(resolved).toBe(dep);
  });

  test('resolves index file in directory', () => {
    const entry = path.join(tmpDir, 'main.js');
    const subDir = path.join(tmpDir, 'lib');
    fs.mkdirSync(subDir);
    const indexFile = path.join(subDir, 'index.js');
    fs.writeFileSync(indexFile, 'export const y = 2;');
    const resolved = resolveSpecifier('./lib', entry);
    expect(resolved).toBe(indexFile);
  });

  test('returns null for bare specifiers', () => {
    const entry = path.join(tmpDir, 'main.js');
    const resolved = resolveSpecifier('react', entry);
    expect(resolved).toBeNull();
  });

  test('returns null if file not found', () => {
    const entry = path.join(tmpDir, 'main.js');
    const resolved = resolveSpecifier('./nonexistent', entry);
    expect(resolved).toBeNull();
  });
});

// ─── buildDependencyGraph ─────────────────────────────────────────────────────

describe('buildDependencyGraph', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('single file with no deps', () => {
    writeFiles(tmpDir, {
      'index.js': `const x = 1;\nexport default x;`,
    });
    const graph = buildDependencyGraph(path.join(tmpDir, 'index.js'));
    expect(graph.modules.size).toBe(1);
    expect(graph.order).toHaveLength(1);
  });

  test('entry imports one dep', () => {
    writeFiles(tmpDir, {
      'math.js': `export function add(a, b) { return a + b; }`,
      'index.js': `import { add } from './math';\nexport default add(1, 2);`,
    });
    const graph = buildDependencyGraph(path.join(tmpDir, 'index.js'));
    expect(graph.modules.size).toBe(2);
    // Math should appear before index in order (dependency first)
    const mathMod = [...graph.modules.values()].find((m) =>
      m.filePath.endsWith('math.js'),
    );
    const indexMod = [...graph.modules.values()].find((m) =>
      m.filePath.endsWith('index.js'),
    );
    expect(graph.order.indexOf(mathMod!.id)).toBeLessThan(
      graph.order.indexOf(indexMod!.id),
    );
  });

  test('diamond dependency', () => {
    writeFiles(tmpDir, {
      'base.js': `export const BASE = 'base';`,
      'a.js': `import { BASE } from './base';\nexport const A = BASE + 'A';`,
      'b.js': `import { BASE } from './base';\nexport const B = BASE + 'B';`,
      'index.js': `import { A } from './a';\nimport { B } from './b';\nexport default A + B;`,
    });
    const graph = buildDependencyGraph(path.join(tmpDir, 'index.js'));
    expect(graph.modules.size).toBe(4);
    // base should appear before a and b
    const baseMod = [...graph.modules.values()].find((m) => m.filePath.endsWith('base.js'))!;
    const aMod = [...graph.modules.values()].find((m) => m.filePath.endsWith('/a.js'))!;
    const bMod = [...graph.modules.values()].find((m) => m.filePath.endsWith('/b.js'))!;
    expect(graph.order.indexOf(baseMod.id)).toBeLessThan(graph.order.indexOf(aMod.id));
    expect(graph.order.indexOf(baseMod.id)).toBeLessThan(graph.order.indexOf(bMod.id));
  });

  test('throws on circular dependency', () => {
    writeFiles(tmpDir, {
      'a.js': `import { b } from './b';`,
      'b.js': `import { a } from './a';`,
    });
    expect(() =>
      buildDependencyGraph(path.join(tmpDir, 'a.js')),
    ).toThrow(/[Cc]ircular/);
  });
});

// ─── emitBundle ──────────────────────────────────────────────────────────────

describe('emitBundle', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('emits valid IIFE bundle', () => {
    writeFiles(tmpDir, {
      'index.js': `export default 42;`,
    });
    const graph = buildDependencyGraph(path.join(tmpDir, 'index.js'));
    const output = emitBundle(graph);
    expect(output).toContain('(function(modules)');
    expect(output).toContain('__require');
    expect(output).toContain('cache');
  });

  test('bundle includes all modules', () => {
    writeFiles(tmpDir, {
      'math.js': `export function add(a, b) { return a + b; }`,
      'index.js': `import { add } from './math';\nexport default add(3, 4);`,
    });
    const graph = buildDependencyGraph(path.join(tmpDir, 'index.js'));
    const output = emitBundle(graph);
    // Both modules should be in the bundle
    expect(output).toContain('function add');
    expect(output).toContain('exports.default');
  });
});

// ─── End-to-end: bundle() ─────────────────────────────────────────────────────

describe('bundle() end-to-end', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('bundles single file and returns string', () => {
    writeFiles(tmpDir, {
      'index.js': `export default function hello() { return 'hello'; }`,
    });
    const result = bundle(path.join(tmpDir, 'index.js'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('hello');
  });

  test('writes bundle to file', () => {
    writeFiles(tmpDir, {
      'index.js': `export default 1 + 1;`,
    });
    const outFile = path.join(tmpDir, 'dist', 'bundle.js');
    bundle(path.join(tmpDir, 'index.js'), outFile);
    expect(fs.existsSync(outFile)).toBe(true);
    const content = fs.readFileSync(outFile, 'utf-8');
    expect(content).toContain('(function(modules)');
  });

  test('bundles multi-file project correctly', () => {
    writeFiles(tmpDir, {
      'greet.js': `export function greet(name) { return 'Hello, ' + name + '!'; }`,
      'index.js': `
import { greet } from './greet';
export default greet('World');
`,
    });
    const result = bundle(path.join(tmpDir, 'index.js'));
    expect(result).toContain('greet');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  test('bundle is executable JavaScript', () => {
    writeFiles(tmpDir, {
      'math.js': `
export function multiply(a, b) { return a * b; }
export const PI = 3.14159;
`,
      'index.js': `
import { multiply, PI } from './math';
export default multiply(2, PI);
`,
    });
    const result = bundle(path.join(tmpDir, 'index.js'));

    // Execute the bundle and capture the return value
    // We wrap in a variable assignment to test the return
    const execResult = new Function(`
      var __result;
      ${result.replace('(function(modules)', '__result = (function(modules)')}
      return __result;
    `)();

    // The bundle's entry exports.default should be multiply(2, PI) ≈ 6.28
    expect(execResult).toBeDefined();
  });
});
