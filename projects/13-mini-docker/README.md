# mini-docker

> A tiny container runner in pure Python using Linux namespaces, cgroup v2, and overlayfs.

[中文](README.zh.md)

---

## Background

Docker feels large because it bundles image distribution, build cache, networking, logging, and orchestration hooks. The runtime core is much smaller:

- overlayfs stacks read-only image layers into one merged root filesystem
- namespaces give the process its own mount, PID, UTS, and IPC view
- cgroups cap memory usage and process count

This project implements exactly that small slice. It accepts pre-unpacked rootfs directories as layers, mounts them with overlayfs, places the child process into a dedicated cgroup, and starts the command in fresh Linux namespaces.

---

## Architecture

```text
image layers (dirs)
   │
   ▼
overlayfs mount
   │
   ▼
merged rootfs
   │
   ├── cgroup v2: memory.max / pids.max
   └── namespaces: mount + pid + uts + ipc
          │
          ▼
      chroot + exec
```

The code intentionally stops at "run one process in one isolated rootfs". There is no image pull, no registry format, and no network bridge. That keeps the runtime easy to inspect.

---

## Key Implementation

### Overlay layers

The runtime expects each layer to already exist as a directory. They are passed to overlayfs in reverse order so the last layer wins on conflicts, which matches the way container image layers behave.

### Cgroup limits

The runner creates `mini-docker-<name>` under cgroup v2 and writes:

- `memory.max`
- `pids.max`
- `cgroup.procs`

That is enough to demonstrate resource accounting without introducing a full OCI runtime layout.

### Namespaces + rootfs switch

The child process unshares mount, PID, UTS, and IPC namespaces, sets a hostname, `chroot`s into the merged rootfs, mounts `/proc`, and finally `exec`s the requested command.

---

## How to Run

Requirements:

- Linux
- root privileges
- cgroup v2 enabled
- overlayfs support
- `mount` / `umount`
- a rootfs layer containing the command you want to run

Example:

```bash
python projects/13-mini-docker/demo.py \
  --name busybox \
  --layer /path/to/busybox-rootfs \
  -- /bin/sh -c 'echo hello && ps'
```

Run tests:

```bash
python -m pytest projects/13-mini-docker/test -q
```

The tests focus on overlay/cgroup setup logic and argument validation, so they work outside Linux too.

---

## What This Omits

- user namespaces / rootless containers
- seccomp, capabilities, AppArmor, SELinux
- network namespaces and virtual Ethernet pairs
- OCI image manifests and tar layer extraction
- bind mounts, volumes, and copy-on-write quotas

Those features matter in production runtimes, but the essential relationship between namespaces, cgroups, and overlayfs is already visible here.
