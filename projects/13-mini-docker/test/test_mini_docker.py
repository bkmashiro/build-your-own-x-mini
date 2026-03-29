import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from mini_docker import MiniDocker


def test_overlay_options_reverses_layers_for_overlayfs(tmp_path):
    docker = MiniDocker(work_root=str(tmp_path), cgroup_root=str(tmp_path / "cg"))
    layers = [str(tmp_path / "base"), str(tmp_path / "app")]
    options = docker.overlay_options(layers, tmp_path / "upper", tmp_path / "work")
    assert "lowerdir=" in options
    assert f"{(tmp_path / 'app').resolve()}:{(tmp_path / 'base').resolve()}" in options


def test_create_cgroup_writes_limits(tmp_path):
    cgroup_root = tmp_path / "cg"
    docker = MiniDocker(work_root=str(tmp_path), cgroup_root=str(cgroup_root))
    group = docker.create_cgroup("demo", "128M", 32)
    assert (group / "memory.max").read_text() == "128M\n"
    assert (group / "pids.max").read_text() == "32\n"


def test_validate_host_requires_linux(monkeypatch, tmp_path):
    docker = MiniDocker(work_root=str(tmp_path), cgroup_root=str(tmp_path / "cg"))
    monkeypatch.setattr(sys, "platform", "darwin")
    with pytest.raises(RuntimeError, match="requires Linux"):
        docker.validate_host()


def test_run_requires_command_and_layer(tmp_path, monkeypatch):
    docker = MiniDocker(work_root=str(tmp_path), cgroup_root=str(tmp_path / "cg"))
    monkeypatch.setattr(docker, "validate_host", lambda: None)
    with pytest.raises(ValueError, match="layer"):
        docker.run(name="demo", layers=[], command=["/bin/sh"])
    with pytest.raises(ValueError, match="command"):
        docker.run(name="demo", layers=["/rootfs"], command=[])
