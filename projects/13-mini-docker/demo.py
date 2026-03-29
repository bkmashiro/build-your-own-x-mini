import argparse
import sys

from src.mini_docker import MiniDocker


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a command inside mini-docker.")
    parser.add_argument("--name", default="demo")
    parser.add_argument("--memory", default="256M")
    parser.add_argument("--pids", type=int, default=64)
    parser.add_argument("--hostname", default="mini-docker")
    parser.add_argument("--layer", action="append", required=True, help="Rootfs layer directory")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        raise SystemExit("usage: demo.py --layer ROOTFS -- /bin/sh")

    code = MiniDocker().run(
        name=args.name,
        layers=args.layer,
        command=command,
        memory_max=args.memory,
        pids_max=args.pids,
        hostname=args.hostname,
    )
    raise SystemExit(code)


if __name__ == "__main__":
    main()
