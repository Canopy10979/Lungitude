import json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ml'/'skin'))
import service,account_service as accounts

class AccountTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.p=patch.object(accounts,'DB',Path(self.tmp.name)/'accounts.sqlite');self.p.start();accounts.LIMITS.clear();self.client=TestClient(service.app)
 def tearDown(self):self.p.stop();self.tmp.cleanup()
 def register(self):
  r=self.client.post('/account/register',data={'email':'demo@example.org','password':'unique-example-123'});self.assertEqual(r.status_code,200);return r.json()['csrf']
 def profile(self,csrf):
  return self.client.post('/account/profile',data={'csrf':csrf,'profile':json.dumps({'age':45,'weight_lb':150,'height_in':68,'zip':'98052','race':'All Races','gender':'Nonbinary','registry_sex':'Male and Female','map_consent':False})})
 def test_profile_requires_login(self):self.assertEqual(self.profile('fake').status_code,401)
 def test_csrf(self):self.register();self.assertEqual(self.profile('fake').status_code,403)
 def test_signup_profile_context_delete(self):
  csrf=self.register();r=self.profile(csrf);self.assertEqual(r.status_code,200);self.assertAlmostEqual(r.json()['profile']['bmi'],22.8,delta=.1)
  with patch.object(accounts,'zip_location',side_effect=AssertionError('No map consent')):
   r=self.client.post('/account/context',data={'csrf':csrf});self.assertEqual(r.status_code,200);self.assertIsNone(r.json()['location']);self.assertEqual(r.json()['matched_group']['SEX'],'Male and Female');self.assertEqual(r.json()['matched_group']['AGE'],'45-49')
  self.assertEqual(self.client.post('/account/delete',data={'csrf':csrf}).status_code,200)
  self.assertEqual(self.client.get('/account/me').status_code,401)
 def test_login_wrong_password(self):
  self.register();self.assertEqual(self.client.post('/account/login',data={'email':'demo@example.org','password':'wrong-password-123'}).status_code,401)
 def test_profile_does_not_change_image_scores(self):
  self.assertNotIn('image_score',accounts.context_for({'age':45,'race':'All Races','registry_sex':'Male and Female'}))
 def test_suppression_not_zero(self):
  source={'source':'test','source_url':'https://example.org','year':2023,'site':'Melanomas of the Skin','unit':'per 100000','rows':[{'AGE':'15-19','RACE':'All Races','SEX':'Male and Female','RATE':None,'COUNT':None,'CI_LOWER':None,'CI_UPPER':None}]}
  with patch('account_service.json.loads',return_value=source):
   d=accounts.context_for({'age':15,'race':'All Races','registry_sex':'Male and Female'});self.assertIsNone(d['rate'])
if __name__=='__main__':unittest.main()
