#!/usr/bin/env python3
"""
mini-raft: A minimal Raft consensus simulation in pure Python.

Implements:
  - follower / candidate / leader roles
  - randomized election timeouts on a logical clock
  - RequestVote RPC
  - AppendEntries RPC with log repair
  - leader commit and apply to a tiny state machine
"""

from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass
class LogEntry:
    term: int
    command: str


class RaftNode:
    """One node in a deterministic in-memory Raft cluster."""

    def __init__(self, node_id: str, peer_ids: list[str], rng: random.Random):
        self.node_id = node_id
        self.peer_ids = peer_ids
        self.rng = rng
        self.state = "follower"
        self.current_term = 0
        self.voted_for: str | None = None
        self.log: list[LogEntry] = []
        self.commit_index = -1
        self.last_applied = -1
        self.state_machine: list[str] = []
        self.leader_id: str | None = None
        self.votes_received: set[str] = set()
        self.next_index: dict[str, int] = {}
        self.match_index: dict[str, int] = {}
        self.reset_election_timeout()
        self.election_deadline = self.election_timeout

    def reset_election_timeout(self):
        self.election_timeout = self.rng.randint(5, 8)

    def tick(self, cluster: "RaftCluster"):
        if self.state == "leader":
            self.broadcast_append_entries(cluster)
            return
        self.election_deadline -= 1
        if self.election_deadline <= 0:
            self.start_election(cluster)

    def start_election(self, cluster: "RaftCluster"):
        self.state = "candidate"
        self.current_term += 1
        self.voted_for = self.node_id
        self.votes_received = {self.node_id}
        self.leader_id = None
        self.reset_election_timeout()
        self.election_deadline = self.election_timeout
        last_index, last_term = self.last_log_info()
        for peer_id in self.peer_ids:
            vote_granted, peer_term = cluster.request_vote(
                candidate_id=self.node_id,
                target_id=peer_id,
                term=self.current_term,
                last_log_index=last_index,
                last_log_term=last_term,
            )
            if peer_term > self.current_term:
                self.become_follower(peer_term, None)
                return
            if vote_granted:
                self.votes_received.add(peer_id)
        if len(self.votes_received) >= cluster.majority:
            self.become_leader()

    def become_follower(self, term: int, leader_id: str | None):
        self.state = "follower"
        self.current_term = term
        self.voted_for = None
        self.votes_received.clear()
        self.leader_id = leader_id
        self.reset_election_timeout()
        self.election_deadline = self.election_timeout

    def become_leader(self):
        self.state = "leader"
        self.leader_id = self.node_id
        self.next_index = {peer_id: len(self.log) for peer_id in self.peer_ids}
        self.match_index = {peer_id: -1 for peer_id in self.peer_ids}

    def last_log_info(self) -> tuple[int, int]:
        if not self.log:
            return -1, 0
        return len(self.log) - 1, self.log[-1].term

    def on_request_vote(
        self,
        term: int,
        candidate_id: str,
        last_log_index: int,
        last_log_term: int,
    ) -> tuple[bool, int]:
        if term < self.current_term:
            return False, self.current_term
        if term > self.current_term:
            self.become_follower(term, None)
        up_to_date = (last_log_term, last_log_index) >= self.last_log_info()[::-1]
        can_vote = self.voted_for in (None, candidate_id)
        if can_vote and up_to_date:
            self.voted_for = candidate_id
            self.leader_id = None
            self.reset_election_timeout()
            self.election_deadline = self.election_timeout
            return True, self.current_term
        return False, self.current_term

    def on_append_entries(
        self,
        term: int,
        leader_id: str,
        prev_log_index: int,
        prev_log_term: int,
        entries: list[LogEntry],
        leader_commit: int,
    ) -> tuple[bool, int]:
        if term < self.current_term:
            return False, self.current_term
        if term > self.current_term or self.state != "follower":
            self.become_follower(term, leader_id)
        self.leader_id = leader_id
        self.election_deadline = self.election_timeout
        if prev_log_index >= 0:
            if prev_log_index >= len(self.log):
                return False, self.current_term
            if self.log[prev_log_index].term != prev_log_term:
                self.log = self.log[:prev_log_index]
                if self.commit_index >= len(self.log):
                    self.commit_index = len(self.log) - 1
                return False, self.current_term
        insert_at = prev_log_index + 1
        for offset, entry in enumerate(entries):
            index = insert_at + offset
            if index < len(self.log) and self.log[index].term != entry.term:
                self.log = self.log[:index]
            if index >= len(self.log):
                self.log.append(entry)
        self.commit_index = min(leader_commit, len(self.log) - 1)
        self.apply_entries()
        return True, self.current_term

    def propose(self, cluster: "RaftCluster", command: str) -> bool:
        if self.state != "leader":
            return False
        self.log.append(LogEntry(self.current_term, command))
        self.match_index[self.node_id] = len(self.log) - 1
        self.broadcast_append_entries(cluster)
        self.advance_commit_index(cluster)
        self.apply_entries()
        self.broadcast_append_entries(cluster)
        return self.commit_index == len(self.log) - 1

    def broadcast_append_entries(self, cluster: "RaftCluster"):
        if self.state != "leader":
            return
        self.match_index[self.node_id] = len(self.log) - 1
        for peer_id in self.peer_ids:
            while True:
                next_index = self.next_index.get(peer_id, len(self.log))
                prev_index = next_index - 1
                prev_term = self.log[prev_index].term if prev_index >= 0 else 0
                entries = self.log[next_index:]
                ok, peer_term = cluster.append_entries(
                    leader_id=self.node_id,
                    target_id=peer_id,
                    term=self.current_term,
                    prev_log_index=prev_index,
                    prev_log_term=prev_term,
                    entries=entries,
                    leader_commit=self.commit_index,
                )
                if peer_term > self.current_term:
                    self.become_follower(peer_term, None)
                    return
                if ok:
                    self.next_index[peer_id] = len(self.log)
                    self.match_index[peer_id] = len(self.log) - 1
                    break
                self.next_index[peer_id] = max(0, next_index - 1)
                if next_index == 0:
                    break

    def advance_commit_index(self, cluster: "RaftCluster"):
        if self.state != "leader":
            return
        for index in range(len(self.log) - 1, self.commit_index, -1):
            if self.log[index].term != self.current_term:
                continue
            replicated = 1
            for peer_id in self.peer_ids:
                if self.match_index.get(peer_id, -1) >= index:
                    replicated += 1
            if replicated >= cluster.majority:
                self.commit_index = index
                break

    def apply_entries(self):
        while self.last_applied < self.commit_index:
            self.last_applied += 1
            self.state_machine.append(self.log[self.last_applied].command)


class RaftCluster:
    """Logical network that delivers RPCs between nodes."""

    def __init__(self, node_ids: list[str], seed: int = 7):
        self.rng = random.Random(seed)
        self.nodes = {
            node_id: RaftNode(node_id, [peer for peer in node_ids if peer != node_id], self.rng)
            for node_id in node_ids
        }
        self.blocked: set[tuple[str, str]] = set()

    @property
    def majority(self) -> int:
        return len(self.nodes) // 2 + 1

    def tick(self, rounds: int = 1):
        for _ in range(rounds):
            for node in sorted(self.nodes.values(), key=lambda item: item.node_id):
                node.tick(self)

    def request_vote(
        self,
        candidate_id: str,
        target_id: str,
        term: int,
        last_log_index: int,
        last_log_term: int,
    ) -> tuple[bool, int]:
        if (candidate_id, target_id) in self.blocked:
            candidate = self.nodes[candidate_id]
            return False, candidate.current_term
        return self.nodes[target_id].on_request_vote(term, candidate_id, last_log_index, last_log_term)

    def append_entries(
        self,
        leader_id: str,
        target_id: str,
        term: int,
        prev_log_index: int,
        prev_log_term: int,
        entries: list[LogEntry],
        leader_commit: int,
    ) -> tuple[bool, int]:
        if (leader_id, target_id) in self.blocked:
            leader = self.nodes[leader_id]
            return False, leader.current_term
        return self.nodes[target_id].on_append_entries(
            term,
            leader_id,
            prev_log_index,
            prev_log_term,
            entries,
            leader_commit,
        )

    def leader(self) -> RaftNode | None:
        leaders = [node for node in self.nodes.values() if node.state == "leader"]
        return leaders[0] if len(leaders) == 1 else None

    def isolate(self, source_id: str, target_id: str):
        self.blocked.add((source_id, target_id))

    def heal(self, source_id: str, target_id: str):
        self.blocked.discard((source_id, target_id))


if __name__ == "__main__":
    cluster = RaftCluster(["n1", "n2", "n3"])
    cluster.tick(10)
    leader = cluster.leader()
    if leader:
        print(f"leader={leader.node_id} term={leader.current_term}")
        leader.propose(cluster, "set x 1")
        leader.propose(cluster, "set y 2")
    for node in cluster.nodes.values():
        print(node.node_id, node.state, node.log, node.state_machine)
