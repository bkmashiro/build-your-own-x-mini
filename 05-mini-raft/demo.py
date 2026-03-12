#!/usr/bin/env python3
"""Runnable demo for mini-raft."""

from mini_raft import RaftCluster


def check(desc: str, ok: bool):
    print(f"  {'✓' if ok else '✗'} {desc}")
    return int(ok)


def main():
    cluster = RaftCluster(["n1", "n2", "n3"], seed=3)
    passed = 0
    total = 0

    print("\nmini-raft demo\n")

    cluster.tick(10)
    leader = cluster.leader()
    total += 2
    passed += check("elects exactly one leader", leader is not None)
    passed += check("leader knows itself", leader is not None and leader.leader_id == leader.node_id)

    assert leader is not None
    followers = [node_id for node_id in cluster.nodes if node_id != leader.node_id]
    lagging = followers[0]

    cluster.isolate(leader.node_id, lagging)
    total += 2
    passed += check("leader commits with majority", leader.propose(cluster, "set a 1"))
    passed += check(
        "isolated follower has not received entry yet",
        cluster.nodes[lagging].state_machine == [],
    )

    cluster.heal(leader.node_id, lagging)
    cluster.tick(2)
    total += 4
    passed += check(
        "healed follower catches up",
        cluster.nodes[lagging].state_machine == ["set a 1"],
    )
    passed += check("second command commits", leader.propose(cluster, "set b 2"))
    passed += check(
        "all state machines match",
        len({tuple(node.state_machine) for node in cluster.nodes.values()}) == 1,
    )
    passed += check(
        "log has two committed commands",
        tuple(leader.state_machine) == ("set a 1", "set b 2"),
    )

    print(f"\n{passed}/{total} checks passed")


if __name__ == "__main__":
    main()
