import os,sys,unittest
from pathlib import Path
from unittest.mock import patch,Mock
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ml'/'skin'))
import care_service as care
import service

class CareTests(unittest.TestCase):
 def setUp(self):care.LIMITS.clear();self.client=TestClient(service.app)
 def test_consent_and_coordinates_required(self):
  with patch.object(care,'search') as search:
   self.assertEqual(self.client.post('/care/search',data={'latitude':47,'longitude':-122}).status_code,422)
   self.assertEqual(self.client.post('/care/search',data={'latitude':91,'longitude':-122,'consent':'yes'}).status_code,422)
   search.assert_not_called()
 def test_strict_radius_dedup_and_distance_order(self):
  def place(identity,lat):return {'id':identity,'displayName':{'text':'Listing '+identity},'location':{'latitude':lat,'longitude':0}}
  items=[place('outside',.2),place('near',.001),place('far',.01),place('near',.001)]
  result=care.normalize(items,0,0)
  self.assertEqual([p['name'] for p in result],['Listing near','Listing far'])
  self.assertTrue(all(p['meters']<=16093.44 for p in result));self.assertIn('query_place_id=near',result[0]['maps_url'])
 def test_location_bias_is_not_used_as_strict_radius(self):
  response=Mock();response.json.return_value={'places':[{'id':'outside','location':{'latitude':.2,'longitude':0}}]}
  with patch.dict(os.environ,{'GOOGLE_PLACES_KEY':'test-only-key'}),patch.object(care.requests,'post',return_value=response) as post:
   r=self.client.post('/care/search',data={'latitude':0,'longitude':0,'consent':'yes'})
   self.assertEqual(r.status_code,200);self.assertEqual(r.json()['places'],[])
   payload=post.call_args.kwargs['json'];self.assertEqual(payload['textQuery'],'skin cancer centers');self.assertEqual(payload['locationBias']['circle']['radius'],16093.44)
   self.assertNotIn('test-only-key',r.text)
 def test_missing_key_has_no_fake_results(self):
  with patch.dict(os.environ,{'GOOGLE_PLACES_KEY':''}),patch.object(care.requests,'post') as post:
   r=self.client.post('/care/search',data={'latitude':0,'longitude':0,'consent':'yes'})
   self.assertEqual(r.status_code,503);post.assert_not_called();self.assertNotIn('places',r.json())

if __name__=='__main__':unittest.main()
