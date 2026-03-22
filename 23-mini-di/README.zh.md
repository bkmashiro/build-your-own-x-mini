# mini-di

> 用 TypeScript 实现的极简依赖注入容器。  
> 支持 `@Injectable` 元数据、构造函数注入、单例/瞬态作用域。

[English](README.md)

---

## 背景

大多数 DI 容器本质上只做三件事：

1. 注册类或 token
2. 确定构造函数依赖
3. 决定实例是复用还是每次新建

这个 mini 项目只保留这三个核心点，不做模块系统、不做属性注入，也不依赖额外的反射库。

依赖信息通过装饰器显式声明：

```ts
@Injectable({ deps: [Logger], scope: "singleton" })
class UserService {
  constructor(private readonly logger: Logger) {}
}
```

这样虽然比 `reflect-metadata` 更手动一点，但实现足够小，而且容器内部的解析流程一目了然。

---

## 架构

```text
@Injectable(...)
    │
    ▼
WeakMap 元数据表
    │
    ▼
Container.resolve(Token)
    ├── 读取 provider 配置
    ├── 递归 resolve 依赖
    ├── new Class(...deps)
    └── 如果是 singleton 就缓存
```

### `@Injectable`

装饰器记录两类元数据：

- `deps`：构造函数依赖 token 列表
- `scope`：`"singleton"` 或 `"transient"`

### 解析流程

`Container.resolve()` 会递归构造整棵依赖树。只要类上有 `@Injectable`，即使没有手动 `register()` 也能直接解析。

### 作用域

- `singleton`：首次创建后缓存，后续复用
- `transient`：每次 `resolve()` 都重新创建

### 循环依赖保护

容器维护一个“当前正在解析”的集合。如果某个 token 还没解析完又再次请求自己，就立刻抛错，避免无限递归。

---

## 运行方式

```bash
cd 23-mini-di
bun run demo.ts
```

## 运行测试

```bash
cd 23-mini-di
bun test
```

---

## 核心要点

| 概念 | mini-di 中的实现 |
|:-----|:-----------------|
| 注册 | `register()` 显式注册，或读取装饰器元数据隐式注册 |
| 构造函数注入 | `deps` 数组映射构造函数参数 token |
| 单例作用域 | 首次构造后写入 `Map` 缓存 |
| 瞬态作用域 | 不缓存，每次都 `new` |
| 元数据存储 | 用类构造函数作为 key 的 `WeakMap` |
| 循环依赖检测 | 用 `Set` 跟踪当前解析中的 token |
