#!/usr/bin/env python3
"""Demo for mini-tls."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from mini_tls import TLSClient, TLSServer


def main():
    cert = json.dumps(
        {
            "subject": "CN=mini-tls.example",
            "issuer": "CN=Mini CA",
            "san": ["mini-tls.example", "localhost"],
            "valid_days": 30,
        }
    ).encode()
    client = TLSClient()
    server = TLSServer(cert)

    print("mini-tls demo\n")
    client_hello = client.client_hello()
    print("1.", client_hello["type"], "->", client_hello["cipher_suites"][0])

    server_hello = server.recv_client_hello(client_hello)
    print("2.", server_hello["type"], "certificate subject:", server.cert_info["subject"])

    client_finished = client.recv_server_hello(server_hello)
    print("3.", client_finished["type"], "client verified server cert structure")

    server_finished = server.finish(client_finished)
    client.confirm_server_finished(server_finished)
    print("4. Finished handshake with", server_hello["cipher"])

    msg = b"Hello from client!"
    record = client.encrypt(msg)
    print("5. Encrypted record bytes:", len(record))
    print("6. Server decrypted:", server.decrypt(record).decode())

    reply = server.encrypt(b"Hello back from server!")
    print("7. Client decrypted:", client.decrypt(reply).decode())


if __name__ == "__main__":
    main()
