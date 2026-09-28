import json
import logging
from typing import Dict, Set, List, Optional, Any
from fastapi import WebSocket

logger = logging.getLogger("websockets")


class ConnectionManager:
    """
    Manages real-time WebSocket connections for fishermen and Coastal Guard clients.
    Supports targeted recipient delivery, Coastal Guard HQ broadcasts, and reconnection cleanup.
    """
    def __init__(self):
        # Maps user_id -> set of active WebSockets (supports multiple tabs / devices per user)
        self.active_user_connections: Dict[int, Set[WebSocket]] = {}
        # Set of Coastal Guard officer WebSockets
        self.coastal_guard_connections: Set[WebSocket] = set()
        # Maps WebSocket -> (user_id, client_type) for O(1) disconnect cleanup
        self.socket_metadata: Dict[WebSocket, Dict[str, Any]] = {}

    @property
    def active_connections(self) -> Dict[int, Set[WebSocket]]:
        return self.active_user_connections

    async def connect(
        self,
        websocket: WebSocket,
        user_id: int,
        client_type: str = "fisherman",
        is_coastal_guard: bool = False,
    ):
        if hasattr(websocket, "accept"):
            try:
                await websocket.accept()
            except Exception:
                pass

        if is_coastal_guard:
            client_type = "coastal_guard"

        if user_id not in self.active_user_connections:
            self.active_user_connections[user_id] = set()
        self.active_user_connections[user_id].add(websocket)

        if client_type == "coastal_guard" or is_coastal_guard:
            self.coastal_guard_connections.add(websocket)

        self.socket_metadata[websocket] = {
            "user_id": user_id,
            "client_type": client_type,
        }
        logger.info(
            f"[WebSocket] User {user_id} ({client_type}) connected. Total users: {len(self.active_user_connections)}"
        )

    def disconnect(self, websocket: WebSocket, user_id: Optional[int] = None):
        meta = self.socket_metadata.pop(websocket, None)
        uid = meta.get("user_id") if meta else user_id
        client_type = meta.get("client_type") if meta else None

        if uid is not None and uid in self.active_user_connections:
            self.active_user_connections[uid].discard(websocket)
            if not self.active_user_connections[uid]:
                del self.active_user_connections[uid]

        self.coastal_guard_connections.discard(websocket)
        logger.info(f"[WebSocket] Socket for user {uid} disconnected.")

    def _normalize_message(self, arg1: Any, arg2: Optional[Any] = None) -> dict:
        """
        Accepts either:
        - (message: dict)
        - (event: str, payload: dict)
        """
        if isinstance(arg1, str):
            return {"event": arg1, "payload": arg2 or {}}
        elif isinstance(arg1, dict):
            return arg1
        return {"event": str(arg1), "payload": arg2 or {}}

    async def send_to_user(self, user_id: int, event_or_message: Any, payload: Optional[Any] = None):
        """Send event to all active sockets belonging to a specific user."""
        message = self._normalize_message(event_or_message, payload)
        sockets = self.active_user_connections.get(user_id, set()).copy()
        dead_sockets = []
        for ws in sockets:
            try:
                await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"[WebSocket] Error sending to user {user_id}: {e}")
                dead_sockets.append(ws)
        for ws in dead_sockets:
            self.disconnect(ws)

    async def send_to_users(self, user_ids: List[int], event_or_message: Any, payload: Optional[Any] = None):
        """Send event to a list of target users (e.g. nearby fishermen)."""
        message = self._normalize_message(event_or_message, payload)
        for uid in user_ids:
            await self.send_to_user(uid, message)

    async def broadcast_to_coastal_guard(self, event_or_message: Any, payload: Optional[Any] = None):
        """Broadcast emergency event to all connected Coastal Guard Command Center clients."""
        message = self._normalize_message(event_or_message, payload)
        dead_sockets = []
        for ws in self.coastal_guard_connections.copy():
            try:
                await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"[WebSocket] Error broadcasting to Coastal Guard: {e}")
                dead_sockets.append(ws)
        for ws in dead_sockets:
            self.disconnect(ws)

    async def broadcast_all(self, event_or_message: Any, payload: Optional[Any] = None):
        """Broadcast message to all connected clients."""
        message = self._normalize_message(event_or_message, payload)
        for user_id in list(self.active_user_connections.keys()):
            await self.send_to_user(user_id, message)


ws_manager = ConnectionManager()
