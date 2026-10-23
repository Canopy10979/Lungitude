"""API consent and unavailable-model checks. No trained model/accuracy claimed."""
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ml'/'skin'))
import service

class SkinServiceTests(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(service.app)
        blob=io.BytesIO();Image.new('RGB',(200,200),'white').save(blob,format='PNG');self.png=blob.getvalue()
    def test_consent_required(self):
        r=self.client.post('/infer',data={'architecture':'mobilenet_v3_small','research':'yes'},files={'image':('test.png',self.png,'image/png')})
        self.assertEqual(r.status_code,422)
    def test_unavailable_checkpoint_has_no_scores(self):
        with patch.object(service,'MODELS',{'mobilenet_v3_small':Path('/no-such-checkpoint/model.pt')}):
            r=self.client.post('/infer',data={'architecture':'mobilenet_v3_small','research':'yes','consent':'yes'},files={'image':('test.png',self.png,'image/png')})
        self.assertEqual(r.status_code,503);self.assertNotIn('scores',r.json())
    def test_research_ack_required(self):
        r=self.client.post('/infer',data={'architecture':'mobilenet_v3_small','consent':'yes'},files={'image':('test.png',self.png,'image/png')})
        self.assertEqual(r.status_code,422)
    def test_unsupported_architecture(self):
        r=self.client.post('/infer',data={'architecture':'fake','consent':'yes','research':'yes'},files={'image':('test.png',self.png,'image/png')})
        self.assertEqual(r.status_code,422)
if __name__=='__main__':unittest.main()
