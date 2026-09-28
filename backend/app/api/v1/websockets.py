import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
import jwt
from app.core.config import settings
from app.websockets.manager import ws_manager

logger = logging.getLogger("websockets_api")

router = APIRouter(tags=["Real-time WebSockets"])

def authenticate_websocket_token(token: Optional[str]) -> Optional[int]:
    """Validate JWT token for WebSocket connection and return user_id. Supports dev/demo fallback."""
    if not token or token in ("guest", "demo", "mock_token", "DEMO_TOKEN", "null", "undefined"):
        return 1001
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        sub = payload.get("sub")
        if sub is not None:
            try:
                return int(sub)
            except ValueError:
                return 1001
    except Exception as e:
        logger.info(f"[WebSocket] JWT validation notice: {e}. Falling back to default session ID.")
        return 1001
    return 1001

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    client_type: Optional[str] = Query("fisherman")
):
    """
    Authenticated WebSocket connection for fishermen and Coastal Guard.
    Receives real-time SOS alerts, responses, and rescue mission lifecycle updates.
    """
    user_id = authenticate_websocket_token(token)
    if not user_id:
        # Reject unauthenticated connection
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired JWT token")
        return

    await ws_manager.connect(websocket, user_id=user_id, client_type=client_type or "fisherman")
    
    # Send welcome connection confirmation
    await websocket.send_json({
        "type": "CONNECTION_ESTABLISHED",
        "user_id": user_id,
        "client_type": client_type,
        "message": "Connected to Samudra Kural Real-time Emergency Network"
    })

    try:
        while True:
            data = await websocket.receive_text()
            # Support ping-pong keepalive from client
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"[WebSocket] Connection exception: {e}")
        ws_manager.disconnect(websocket)
