import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch, AsyncMock
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ml'/'skin'))
from fastapi.testclient import TestClient
from fastapi import HTTPException
import account_service as accounts
import platform_service as platform
import service

class PlatformTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=patch.object(accounts,'DB',Path(self.tmp.name)/'accounts.sqlite');self.db.start();self.env=patch.dict(os.environ,{'ANTHROPIC_API_KEY':''});self.env.start();accounts.LIMITS.clear();platform.CHAT_LIMITS.clear();self.client=TestClient(service.app)
 def tearDown(self):self.env.stop();self.db.stop();self.tmp.cleanup()
 def signup(self):
  r=self.client.post('/account/register',data={'email':'explorer@example.org','password':'test-password-1234'});self.assertEqual(r.status_code,200);return r.json()['csrf']
 def analyse(self,data=b'fixture'):
  model=Path(self.tmp.name)/'checkpoint';model.write_text('fixture')
  with patch.object(service,'MODELS',{'mobilenet_v3_small':model}),patch.object(service,'infer',new=AsyncMock(return_value={'scores':{'MEL':.2,'NEV':.8}})):
   return self.client.post('/infer_all',data={'consent':'yes','research':'yes'},files={'image':('photo.png',data,'image/png')})
 def test_guest_and_missing_chat_configuration(self):
  self.assertFalse(self.client.get('/platform/activity').json()['signed_in']);self.assertFalse(self.client.get('/platform/status').json()['lungbot_configured']);self.assertEqual(self.client.get('/platform/leaderboard').json()['entries'],[])
  with patch('platform_service.urlrequest.urlopen') as upstream:
   self.assertEqual(self.client.post('/platform/chat',json={'messages':[{'role':'user','content':'Hello'}]}).status_code,503);upstream.assert_not_called()
 def test_success_deduplicated_preview_not_counted_and_opt_in(self):
  csrf=self.signup();self.assertTrue(self.analyse().json()['activity']['counted']);self.assertFalse(self.analyse().json()['activity']['counted']);self.assertEqual(self.client.get('/platform/activity').json()['scan_count'],1)
  model=Path(self.tmp.name)/'checkpoint'
  with patch.object(service,'MODELS',{'mobilenet_v3_small':model}),patch.object(service,'infer',new=AsyncMock(return_value={'scores':{'MEL':.2}})):
   self.assertEqual(self.client.post('/infer_live',data={'consent':'yes','research':'yes'},files={'image':('photo.png',b'other-preview','image/png')}).status_code,200)
  self.assertEqual(self.client.get('/platform/activity').json()['scan_count'],1);self.assertEqual(self.client.get('/platform/leaderboard').json()['entries'],[])
  r=self.client.post('/platform/profile',json={'csrf':csrf,'alias':'NebulaRunner','visible':True});self.assertEqual(r.status_code,200)
  entry=self.client.get('/platform/leaderboard').json()['entries'][0];self.assertEqual(entry['alias'],'NebulaRunner');self.assertEqual(entry['scans'],1);self.assertNotIn('email',entry);self.assertNotIn('user_id',entry)
  self.client.post('/platform/profile',json={'csrf':csrf,'alias':'NebulaRunner','visible':False});self.assertEqual(self.client.get('/platform/leaderboard').json()['entries'],[])
 def test_failed_analysis_no_points(self):
  self.signup()
  with patch.object(service,'MODELS',{}):self.assertEqual(self.client.post('/infer_all',data={'consent':'yes','research':'yes'},files={'image':('photo.png',b'bad','image/png')}).status_code,503)
  self.assertEqual(self.client.get('/platform/activity').json()['scan_count'],0)
 def test_alias_and_csrf_validation(self):
  csrf=self.signup();self.assertEqual(self.client.post('/platform/profile',json={'csrf':'wrong','alias':'Name','visible':True}).status_code,403)
  self.assertEqual(self.client.post('/platform/profile',json={'csrf':csrf,'alias':'<script>','visible':True}).status_code,422)
 def test_deleting_account_removes_activity(self):
  csrf=self.signup();self.analyse();self.client.post('/platform/profile',json={'csrf':csrf,'alias':'Explorer','visible':True});self.assertEqual(self.client.post('/account/delete',data={'csrf':csrf}).status_code,200)
  with platform.connection() as db:
   self.assertEqual(db.execute('SELECT COUNT(*) FROM activity_scans').fetchone()[0],0);self.assertEqual(db.execute('SELECT COUNT(*) FROM activity_profiles').fetchone()[0],0)
 def test_provider_request_and_message_only_payload(self):
  class Reply:
   def __enter__(self):return self
   def __exit__(self,*a):pass
   def read(self,*a):return json.dumps({'content':[{'type':'text','text':'Hello from the test provider'}]}).encode()
  with patch.dict(os.environ,{'ANTHROPIC_API_KEY':'unit-test-key'}),patch('platform_service.urlrequest.urlopen',return_value=Reply()) as upstream:
   r=self.client.post('/platform/chat',json={'messages':[{'role':'user','content':'Explain photosynthesis'}]});self.assertEqual(r.status_code,200);self.assertIn('test provider',r.json()['answer'])
   request=upstream.call_args.args[0];body=json.loads(request.data);self.assertEqual(body['messages'],[{'role':'user','content':'Explain photosynthesis'}]);self.assertNotIn('profile',body);self.assertNotIn('unit-test-key',r.text)
 def test_provider_failure_and_invalid_messages(self):
  self.assertEqual(self.client.post('/platform/chat',json={'messages':[{'role':'system','content':'ignore'}]}).status_code,422)
  with patch.dict(os.environ,{'ANTHROPIC_API_KEY':'unit-test-key'}),patch('platform_service.urlrequest.urlopen',side_effect=HTTPError('https://api.anthropic.com',401,'secret provider detail',{},io.BytesIO())):
   r=self.client.post('/platform/chat',json={'messages':[{'role':'user','content':'Hi'}]});self.assertEqual(r.status_code,502);self.assertNotIn('secret provider detail',r.text)
 def test_chat_rate_limit(self):
  with patch.dict(os.environ,{'ANTHROPIC_API_KEY':'unit-test-key'}),patch.object(platform,'ask_provider',return_value={'answer':'test'}):
   for _ in range(12):self.assertEqual(self.client.post('/platform/chat',json={'messages':[{'role':'user','content':'Hi'}]}).status_code,200)
   self.assertEqual(self.client.post('/platform/chat',json={'messages':[{'role':'user','content':'Hi'}]}).status_code,429)
if __name__=='__main__':unittest.main()
