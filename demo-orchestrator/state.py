"""Shared mutable state for the orchestrator. Single in-process instance."""
from typing import Optional


class State:
    def __init__(self):
        self.loop = None                  # the running asyncio loop (set at startup)
        self.roster = []                  # frontend-shaped roster nodes (incl. HUB)
        self.roster_by_id = {}            # node id -> raw roster node (with eth_account_index)
        self.readings = {}                # node id -> {"energy": float, "role": str}
        self.last_price = 10.0
        self.spark_warm = False
        self.ledger = []                  # list of ledger row dicts (newest first)
        self.ledger_total_eth = 0.0
        self.ledger_count = 0
        # trade ids already surfaced as a match (dedupe between the spotlight
        # handler and the Kafka `trades` consumer)
        self.emitted_trades = set()
        # the current narrated trade, set by /demo/spotlight
        self.spotlight: Optional[dict] = None
        self.paused = False               # auto-trader silenced during scripted beats

    def supply_demand(self):
        supply = sum(r["energy"] for r in self.readings.values() if r["role"] == "producer")
        demand = sum(r["energy"] for r in self.readings.values() if r["role"] == "consumer")
        return round(supply, 2), round(demand, 2)


STATE = State()
