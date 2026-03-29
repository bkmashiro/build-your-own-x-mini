from pathlib import Path
import sys

ROOT = Path(__file__).parent
sys.path.append(str(ROOT / "src"))

from mini_os import MiniOS


images = [
    {
        "name": "shell",
        "instructions": ["compute:init", "syscall:write:boot complete", "yield", "compute:prompt"],
    },
    {
        "name": "worker",
        "instructions": ["compute:load", "compute:hash", "syscall:write:job finished"],
    },
]

os = MiniOS()

print("== Boot ==")
for line in os.boot(images):
    print(line)

print("\n== Run ==")
for step, trace in enumerate(os.run(), 1):
    print(f"\nstep {step}")
    for line in trace:
        print(" ", line)

print("\n== Snapshot ==")
for proc in os.snapshot():
    print(proc)
