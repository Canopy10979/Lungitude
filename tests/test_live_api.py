import unittest
import numpy as np
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from backend.app import app

class LiveTests(unittest.TestCase):
    def setUp(self):self.client=TestClient(app)
    def test_origin_denied(self):
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect('/ws/pulse',headers={'origin':'https://untrusted.example'}):pass
    def test_consent_required(self):
        with self.client.websocket_connect('/ws/pulse',headers={'origin':'http://localhost:8000'}) as ws:
            ws.send_json({'samples':[]});self.assertIsNone(ws.receive_json()['bpm'])
    def test_valid_window(self):
        t=np.arange(0,30,.05)
        samples=np.column_stack([t,np.full(len(t),120),110+np.sin(2*np.pi*1.2*t),np.full(len(t),90)]).tolist()
        with self.client.websocket_connect('/ws/pulse',headers={'origin':'http://localhost:8000'}) as ws:
            ws.send_json({'consent':True,'samples':samples});self.assertAlmostEqual(ws.receive_json()['bpm'],72,delta=3)
    def test_large_payload(self):
        with self.client.websocket_connect('/ws/pulse',headers={'origin':'http://localhost:8000'}) as ws:
            ws.send_text(' '*180001)
            with self.assertRaises(WebSocketDisconnect):ws.receive_json()
if __name__=='__main__':unittest.main()
