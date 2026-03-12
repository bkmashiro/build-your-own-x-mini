# 09 — mini-tls

> A minimal TLS 1.3-style handshake simulator in Python, with X25519-style key shares, certificate structure parsing, and AES-128-GCM application records.

## Background

TLS 1.3 tries to make secure connections both safer and simpler:

- fewer round trips than older TLS versions
- ephemeral key exchange by default
- authenticated handshake transcripts
- modern AEAD ciphers such as AES-GCM for application data

Real TLS stacks are large because they handle many extensions, compatibility rules, and certificate formats. This project keeps only the core flow needed to explain the protocol.

## Architecture

### Handshake phases

The simulator follows the usual TLS 1.3 shape:

1. `ClientHello` advertises TLS 1.3, cipher suites, and an X25519 key share
2. `ServerHello` returns its own key share and a certificate blob
3. both sides derive a shared handshake secret
4. `Finished` messages confirm both sides computed the same secret
5. application traffic keys are derived and used to protect records

### Key schedule

The implementation uses a tiny HKDF-like expander built from SHA-256. From a shared secret derived from both key shares, it derives:

- handshake verification values
- client application traffic key
- server application traffic key
- per-direction nonce seeds

This is not a drop-in replacement for the RFC key schedule, but it preserves the same conceptual layering.

## Key Implementation

### Key shares and fallback

If `cryptography` is available, the handshake generates real X25519 key shares and uses AES-128-GCM for application records. The shared secret derivation is intentionally simplified so the whole implementation stays compact and deterministic for teaching. If `cryptography` is missing, the code falls back to pure-stdlib byte derivation and still demonstrates the same handshake shape.

### Certificate parsing

The certificate is represented as a JSON blob. Parsing only validates the outer structure:

- subject
- issuer
- SAN list
- validity metadata

That matches the goal here: understand where certificate data enters the handshake without implementing a full ASN.1 parser.

### Record protection

After `Finished`, each side creates two cipher states:

- one for sending
- one for receiving

Each state maintains its own sequence number and derives a unique nonce per record, mirroring how TLS record protection works in practice.

## How to Run

```bash
python3 demo.py
```

The demo performs the full handshake, encrypts `Hello from client!`, decrypts it on the server, and sends an encrypted reply back.

## Key Takeaways

- TLS 1.3 is mostly a pipeline of transcript messages, key agreement, and traffic-key derivation.
- Fresh key shares feed the handshake secret that later protects application traffic.
- AEAD record protection is conceptually simple once the handshake has produced the right keys.
