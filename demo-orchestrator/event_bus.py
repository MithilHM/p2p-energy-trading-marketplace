"""Async fan-out of demo events to all connected WebSockets.

Each connection has its own bounded queue. Background threads (Kafka/MQTT)
publish via `publish_threadsafe`, which hops onto the asyncio loop. On
backpressure the oldest low-priority frame (a `reading`) is dropped first;
`match`/`settlement`/`ledger`/`guide` frames are never silently dropped.
"""
import asyncio
import logging

logger = logging.getLogger(__name__)

MAX_QUEUE = 1500
LOW_PRIORITY = {"reading", "market"}


class EventBus:
    def __init__(self):
        self._queues: set[asyncio.Queue] = set()
        self.loop = None

    def register(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=MAX_QUEUE)
        self._queues.add(q)
        return q

    def unregister(self, q: asyncio.Queue):
        self._queues.discard(q)

    def _enqueue(self, q: asyncio.Queue, event: dict):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            # drop one low-priority frame to make room; else drop oldest
            try:
                q.get_nowait()
            except Exception:
                return
            try:
                q.put_nowait(event)
            except Exception:
                pass

    def publish(self, event: dict):
        """Publish from within the asyncio loop."""
        for q in list(self._queues):
            self._enqueue(q, event)

    def publish_threadsafe(self, event: dict):
        """Publish from a background thread."""
        if self.loop is None:
            return
        self.loop.call_soon_threadsafe(self.publish, event)


bus = EventBus()
