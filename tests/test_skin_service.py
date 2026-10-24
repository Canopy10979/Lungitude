"""API consent and unavailable-model checks. No trained model/accuracy claimed."""
import io
import tempfile
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


class AllModelTests(unittest.TestCase):
    def test_no_model_has_no_probabilities(self):
        client=TestClient(service.app)
        with patch.object(service,'MODELS',{'mobilenet_v3_small':Path('/missing/model.pt')}):
            r=client.post('/infer_all',data={'research':'yes','consent':'yes'},files={'image':('test.png',b'none','image/png')})
        self.assertEqual(r.status_code,503)
        self.assertNotIn('models',r.json())

    def test_runs_available_models_and_reports_missing(self):
        from unittest.mock import AsyncMock
        with tempfile.TemporaryDirectory() as d:
            existing=Path(d)/'model.pt';existing.write_bytes(b'fixture')
            with patch.object(service,'MODELS',{'mobilenet_v3_small':existing,'vit_b_16':existing,'efficientnet_b0':Path('/missing/model.pt')}),patch.object(service,'infer',new_callable=AsyncMock) as run:
                run.return_value={'scores':{'BCC':.7,'NEV':.3}}
                r=TestClient(service.app).post('/infer_all',data={'research':'yes','consent':'yes'},files={'image':('test.png',b'fixture','image/png')})
                self.assertEqual(r.status_code,200);self.assertEqual(run.await_count,2)
                models=r.json()['models'];self.assertIsNone(models['efficientnet_b0']['probabilities'])
                self.assertEqual(models['mobilenet_v3_small']['calibration'],'uncalibrated')
