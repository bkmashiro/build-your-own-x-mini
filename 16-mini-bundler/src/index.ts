/**
 * index.ts - CLI entry point for mini-bundler
 *
 * Usage:
 *   ts-node src/index.ts <entry> [output]
 *   node dist/index.js <entry> [output]
 */

import { bundle } from './bundler';
import * as path from 'path';

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
mini-bundler — A minimal ES module bundler

Usage:
  mini-bundler <entry> [output]

Arguments:
  entry   Entry JS/TS file (required)
  output  Output bundle file (optional, prints to stdout if omitted)

Example:
  mini-bundler src/index.js dist/bundle.js
`);
    process.exit(0);
  }

  const entryFile = path.resolve(args[0]);
  const outputFile = args[1] ? path.resolve(args[1]) : undefined;

  try {
    const result = bundle(entryFile, outputFile);

    if (!outputFile) {
      process.stdout.write(result);
    } else {
      console.log(`✓ Bundle written to: ${outputFile}`);
    }
  } catch (err) {
    console.error('Bundle failed:', (err as Error).message);
    process.exit(1);
  }
}

main();
