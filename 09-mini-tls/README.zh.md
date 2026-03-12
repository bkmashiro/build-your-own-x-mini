# 09 — mini-tls

> 一个最小化的 TLS 1.3 风格握手模拟器：用 Python 展示 X25519 风格 key share、证书结构解析，以及 AES-128-GCM 应用数据加解密。

## 背景

TLS 1.3 的设计目标，核心上是两件事：更安全、也更快。

- 比旧版本 TLS 更少的往返次数
- 默认使用临时密钥交换，提供前向保密
- 用握手 transcript 绑定双方状态
- 应用数据使用 AES-GCM 这类 AEAD 算法保护

真正的 TLS 实现会非常大，因为它们要处理兼容性、扩展协商、证书链校验、ASN.1 解析、告警和错误恢复等大量细节。这个项目只保留“理解 TLS 1.3 主干流程”所必需的部分。

## 架构

### 1. 握手阶段

这个模拟器按 TLS 1.3 的典型顺序走：

1. `ClientHello`：客户端声明自己支持 TLS 1.3、给出 cipher suites，并附上 X25519 key share
2. `ServerHello`：服务端返回自己的 key share 和证书数据
3. 双方基于各自 key share 导出同一个 handshake secret
4. 通过 `Finished` 消息确认双方确实拿到了同样的秘密
5. 从 handshake secret 继续派生 client/server application traffic keys，用于后续数据加密

虽然代码很短，但流程上已经把 TLS 1.3 的主线串起来了。

### 2. Key Schedule：从共享秘密一步步派生不同用途的 key

真实 TLS 1.3 使用 HKDF-Extract / HKDF-Expand，并且有一套严格的 label 和 transcript 绑定规则。这里为了压缩到不到 200 行，使用了一个“类 HKDF”的 SHA-256 扩展器，保留结构，不追求 RFC 级别兼容。

从共享秘密出发，这个实现会派生出：

- 握手阶段的校验值
- client 方向的应用数据 key
- server 方向的应用数据 key
- 每个方向各自的 nonce seed

这样就保留了 TLS 最重要的分层思想：**一个主秘密，不同阶段、不同方向派生不同密钥材料。**

### 3. Record Layer：每个方向单独维护发送状态

握手完成后，客户端和服务端都会各自创建两套 cipher state：

- send state
- recv state

每套 state 都有：

- 一个 AES key
- 一个 nonce seed
- 一个递增 sequence number

发送一条记录时，把 sequence number 混入 nonce，再调用 AES-GCM 加密。这和真实 TLS 记录层“每条记录有唯一 nonce”的核心机制是对应的。

## 关键实现分析

### X25519 key share 与 fallback

如果环境里有 `cryptography`，这个项目就会使用真实的：

- X25519 key share 生成
- AES-128-GCM

为了把实现压缩到不到 200 行，共享秘密的推导做了教学化简化：它保留“双方拿到同一份共享材料，再继续派生握手和应用密钥”这个结构，但不追求 RFC 级别的精确实现。如果没有 `cryptography`，代码会进一步退化到纯标准库的演示模式，用伪共享秘密和简化加密展示同样的流程。

### 证书解析为什么只解析结构

这里的证书不是完整 X.509 DER，而是一个 JSON blob，里面放：

- `subject`
- `issuer`
- `san`
- 一些有效期元数据

这当然不是真正的证书格式，但它准确展示了“证书在握手中承担什么角色”：

- 服务端发送一份身份声明
- 客户端解析它的结构
- 然后基于这个身份上下文继续完成握手

教学重点是证书在协议流程中的位置，而不是 ASN.1 语法。

### Finished 消息在这里代表什么

`Finished` 的意义，是“我已经按照同样的握手上下文导出了同样的秘密”。真实 TLS 会对完整 transcript 做 HMAC 校验，这里简化成派生固定 verify bytes，但保留了语义：

- 客户端发一个 verify 值给服务端
- 服务端核对成功后回自己的 verify 值
- 客户端再确认

只要 verify 对不上，握手就失败。

### 应用数据加密

握手完成后，客户端用自己的发送密钥把 `Hello from client!` 加密，服务端用对应的接收密钥解密；服务端的回包方向也一样。这样 demo 能完整展示：

- 握手成功
- 产生会话密钥
- 会话密钥真的被用来保护应用数据

这比只打印“handshake complete”更接近真实 TLS 的意义。

## 如何运行

```bash
python3 demo.py
```

`demo.py` 会演示：

- `ClientHello -> ServerHello -> Finished`
- 服务端证书结构解析
- 握手后客户端发送加密消息
- 服务端解密，再发回加密响应
- 客户端成功解密服务端响应

## 关键收获

- TLS 1.3 的核心不是“很多消息”，而是“围绕 transcript 和密钥派生组织起来的一条状态机”。
- 双方的 key share 会喂给同一个共享秘密，再派生后续流量密钥。
- `Finished` 负责确认双方对握手上下文的一致理解。
- AES-GCM 记录层是在握手产出 traffic keys 之后才真正开始工作的。
