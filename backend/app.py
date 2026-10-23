"""Local prototype endpoint. Explicit consent, origin allowlist, bounded payloads.
Production needs TLS, session authentication, distributed limits and load tests.
"""
import asyncio
import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from backend.signal import estimate

app = FastAPI(title='Lungitude signal research')
ORIGINS = set(os.getenv('LUNGITUDE_ORIGINS', 'http://localhost:8000,http://127.0.0.1:8000').split(','))
LIMIT = 4
active = 0

@app.get('/health')
def health():
    return {'status':'ok', 'research_only':True, 'max_sessions_per_process':LIMIT, 'clinical_validation':False}

@app.websocket('/ws/pulse')
async def pulse(socket: WebSocket):
    global active
    if socket.headers.get('origin') not in ORIGINS or active >= LIMIT:
        await socket.close(code=1008); return
    active += 1
    await socket.accept()
    try:
        # One bounded window per connection: no accumulating frame backlog.
        raw = await asyncio.wait_for(socket.receive_text(), timeout=100)
        if len(raw.encode()) > 180_000:
            await socket.close(code=1009); return
        payload = json.loads(raw)
        if not isinstance(payload, dict) or payload.get('consent') is not True:
            raise ValueError('Explicit consent required')
        result = await asyncio.to_thread(estimate, payload.get('samples', []))
        await socket.send_json(result)
    except (ValueError, TypeError, KeyError):
        await socket.send_json({'error':'Invalid input or consent', 'bpm':None})
    except asyncio.TimeoutError:
        await socket.close(code=1008); return
    except WebSocketDisconnect:
        return
    finally:
        active -= 1
    await socket.close()
