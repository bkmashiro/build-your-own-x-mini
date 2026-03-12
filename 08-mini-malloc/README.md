# 08 — mini-malloc

> A minimal heap allocator in pure Python, using a free list, first-fit allocation, and block coalescing.

## Background

Dynamic memory allocation is about turning one large byte region into many variable-sized pieces. Real allocators are complex, but the core ideas show up even in a tiny model:

- a heap is a contiguous memory area
- each block carries metadata in a header
- free space is tracked with a linked list
- allocation finds a usable block and may split it
- freeing a block may merge neighbors back together

This project simulates those mechanics with a Python `bytearray`.

## Architecture

### Block Headers

Each block starts with a fixed 12-byte header:

- `size`
- `free_flag`
- `next_ptr`

The payload begins immediately after the header. Blocks stay linked in heap order, which makes adjacent-block coalescing simple.

### Free List

The allocator walks the list with a **first-fit** policy:

1. scan from the head
2. pick the first free block large enough
3. split it if the remainder can still hold a header plus payload

This is one of the oldest allocator strategies, and one of the easiest to understand.

## Key Implementation

### `malloc(size)`

`malloc` finds the first free block with enough capacity. If the block is bigger than needed, it is split into:

- an allocated block of the requested size
- a new free tail block

Otherwise the allocator consumes the whole block.

### `free(ptr)` and coalescing

`free` marks a block as free, then scans for adjacent free neighbors:

- if two neighboring blocks are both free
- and the second starts exactly where the first ends
- they are merged into one larger block

That is the key step that repairs fragmentation after repeated allocate/free cycles.

### `realloc(ptr, size)`

`realloc` tries to grow in place first by stealing the next free block if possible. If that fails, it allocates a new block, copies the old payload, and frees the original block.

## How to Run

```bash
python3 demo.py
```

The demo shows:

- initial allocations
- a first-fit reuse of a freed block
- adjacent free block coalescing
- a `realloc` that preserves payload bytes

## Key Takeaways

- A heap allocator can be explained with just headers, a linked list, and a few split/merge rules.
- First-fit is simple and practical enough to demonstrate fragmentation behavior.
- Coalescing is what turns local frees back into reusable larger regions.
