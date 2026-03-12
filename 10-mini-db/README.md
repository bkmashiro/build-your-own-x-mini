# 10 — mini-db

> A minimal in-memory SQL engine in Python, with a tokenizer, tiny parser, boolean `WHERE` evaluation, and a sorted-list index.

## Background

Even a very small SQL database has to solve three separate problems:

- turn text into tokens and statements
- represent table data in a form the executor can scan
- evaluate predicates to decide which rows match

Production databases add query planners, transactions, page caches, and disk layouts. This project keeps the core loop small enough to read in one sitting.

## Architecture

### Tokenizer and parser

The engine tokenizes identifiers, numbers, strings, and punctuation with a single regex. Parsing is then handled by a few recursive-descent functions for:

- `CREATE TABLE`
- `CREATE INDEX`
- `INSERT INTO`
- `SELECT ... FROM ... WHERE ...`
- `DELETE FROM ... WHERE ...`

### In-memory storage

Each table stores:

- column names
- a list of row dictionaries
- optional sorted indexes per column

That gives a simple execution model without introducing pages or file formats.

## Key Implementation

### Boolean `WHERE` expressions

The parser builds a tiny expression tree with:

- comparison nodes: `=`, `>`, `<`
- `AND`
- `OR`

The executor walks that tree against each row, which is enough to demonstrate filtering and operator precedence.

### Sorted-list index

`CREATE INDEX` builds a sorted list of `(value, row_number)` pairs for one column. Equality predicates like `WHERE age = 28` can then use `bisect` to find the matching range quickly, instead of scanning every row.

This is not a full B-tree, but it preserves the same idea: maintain data in sorted order so lookups can skip most of the table.

## How to Run

```bash
python3 demo.py
```

The demo creates a table, inserts rows, runs filtered queries, uses an indexed lookup, and deletes matching rows.

## Key Takeaways

- SQL engines are a pipeline: tokenize, parse, execute.
- A tiny AST plus row dictionaries is enough to explain query execution.
- Sorted indexes already show the main value of B-tree-like storage: faster predicate lookup than a full scan.
