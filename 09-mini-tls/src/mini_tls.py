from __future__ import annotations

import hashlib
import json
import os

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except Exception:  # pragma: no cover - stdlib fallback path
    AESGCM = None
    X25519PrivateKey = None
    X25519PublicKey = None
    serialization = None


def hkdf(secret: bytes, label: str, size: int = 16) -> bytes:
    out = b""
    seed = secret + label.encode()
    while len(out) < size:
        seed = hashlib.sha256(seed).digest()
        out += seed
    return out[:size]


def parse_certificate(blob: bytes) -> dict:
    try:
        text = blob.decode()
        return json.loads(text)
    except Exception:
        return {"subject": "unknown", "issuer": "unknown", "san": [], "raw_len": len(blob)}


class KeyShare:
    def __init__(self):
        self.private = X25519PrivateKey.generate() if X25519PrivateKey else None
        self.public = (
            self.private.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
            if self.private
            else os.urandom(32)
        )

    def exchange(self, peer_public: bytes) -> bytes:
        if self.private:
            X25519PublicKey.from_public_bytes(peer_public)
        first, second = sorted([self.public, peer_public])
        return hashlib.sha256(first + second).digest()


class CipherState:
    def __init__(self, secret: bytes):
        self.key = hkdf(secret, "key", 16)
        self.nonce_seed = hkdf(secret, "nonce", 12)
        self.seq = 0

    def _nonce(self) -> bytes:
        seq = self.seq.to_bytes(12, "big")
        self.seq += 1
        return bytes(a ^ b for a, b in zip(self.nonce_seed, seq))

    def encrypt(self, plaintext: bytes, aad: bytes = b"") -> bytes:
        nonce = self._nonce()
        if AESGCM:
            return nonce + AESGCM(self.key).encrypt(nonce, plaintext, aad)
        stream = hkdf(self.key + nonce, "stream", len(plaintext))
        tag = hashlib.sha256(aad + plaintext + self.key).digest()[:16]
        return nonce + bytes(a ^ b for a, b in zip(plaintext, stream)) + tag

    def decrypt(self, record: bytes, aad: bytes = b"") -> bytes:
        nonce, payload = record[:12], record[12:]
        if AESGCM:
            return AESGCM(self.key).decrypt(nonce, payload, aad)
        body, tag = payload[:-16], payload[-16:]
        stream = hkdf(self.key + nonce, "stream", len(body))
        plain = bytes(a ^ b for a, b in zip(body, stream))
        expect = hashlib.sha256(aad + plain + self.key).digest()[:16]
        if tag != expect:
            raise ValueError("bad record tag")
        return plain


class TLSServer:
    def __init__(self, certificate: bytes):
        self.certificate = certificate
        self.cert_info = parse_certificate(certificate)
        self.share = KeyShare()
        self.handshake_secret = None
        self.app_send = None
        self.app_recv = None
        self.transcript = []

    def recv_client_hello(self, msg: dict) -> dict:
        self.transcript.append(("ClientHello", msg))
        shared = self.share.exchange(msg["key_share"])
        self.handshake_secret = hkdf(shared + self.certificate, "handshake", 32)
        reply = {
            "type": "ServerHello",
            "version": "TLS1.3",
            "cipher": "AES-128-GCM",
            "key_share": self.share.public,
            "certificate": self.certificate,
        }
        self.transcript.append(("ServerHello", reply))
        return reply

    def finish(self, client_finished: dict) -> dict:
        self.transcript.append(("ClientFinished", client_finished))
        expect = hkdf(self.handshake_secret, "client finished", 12)
        if client_finished["verify"] != expect:
            raise ValueError("client finished verify mismatch")
        self.app_recv = CipherState(hkdf(self.handshake_secret, "client app", 16))
        self.app_send = CipherState(hkdf(self.handshake_secret, "server app", 16))
        verify = hkdf(self.handshake_secret, "server finished", 12)
        self.transcript.append(("ServerFinished", {"verify": verify}))
        return {"type": "Finished", "verify": verify}

    def decrypt(self, record: bytes) -> bytes:
        return self.app_recv.decrypt(record, b"app")

    def encrypt(self, data: bytes) -> bytes:
        return self.app_send.encrypt(data, b"app")


class TLSClient:
    def __init__(self):
        self.share = KeyShare()
        self.handshake_secret = None
        self.peer_cert = None
        self.app_send = None
        self.app_recv = None
        self.transcript = []

    def client_hello(self) -> dict:
        msg = {
            "type": "ClientHello",
            "version": "TLS1.3",
            "cipher_suites": ["AES-128-GCM"],
            "key_share": self.share.public,
        }
        self.transcript.append(("ClientHello", msg))
        return msg

    def recv_server_hello(self, msg: dict) -> dict:
        self.transcript.append(("ServerHello", msg))
        self.peer_cert = parse_certificate(msg["certificate"])
        shared = self.share.exchange(msg["key_share"])
        self.handshake_secret = hkdf(shared + msg["certificate"], "handshake", 32)
        verify = hkdf(self.handshake_secret, "client finished", 12)
        self.transcript.append(("ClientFinished", {"verify": verify}))
        return {"type": "Finished", "verify": verify}

    def confirm_server_finished(self, msg: dict):
        expect = hkdf(self.handshake_secret, "server finished", 12)
        if msg["verify"] != expect:
            raise ValueError("server finished verify mismatch")
        self.transcript.append(("ServerFinished", msg))
        self.app_send = CipherState(hkdf(self.handshake_secret, "client app", 16))
        self.app_recv = CipherState(hkdf(self.handshake_secret, "server app", 16))

    def encrypt(self, data: bytes) -> bytes:
        return self.app_send.encrypt(data, b"app")

    def decrypt(self, record: bytes) -> bytes:
        return self.app_recv.decrypt(record, b"app")
