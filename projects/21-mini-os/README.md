# mini-os

> A tiny Python OS simulator covering the bootloader path, interrupt dispatch, page-table translation, and round-robin scheduling.

[中文](README.zh.md)

---

## Features

- Boots a small "kernel" and loads process images like a toy bootloader
- Registers timer and syscall interrupts through a minimal interrupt descriptor table
- Maps each process virtual page to a physical frame and translates addresses through a page table
- Schedules processes with a simple round-robin ready queue and time-slice interrupts

---

## Files

- `src/mini_os.py`: core simulator in 156 lines
- `demo.py`: boots the system, runs two processes, and prints context switches

---

## How to Run

```bash
python projects/21-mini-os/demo.py
```

---

## Design

The implementation keeps the OS model intentionally small:

- `boot()` plays the bootloader role: initialize the IDT, load process images, and transfer control to the scheduler
- `interrupt(vector, ...)` dispatches into timer (`32`) and syscall (`128`) handlers
- `page_table[vpn] = frame` simulates paging, while `translate()` turns a virtual address into a physical address
- `step()` executes one instruction, then either triggers a timer interrupt, handles a syscall, or halts the process

This is enough to show how boot, memory translation, interrupt handling, and process switching fit together without hiding the control flow behind abstractions.

---

## Notes

- This is a teaching model, not a real kernel.
- There is no privilege separation, real device I/O, preemption hardware, or page replacement.
- Instructions are represented as strings so the scheduling and interrupt flow stays visible.
