# mini-docker

> 纯 Python 实现的极小容器运行器，使用 Linux namespaces、cgroup v2 和 overlayfs。

[English](README.md)

---

## 背景

Docker 看起来很大，是因为它还包含镜像分发、构建缓存、网络、日志和编排接口。真正的运行时核心其实小得多：

- overlayfs 把多层只读镜像目录叠成一个合并后的根文件系统
- namespaces 给进程提供独立的 mount、PID、UTS 和 IPC 视图
- cgroups 负责限制内存和进程数量

这个项目只实现这块最小核心。它接收已经解包好的 rootfs 目录作为 layers，用 overlayfs 挂载出 merged rootfs，把子进程放进独立 cgroup，然后在新的 Linux namespaces 里启动命令。

---

## 架构

```text
镜像层（目录）
   │
   ▼
overlayfs 挂载
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

代码刻意停留在“在隔离 rootfs 中运行一个进程”这一层，不实现 image pull、registry 格式和网络桥接，这样才能把运行时机制看得足够清楚。

---

## 关键实现

### Overlay 层叠

运行器要求每一层已经是现成目录。传给 overlayfs 时会反转顺序，因此最后一层拥有最高优先级，这和容器镜像 layer 的覆盖语义一致。

### Cgroup 限制

运行器会在 cgroup v2 下创建 `mini-docker-<name>`，并写入：

- `memory.max`
- `pids.max`
- `cgroup.procs`

这已经足够展示资源隔离和计费的最小实现，不需要完整 OCI runtime 布局。

### Namespaces 与 rootfs 切换

子进程会 unshare mount、PID、UTS 和 IPC namespaces，设置 hostname，`chroot` 到 merged rootfs，挂载 `/proc`，最后 `exec` 用户给出的命令。

---

## 运行方式

要求：

- Linux
- root 权限
- 已启用 cgroup v2
- 内核支持 overlayfs
- 系统有 `mount` / `umount`
- 至少有一个包含目标命令的 rootfs layer

示例：

```bash
python projects/13-mini-docker/demo.py \
  --name busybox \
  --layer /path/to/busybox-rootfs \
  -- /bin/sh -c 'echo hello && ps'
```

运行测试：

```bash
python -m pytest projects/13-mini-docker/test -q
```

测试主要覆盖 overlay/cgroup 的配置逻辑与参数校验，因此在非 Linux 环境下也能跑。

---

## 这里省略了什么

- user namespaces / rootless 容器
- seccomp、capabilities、AppArmor、SELinux
- network namespaces 与虚拟网卡
- OCI 镜像 manifest 与 tar layer 解包
- bind mount、volume 和更细的 copy-on-write 配额

这些是生产级容器运行时的重要组成部分，但理解 namespaces、cgroups 与 overlayfs 如何配合，当前这个最小版本已经足够。
