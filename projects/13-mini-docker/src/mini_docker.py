"""mini-docker - tiny container runner with namespaces, cgroups, and overlayfs."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


class MiniDocker:
    def __init__(self, work_root: str = "/tmp", cgroup_root: str = "/sys/fs/cgroup"):
        self.work_root = Path(work_root)
        self.cgroup_root = Path(cgroup_root)

    def validate_host(self) -> None:
        if sys.platform != "linux":
            raise RuntimeError("mini-docker requires Linux")
        if os.geteuid() != 0:
            raise RuntimeError("mini-docker requires root privileges")
        if not hasattr(os, "unshare"):
            raise RuntimeError("mini-docker requires os.unshare support")
        for command in ("mount", "umount"):
            if shutil.which(command) is None:
                raise RuntimeError(f"missing required command: {command}")
        if not (self.cgroup_root / "cgroup.controllers").exists():
            raise RuntimeError("mini-docker requires cgroup v2")

    def overlay_options(self, layers: list[str], upper: Path, work: Path) -> str:
        lowers = ":".join(str(Path(layer).resolve()) for layer in reversed(layers))
        return f"lowerdir={lowers},upperdir={upper},workdir={work}"

    def create_cgroup(self, name: str, memory_max: str, pids_max: int) -> Path:
        group = self.cgroup_root / f"mini-docker-{name}"
        group.mkdir(parents=True, exist_ok=True)
        (group / "memory.max").write_text(f"{memory_max}\n")
        (group / "pids.max").write_text(f"{pids_max}\n")
        return group

    def mount_overlay(self, runtime: Path, layers: list[str]) -> Path:
        upper = runtime / "upper"
        work = runtime / "work"
        merged = runtime / "merged"
        upper.mkdir(parents=True, exist_ok=True)
        work.mkdir(parents=True, exist_ok=True)
        merged.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "mount",
                "-t",
                "overlay",
                "overlay",
                "-o",
                self.overlay_options(layers, upper, work),
                str(merged),
            ],
            check=True,
        )
        return merged

    def cleanup(self, merged: Path, cgroup: Path, runtime: Path) -> None:
        subprocess.run(["umount", str(merged / "proc")], check=False)
        subprocess.run(["umount", str(merged)], check=False)
        shutil.rmtree(runtime, ignore_errors=True)
        shutil.rmtree(cgroup, ignore_errors=True)

    def run(
        self,
        name: str,
        layers: list[str],
        command: list[str],
        memory_max: str = "256M",
        pids_max: int = 64,
        hostname: str = "mini-docker",
    ) -> int:
        self.validate_host()
        if not layers:
            raise ValueError("at least one layer is required")
        if not command:
            raise ValueError("a command is required")

        runtime = Path(tempfile.mkdtemp(prefix=f"{name}-", dir=self.work_root))
        cgroup = self.create_cgroup(name, memory_max, pids_max)
        merged = self.mount_overlay(runtime, layers)

        try:
            pid = os.fork()
            if pid == 0:
                try:
                    flags = (
                        os.CLONE_NEWNS
                        | os.CLONE_NEWPID
                        | os.CLONE_NEWUTS
                        | os.CLONE_NEWIPC
                    )
                    os.unshare(flags)
                    subprocess.run(["mount", "--make-rprivate", "/"], check=True)
                    inner = os.fork()
                    if inner == 0:
                        os.sethostname(hostname.encode())
                        os.chroot(merged)
                        os.chdir("/")
                        Path("/proc").mkdir(exist_ok=True)
                        subprocess.run(["mount", "-t", "proc", "proc", "/proc"], check=True)
                        os.execvp(command[0], command)
                    _, status = os.waitpid(inner, 0)
                    os._exit(os.waitstatus_to_exitcode(status))
                except Exception as exc:
                    print(f"mini-docker child failed: {exc}", file=sys.stderr)
                    os._exit(1)

            (cgroup / "cgroup.procs").write_text(f"{pid}\n")
            _, status = os.waitpid(pid, 0)
            return os.waitstatus_to_exitcode(status)
        finally:
            self.cleanup(merged, cgroup, runtime)
