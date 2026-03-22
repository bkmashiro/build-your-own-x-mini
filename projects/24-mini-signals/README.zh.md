# mini-signals

> 用小型 TypeScript 实现 Solid.js 风格响应式核心：signals、effects、memos 与批量更新。

[English](README.md)

---

## 背景

Signals 响应式系统和传统的“整棵树重新渲染”思路不同：

- `createSignal` 保存值，并记录谁读取了它
- `createEffect` 只在它依赖的读取发生变化时重新执行
- `createMemo` 缓存派生值，并把变化继续传播给下游 effect
- `batch` 将多次写入合并成一次统一 flush

Solid.js 把这种模型带到了前端框架里，但底层运行时其实很小。只要把依赖追踪、旧依赖清理和调度队列写对，一个最小可用的 signals 内核就成立了。

---

## 架构

```
Signal 写入
   │
   ▼
通知 observers
   │
   ▼
进入调度队列
   │
   ▼
flush 调度器
   ├── memo   -> 重新计算 -> 仅在值变化时通知下游
   └── effect -> 重新执行副作用，并重新收集依赖
```

每个 computation 都保存“上一次运行时读过哪些 source”。重新执行前，先从这些旧 source 上退订，再在全局 `currentComputation` 上下文中执行一次，把新依赖重新挂上去。分支切换能正确工作，核心就在这一步。

---

## 关键实现解析

### 自动依赖追踪

signal 或 memo 的 getter 被调用时，会检查当前是否存在正在运行的 computation：

```ts
function track(source: Source): void {
  if (!currentComputation || currentComputation.sources.has(source)) return;
  currentComputation.sources.add(source);
  source.observers.add(currentComputation);
}
```

这样就不需要手写依赖数组，依赖图会在运行时自动建立。

### 调度器与 memo 屏蔽

signal 写入时不会立刻同步重跑所有 effect，而是先把依赖项加入队列：

- effect 在一次 flush 中最多执行一次
- memo 会先重算
- 只有 memo 新旧值不同，才继续通知下游

这使得“派生值没变”时不会白白触发 effect。

### 批量更新

`batch()` 本质上是一个深度计数器。批处理中发生的写操作只负责排队，等最外层 batch 结束后再统一 flush。

因此多次状态更新会自然合并成一次反应传播。

---

## 运行方式

```bash
npm test
npm run demo
```

测试依赖 Node 25 自带的 `--experimental-strip-types`，不需要额外安装 TypeScript 编译工具链。

---

## 这里省略了什么

- 异步 resource / transition
- cleanup 回调（`onCleanup`）
- error boundary
- owner tree 与 dispose

这些对生产级运行时很重要，但理解 signals 的最小机制并不需要它们。
