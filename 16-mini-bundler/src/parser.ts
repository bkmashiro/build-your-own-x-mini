/**
 * parser.ts - Parse ES module imports/exports from JS/TS source code
 *
 * Supports:
 *   import foo from './foo'
 *   import { bar, baz } from './bar'
 *   import * as ns from './ns'
 *   export default ...
 *   export { ... }
 *   export function / class / const / let / var
 */

export interface ImportDeclaration {
  /** The raw specifier string, e.g. "./foo" or "path" */
  specifier: string;
  /** Named bindings: { bar, baz } */
  named: string[];
  /** Default binding: import foo from ... */
  defaultBinding: string | null;
  /** Namespace binding: import * as ns from ... */
  namespaceBinding: string | null;
}

export interface ExportDeclaration {
  /** export default */
  isDefault: boolean;
  /** Named exports: export { foo, bar } */
  named: string[];
  /** re-exports: export { foo } from './foo' */
  fromSpecifier: string | null;
  /** Declared identifier: export function foo / export const foo */
  declaredName: string | null;
}

export interface ParseResult {
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  /** Source with import/export statements replaced by placeholders for bundling */
  transformedCode: string;
}

/**
 * Parse all static import declarations from source code.
 */
export function parseImports(source: string): ImportDeclaration[] {
  const imports: ImportDeclaration[] = [];

  // Match: import ... from '...'  or  import ... from "..."
  // Handles: default, named { }, namespace * as, and combinations
  const importRe =
    /^[ \t]*import\s+((?:[^'"]+?\s+from\s+)?['"][^'"]+['"])/gm;

  // More precise multi-pattern approach
  const patterns = [
    // import defaultExport from 'module'
    // import defaultExport, { named } from 'module'
    // import * as ns from 'module'
    // import { named } from 'module'
    // import 'module'  (side-effect only)
    /^[ \t]*import\s+(?:(?<default_ns>(?:\w+\s*,\s*)?\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?|\{[^}]*\})\s+from\s+)?['"](?<specifier>[^'"]+)['"]/gm,
  ];

  void importRe; // suppress unused warning – we use patterns below

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(source)) !== null) {
      const specifier = m.groups?.specifier ?? '';
      const clause = m.groups?.default_ns ?? '';

      const imp: ImportDeclaration = {
        specifier,
        named: [],
        defaultBinding: null,
        namespaceBinding: null,
      };

      // namespace: * as ns
      const nsMatch = clause.match(/\*\s+as\s+(\w+)/);
      if (nsMatch) {
        imp.namespaceBinding = nsMatch[1];
      }

      // named: { foo, bar as baz }
      const namedMatch = clause.match(/\{([^}]*)\}/);
      if (namedMatch) {
        imp.named = namedMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // default: leading identifier before comma or { or * or 'from'
      const defaultMatch = clause.match(/^(\w+)\s*(?:,|\s+from\s*$|$)/);
      if (defaultMatch && defaultMatch[1] !== 'as') {
        imp.defaultBinding = defaultMatch[1];
      }

      imports.push(imp);
    }
  }

  return imports;
}

/**
 * Parse all export declarations from source code.
 */
export function parseExports(source: string): ExportDeclaration[] {
  const exports: ExportDeclaration[] = [];

  // export default <expression|declaration>
  const defaultRe = /^[ \t]*export\s+default\s+/gm;
  let m: RegExpExecArray | null;
  defaultRe.lastIndex = 0;
  while ((m = defaultRe.exec(source)) !== null) {
    exports.push({ isDefault: true, named: [], fromSpecifier: null, declaredName: null });
  }

  // export { foo, bar } [from '...']
  const namedRe =
    /^[ \t]*export\s+\{([^}]*)\}(?:\s+from\s+['"]([^'"]+)['"])?/gm;
  namedRe.lastIndex = 0;
  while ((m = namedRe.exec(source)) !== null) {
    const named = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const fromSpecifier = m[2] ?? null;
    exports.push({ isDefault: false, named, fromSpecifier, declaredName: null });
  }

  // export function/class/const/let/var <name>
  const declRe =
    /^[ \t]*export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+(\w+)/gm;
  declRe.lastIndex = 0;
  while ((m = declRe.exec(source)) !== null) {
    exports.push({
      isDefault: false,
      named: [],
      fromSpecifier: null,
      declaredName: m[1],
    });
  }

  return exports;
}

/**
 * Transform ES module source into a CommonJS-compatible module factory string.
 * Replaces import/export syntax so the bundler can wrap it in a closure.
 */
export function transformModule(source: string, moduleId: number): string {
  let code = source;

  // Replace: import defaultExport from 'specifier'
  // with:    const defaultExport = __require(moduleId)
  // We'll do a simplified transform — real bundlers use AST; we use regex
  // The bundler will re-stitch the require calls by dependency order.

  // Side-effect import: import 'foo'  →  __require("foo")
  code = code.replace(
    /^[ \t]*import\s+['"]([^'"]+)['"]\s*;?[ \t]*/gm,
    (_full, spec) => `__require(${JSON.stringify(spec)});\n`,
  );

  // import * as ns from 'foo'  →  const ns = __require("foo")
  code = code.replace(
    /^[ \t]*import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?[ \t]*/gm,
    (_full, ns, spec) => `const ${ns} = __require(${JSON.stringify(spec)});\n`,
  );

  // import defaultExport, { named } from 'foo'
  code = code.replace(
    /^[ \t]*import\s+(\w+)\s*,\s*\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]\s*;?[ \t]*/gm,
    (_full, def, named, spec) => {
      const namedList = named
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((s: string) => {
          const parts = s.split(/\s+as\s+/);
          return parts.length === 2 ? `${parts[0].trim()}: ${parts[1].trim()}` : s;
        })
        .join(', ');
      return (
        `const ${def} = __require(${JSON.stringify(spec)}).default;\n` +
        `const { ${namedList} } = __require(${JSON.stringify(spec)});\n`
      );
    },
  );

  // import { named } from 'foo'
  code = code.replace(
    /^[ \t]*import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]\s*;?[ \t]*/gm,
    (_full, named, spec) => {
      const namedList = named
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((s: string) => {
          const parts = s.split(/\s+as\s+/);
          return parts.length === 2 ? `${parts[0].trim()}: ${parts[1].trim()}` : s;
        })
        .join(', ');
      return `const { ${namedList} } = __require(${JSON.stringify(spec)});\n`;
    },
  );

  // import defaultExport from 'foo'
  code = code.replace(
    /^[ \t]*import\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?[ \t]*/gm,
    (_full, def, spec) =>
      `const ${def} = __require(${JSON.stringify(spec)}).default ?? __require(${JSON.stringify(spec)});\n`,
  );

  // export default <expr>  →  exports.default = <expr>
  code = code.replace(
    /^[ \t]*export\s+default\s+/gm,
    'exports.default = ',
  );

  // export { foo, bar as baz } [from '...']
  code = code.replace(
    /^[ \t]*export\s+\{([^}]*)\}(?:\s+from\s+['"]([^'"]+)['"])?\s*;?[ \t]*/gm,
    (_full, named, spec) => {
      const assignments = named
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((s: string) => {
          const parts = s.split(/\s+as\s+/);
          if (parts.length === 2) {
            const orig = parts[0].trim();
            const alias = parts[1].trim();
            if (spec) {
              return `exports.${alias} = __require(${JSON.stringify(spec)}).${orig};`;
            }
            return `exports.${alias} = ${orig};`;
          }
          if (spec) {
            return `exports.${s} = __require(${JSON.stringify(spec)}).${s};`;
          }
          return `exports.${s} = ${s};`;
        })
        .join('\n');
      return assignments + '\n';
    },
  );

  // export async function foo / export function foo
  // → exports.foo = async function foo(...) { ... }
  code = code.replace(
    /^[ \t]*export\s+(async\s+)?function\s+(\w+)/gm,
    (_full, async_, name) => `exports.${name} = ${async_ ?? ''}function ${name}`,
  );

  // export class Foo  →  exports.Foo = class Foo
  code = code.replace(
    /^[ \t]*export\s+class\s+(\w+)/gm,
    (_full, name) => `exports.${name} = class ${name}`,
  );

  // export const/let/var foo = ...
  // → const foo = ...\nexports.foo = foo
  // We use a two-pass: first strip 'export', then append an exports line after each declaration.
  code = code.replace(
    /^([ \t]*)export\s+(const|let|var)\s+(\w+)/gm,
    (_full, indent_, kw, name) => `${indent_}${kw} ${name}`,
  );
  // Second pass: for each "const/let/var NAME = ..." line that follows an export strip,
  // add exports.NAME = NAME after. We track by looking for lines that had export stripped.
  // Simpler: scan for const/let/var lines and add exports assignments for known export names.
  // Collect names from original source's export declarations.
  const exportedVarNames: string[] = [];
  const exportVarRe = /^[ \t]*export\s+(?:const|let|var)\s+(\w+)/gm;
  let evm: RegExpExecArray | null;
  while ((evm = exportVarRe.exec(source)) !== null) {
    exportedVarNames.push(evm[1]);
  }
  for (const varName of exportedVarNames) {
    // Add exports.name = name after the variable declaration line
    code = code.replace(
      new RegExp(`^([ \\t]*(?:const|let|var) ${varName}\\s*=.*)$`, 'm'),
      (_full, line) => `${line}\nexports.${varName} = ${varName};`,
    );
  }

  void moduleId;
  return code;
}
