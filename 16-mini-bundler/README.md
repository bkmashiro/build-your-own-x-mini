# 16-mini-bundler

A minimal JavaScript bundler supporting ES modules, written in TypeScript.

## Features

- 📦 **ES Module parsing** — handles `import`/`export` syntax (default, named, namespace, re-exports)
- 🕸️ **Dependency graph** — recursive BFS/DFS traversal from entry point
- 🔄 **Circular dependency detection** — throws a clear error when cycles are found
- 📁 **Module resolution** — tries `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs` extensions and `index.*` files
- 🎯 **Single-file output** — emits a self-contained IIFE bundle with a CommonJS-style runtime

## Quick Start

```bash
npm install
npm run build
node dist/index.js <entry-file> [output-file]
```

Or run directly with ts-node:

```bash
npx ts-node src/index.ts <entry-file> [output-file]
```

### Example

```js
// src/math.js
export function add(a, b) { return a + b; }
export const PI = 3.14159;

// src/app.js
import { add, PI } from './math';
export default add(1, PI);
```

```bash
npx ts-node src/index.ts src/app.js dist/bundle.js
```

Output (`dist/bundle.js`):

```js
(function(modules) {
  var cache = {};
  function __require(id) {
    if (cache[id]) return cache[id].exports;
    var mod = { exports: {} };
    cache[id] = mod;
    modules[id](mod.exports, __require);
    return mod.exports;
  }
  return __require(1); // entry module
})({
  0: function(exports, __require) {
    // math.js transformed
    exports.add = function add(a, b) { return a + b; }
    const PI = 3.14159;
    exports.PI = PI;
  },
  1: function(exports, __require) {
    // app.js transformed
    const { add, PI } = __require(0);
    exports.default = add(1, PI);
  }
});
```

## Architecture

```
src/
├── index.ts    — CLI entry point
├── parser.ts   — ES module import/export parser + CJS transformer
└── bundler.ts  — Dependency graph builder + bundle emitter
```

### parser.ts

- `parseImports(source)` — extracts all import declarations with their specifiers and bindings
- `parseExports(source)` — extracts export declarations (default, named, re-exports, declarations)
- `transformModule(source, id)` — converts ES module syntax to CJS-compatible code using `exports` and `__require`

### bundler.ts

- `resolveSpecifier(specifier, fromFile)` — resolves relative specifiers to absolute paths
- `buildDependencyGraph(entryFile)` — builds the full module graph with topological ordering
- `emitBundle(graph)` — generates the final IIFE bundle string
- `bundle(entry, output?)` — convenience wrapper: build graph + emit + optionally write to file

## Limitations

This is a learning project, not a production bundler. Known limitations:

- No tree-shaking
- No code splitting
- No source maps
- No support for dynamic `import()`
- No asset loading (CSS, JSON, images)
- Regex-based transform (not AST-based) — may fail on edge cases
- No support for TypeScript type stripping (use `tsc` first)

## Running Tests

```bash
npm test
```

## License

MIT
