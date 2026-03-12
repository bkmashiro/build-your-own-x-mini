#!/usr/bin/env python3
"""Demo for mini-db."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from mini_db import MiniDB


def main():
    db = MiniDB()
    print("mini-db demo\n")
    print("1.", db.execute("CREATE TABLE users (id, name, age, city)"))
    for sql in [
        "INSERT INTO users VALUES (1, 'Ada', 36, 'London')",
        "INSERT INTO users VALUES (2, 'Linus', 28, 'Helsinki')",
        "INSERT INTO users VALUES (3, 'Grace', 41, 'New York')",
        "CREATE INDEX idx_users_age ON users (age)",
    ]:
        print("2.", db.execute(sql))

    print("3. where age > 30:", db.execute("SELECT name, city FROM users WHERE age > 30"))
    print("4. indexed age = 28:", db.execute("SELECT * FROM users WHERE age = 28"))
    print("5. compound filter:", db.execute("SELECT name FROM users WHERE city = 'London' OR age < 30"))
    print("6. deleted rows:", db.execute("DELETE FROM users WHERE age < 30"))
    print("7. remaining:", db.execute("SELECT * FROM users"))


if __name__ == "__main__":
    main()
