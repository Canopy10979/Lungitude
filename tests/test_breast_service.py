import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import joblib
import pandas as pd
from sklearn.dummy import DummyClassifier
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ml'/'skin'))
import service
import breast_service

class BreastTests(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(service.app)
        self.values={k:1.0 for k in breast_service.BREAST_FEATURES}
    def send(self,values,**extra):
        return self.client.post('/breast/infer',data={'measurements':json.dumps(values),'consent':'yes','research':'yes',**extra})
    def test_no_consent(self):self.assertEqual(self.send(self.values,consent='').status_code,422)
    def test_partial_record_rejected(self):self.assertEqual(self.send({'radius_mean':1}).status_code,422)
    def test_no_camera_payload(self):self.assertEqual(self.send({'image':'photo'}).status_code,422)
    def test_nonfinite_rejected(self):
        self.values['radius_mean']=float('nan');self.assertEqual(self.send(self.values).status_code,422)
    def test_missing_checkpoint(self):
        with tempfile.TemporaryDirectory() as d,patch.object(breast_service,'ROOT',Path(d)):
            self.assertEqual(self.send(self.values).status_code,503)
    def test_trusted_checkpoint_route(self):
        # Synthetic estimator checks wiring only, not medical accuracy.
        with tempfile.TemporaryDirectory() as d,patch.object(breast_service,'ROOT',Path(d)):
            frame=pd.DataFrame([self.values]);model=DummyClassifier(strategy='constant',constant=1).fit(frame,[1])
            joblib.dump({'pipeline':model,'features':breast_service.BREAST_FEATURES,'research_only':True},Path(d)/'model.joblib')
            (Path(d)/'evaluation.json').write_text('{}')
            response=self.send(self.values)
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['predicted_dataset_class'],'malignant')
            self.assertNotIn('probability',response.json())
if __name__=='__main__':unittest.main()
