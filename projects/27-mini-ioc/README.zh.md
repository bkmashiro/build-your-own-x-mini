# mini-ioc

> 一个极小的 TypeScript IoC 容器，支持类型化 token、工厂绑定和生命周期作用域。

[English](README.md)

---

## 背景

IoC 容器本质上都在解决三件事：

1. **抽象到实现的映射**
2. **对象依赖图的构建**
3. **对象生命周期的控制**

但 TypeScript 有一个现实问题：`interface` 在运行时会被擦除。所以“接口绑定”真正能绑定的不是接口本身，而是一个**运行时 token**，并让这个 token 在类型系统里携带接口类型。这个项目故意把这层关系写得很显式，不依赖 decorator 或反射。

---

## 架构

```text
Token<T>（symbol）
    │
    ▼
Binding
    ├── value     -> 常量配置 / 单例对象
    ├── class     -> 构造函数 + 依赖 token 列表
    └── factory   -> 自定义构造逻辑
    │
    ▼
Container
    ├── singleton cache  -> 根容器与所有子作用域共享
    ├── scoped cache     -> 每个作用域独立一份
    └── transient path   -> 每次 resolve 都重新创建
```

### 接口绑定

```ts
interface Logger {
  log(message: string): void;
}

const LOGGER = createToken<Logger>("Logger");
container.bind(LOGGER).toClass(ConsoleLogger, [], "singleton");
```

接口只存在于编译期，真正的运行时身份是 `symbol` token。

### 工厂模式

工厂会拿到 `resolver`，因此可以按需组合其他依赖：

```ts
container.bind(REQUEST_ID).toFactory(() => crypto.randomUUID(), "scoped");
container.bind(SERVICE).toFactory((resolver) => {
  return new Service(resolver.resolve(LOGGER), resolver.resolve(REQUEST_ID));
});
```

### 生命周期管理

- `singleton`：整个容器树只创建一次
- `scoped`：每个 scope 一次
- `transient`：每次解析都创建新实例

如果实例实现了 `dispose()` 或 `Symbol.dispose`，容器会在所属 scope 销毁时自动清理。

---

## 运行方式

```bash
cd projects/27-mini-ioc
npm test
npm run demo
```

---

## 刻意省略的部分

- 不做 decorator / reflect-metadata
- 不做异步工厂
- 不做循环依赖检测

这样代码核心就很清楚：绑定、缓存、作用域边界，以及销毁时机。
