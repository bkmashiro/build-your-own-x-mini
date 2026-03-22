/**
 * bundler.ts - Dependency graph builder and bundle emitter
 *
 * Algorithm:
 *  1. Start from an entry file
 *  2. Parse its imports to discover dependencies
 *  3. Recursively resolve + parse each dep (BFS/DFS)
 *  4. Assign each module a numeric ID
 *  5. Emit a self-contained IIFE bundle
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseImports, transformModule } from './parser';

export interface Module {
  id: number;
  filePath: string;
  /** Original source code */
  source: string;
  /** Transformed (import/export replaced) code */
  transformedCode: string;
  /** Map from raw specifier → resolved absolute path */
  deps: Map<string, string>;
}

export interface DependencyGraph {
  /** Entry module id */
  entry: number;
  /** All modules keyed by absolute file path */
  modules: Map<string, Module>;
  /** Ordered list of module ids (topological order for output) */
  order: number[];
}

// Extensions to try when resolving bare filenames
const RESOLVE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.mjs'];

/**
 * Resolve a specifier relative to a parent file, trying common extensions.
 */
export function resolveSpecifier(specifier: string, fromFile: string): string | null {
  // Skip node_modules / bare specifiers (no leading . or /)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }

  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, specifier);

  // Try as-is
  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    return base;
  }

  // Try with extensions
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }

  // Try index file in directory
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = path.join(base, `index${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Build the full dependency graph starting from entryFile.
 */
export function buildDependencyGraph(entryFile: string): DependencyGraph {
  const absoluteEntry = path.resolve(entryFile);
  const modules = new Map<string, Module>();
  let nextId = 0;

  // Topological order (post-order DFS)
  const order: number[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>(); // cycle detection

  function visit(filePath: string): number {
    // Already fully processed
    if (visited.has(filePath)) {
      return modules.get(filePath)!.id;
    }

    // Currently on the call stack → cycle
    if (inStack.has(filePath)) {
      throw new Error(`Circular dependency detected involving: ${filePath}`);
    }

    inStack.add(filePath);

    let source: string;
    try {
      source = fs.readFileSync(filePath, 'utf-8');
    } catch {
      throw new Error(`Cannot read module: ${filePath}`);
    }

    const id = nextId++;
    const imports = parseImports(source);

    const deps = new Map<string, string>();
    for (const imp of imports) {
      const resolved = resolveSpecifier(imp.specifier, filePath);
      if (resolved) {
        deps.set(imp.specifier, resolved);
      }
      // Unresolved specifiers (node builtins, npm packages) are kept as-is
    }

    const mod: Module = {
      id,
      filePath,
      source,
      transformedCode: '', // filled after children
      deps,
    };
    modules.set(filePath, mod);

    // Visit all deps first (DFS)
    for (const [, depPath] of deps) {
      visit(depPath);
    }

    // Transform after visiting children
    mod.transformedCode = transformModule(source, id);

    inStack.delete(filePath);
    visited.add(filePath);
    order.push(id);

    return id;
  }

  visit(absoluteEntry);

  return {
    entry: modules.get(absoluteEntry)!.id,
    modules,
    order,
  };
}

/**
 * Emit a bundle from a dependency graph.
 *
 * Output format:
 * ```
 * (function(modules) {
 *   var cache = {};
 *   function __require(id) { ... }
 *   return __require(<entryId>);
 * })({ 0: function(exports, __require) { ... }, ... });
 * ```
 */
export function emitBundle(graph: DependencyGraph): string {
  const moduleById = new Map<number, Module>();
  for (const mod of graph.modules.values()) {
    moduleById.set(mod.id, mod);
  }

  // Build a map: absolute path → id for each module, so transformed code can
  // reference deps by id via __require(id).
  // We post-process each transformed module: replace __require("./specifier")
  // with __require(<id>) if the specifier resolved to a known module.

  const parts: string[] = [];

  for (const id of graph.order) {
    const mod = moduleById.get(id)!;

    // Replace string require calls with numeric IDs
    let code = mod.transformedCode;
    for (const [specifier, resolvedPath] of mod.deps) {
      const depMod = graph.modules.get(resolvedPath);
      if (depMod) {
        const escapedSpec = JSON.stringify(specifier).replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        code = code.replace(
          new RegExp(`__require\\(${escapedSpec}\\)`, 'g'),
          `__require(${depMod.id})`,
        );
      }
    }

    parts.push(`  ${id}: function(exports, __require) {\n${indent(code, 4)}\n  }`);
  }

  const bundle = `/**
 * Bundle generated by mini-bundler
 * Entry: ${graph.entry}
 */
(function(modules) {
  var cache = {};
  function __require(id) {
    if (cache[id]) return cache[id].exports;
    var mod = { exports: {} };
    cache[id] = mod;
    modules[id](mod.exports, __require);
    return mod.exports;
  }
  return __require(${graph.entry});
})({
${parts.join(',\n')}
});
`;

  return bundle;
}

function indent(code: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return code
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}

/**
 * Bundle a file and write (or return) the result.
 */
export function bundle(entryFile: string, outputFile?: string): string {
  const graph = buildDependencyGraph(entryFile);
  const output = emitBundle(graph);

  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, output, 'utf-8');
  }

  return output;
}
