"""mini-os - bootloader, interrupts, paging, and scheduling in under 200 lines."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

PAGE_SIZE = 4096


@dataclass
class Process:
    pid: int
    name: str
    instructions: list[str]
    ip: int = 0
    state: str = "new"
    page_table: dict[int, int] = field(default_factory=dict)

    def current_instruction(self):
        return self.instructions[self.ip] if self.ip < len(self.instructions) else "halt"

    def finished(self):
        return self.ip >= len(self.instructions)


class MiniOS:
    def __init__(self):
        self.next_pid = 1
        self.next_frame = 0
        self.tick = 0
        self.processes = {}
        self.ready = deque()
        self.interrupts = {}
        self.boot_log = []

    def boot(self, images):
        self.boot_log.append("bootloader: power on self test")
        self.register_interrupt(32, self._timer_interrupt)
        self.register_interrupt(128, self._syscall_interrupt)
        self.boot_log.append("bootloader: idt loaded")
        for image in images:
            proc = self.load_process(image["name"], image["instructions"])
            self.ready.append(proc.pid)
            self.boot_log.append(f"bootloader: loaded {proc.name} as pid={proc.pid}")
        self.boot_log.append("bootloader: jump to kernel main loop")
        return list(self.boot_log)

    def register_interrupt(self, vector, handler):
        self.interrupts[vector] = handler

    def load_process(self, name, instructions):
        proc = Process(self.next_pid, name, list(instructions))
        self.next_pid += 1
        pages = max(1, len(proc.instructions))
        for vpn in range(pages):
            proc.page_table[vpn] = self._alloc_frame()
        proc.state = "ready"
        self.processes[proc.pid] = proc
        return proc

    def _alloc_frame(self):
        frame = self.next_frame
        self.next_frame += 1
        return frame

    def translate(self, proc, virtual_addr):
        vpn, offset = divmod(virtual_addr, PAGE_SIZE)
        if vpn not in proc.page_table:
            raise MemoryError(f"pid={proc.pid} page fault at vpn={vpn}")
        return proc.page_table[vpn] * PAGE_SIZE + offset

    def interrupt(self, vector, proc, **payload):
        handler = self.interrupts[vector]
        return handler(proc, **payload)

    def _timer_interrupt(self, proc, **_):
        self.tick += 1
        proc.state = "ready"
        self.ready.append(proc.pid)
        return f"int 32: timer tick={self.tick}, context switch from pid={proc.pid}"

    def _syscall_interrupt(self, proc, op, **payload):
        if op == "write":
            return f"int 128: pid={proc.pid} write('{payload['text']}')"
        if op == "yield":
            proc.state = "ready"
            self.ready.append(proc.pid)
            return f"int 128: pid={proc.pid} voluntary yield"
        return f"int 128: pid={proc.pid} unknown syscall={op}"

    def step(self):
        if not self.ready:
            return None
        pid = self.ready.popleft()
        proc = self.processes[pid]
        if proc.finished():
            proc.state = "halted"
            return f"scheduler: skip halted pid={pid}"
        proc.state = "running"
        instr = proc.current_instruction()
        trace = [f"scheduler: run pid={pid} ({proc.name})"]
        trace.append(f"mmu: ip={proc.ip} va={proc.ip * PAGE_SIZE} -> pa={self.translate(proc, proc.ip * PAGE_SIZE)}")
        if instr.startswith("compute"):
            trace.append(f"cpu: pid={pid} {instr}")
            proc.ip += 1
            if proc.finished():
                proc.state = "halted"
                trace.append(f"process: pid={pid} exited")
            else:
                trace.append(self.interrupt(32, proc))
        elif instr.startswith("syscall:write:"):
            text = instr.split(":", 2)[2]
            trace.append(self.interrupt(128, proc, op="write", text=text))
            proc.ip += 1
            if proc.finished():
                proc.state = "halted"
                trace.append(f"process: pid={pid} exited")
            else:
                trace.append(self.interrupt(32, proc))
        elif instr == "yield":
            proc.ip += 1
            trace.append(self.interrupt(128, proc, op="yield"))
        elif instr == "halt":
            proc.ip = len(proc.instructions)
            proc.state = "halted"
            trace.append(f"process: pid={pid} halted")
        else:
            proc.ip += 1
            trace.append(f"cpu: pid={pid} nop('{instr}')")
            trace.append(self.interrupt(32, proc))
        return trace

    def run(self, steps=20):
        history = []
        for _ in range(steps):
            trace = self.step()
            if not trace:
                history.append(["scheduler: idle"])
                break
            history.append(trace if isinstance(trace, list) else [trace])
            if all(proc.finished() or proc.state == "halted" for proc in self.processes.values()) and not self.ready:
                break
        return history

    def snapshot(self):
        return [
            {
                "pid": proc.pid,
                "name": proc.name,
                "state": proc.state,
                "ip": proc.ip,
                "pages": dict(proc.page_table),
            }
            for proc in self.processes.values()
        ]
