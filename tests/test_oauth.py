import os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ml'/'skin'))
import service,account_service as accounts

class OAuthTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=patch.object(accounts,'DB',Path(self.tmp.name)/'accounts.sqlite');self.db.start();self.env=patch.dict(os.environ,{'GOOGLE_WEB_CLIENT_ID':'test.apps.googleusercontent.com','APPLE_SERVICES_ID':'','APPLE_REDIRECT_URI':''});self.env.start();accounts.LIMITS.clear();self.client=TestClient(service.app)
 def tearDown(self):self.env.stop();self.db.stop();self.tmp.cleanup()
 def begin(self):return self.client.get('/account/oauth/config').json()
 def complete(self,c,**fields):return self.client.post('/account/oauth',data={'provider':'google','credential':'test-token','state':c['state'],**fields})
 def test_health(self):self.assertEqual(self.client.get('/account/health').json()['ready'],True)
 def test_blank_legacy_env_uses_project_client(self):
  with patch.dict(os.environ,{'GOOGLE_WEB_CLIENT_ID':'','LUNGITUDE_GOOGLE_SIGNIN':'1'}):
   config=self.begin();self.assertTrue(config['providers']['google']['enabled']);self.assertEqual(config['providers']['google']['client_id'],accounts.DEFAULT_GOOGLE_WEB_CLIENT_ID);self.assertIn('state',config)
 def test_provider_explicitly_disabled_hidden(self):
  with patch.dict(os.environ,{'GOOGLE_WEB_CLIENT_ID':'','LUNGITUDE_GOOGLE_SIGNIN':'0'}):self.assertFalse(self.begin()['providers']['google']['enabled'])
 def test_state_rejected_before_verification(self):
  c=self.begin()
  with patch.object(accounts,'verify_identity') as verify:
   self.assertEqual(self.complete(c,state='wrong').status_code,403);verify.assert_not_called()
 def test_identity_replay_blocked(self):
  c=self.begin()
  with patch.object(accounts,'verify_identity',return_value={'sub':'provider-id','email':'person@example.org','email_verified':True}):
   r=self.complete(c);self.assertEqual(r.status_code,200);self.assertTrue(r.json()['signed_in']);self.assertEqual(self.complete(c).status_code,403)
 def test_no_automatic_email_link(self):
  self.client.post('/account/register',data={'email':'person@example.org','password':'unique-password-123'})
  c=self.begin()
  with patch.object(accounts,'verify_identity',return_value={'sub':'provider-id','email':'person@example.org','email_verified':True}):self.assertEqual(self.complete(c).status_code,409)
 def test_failed_signature_denies_login(self):
  c=self.begin()
  with patch.object(accounts,'verify_identity',side_effect=ValueError('invalid JWT')):self.assertEqual(self.complete(c).status_code,401)
 def test_provider_only_password_login_cleanly_rejected(self):
  c=self.begin()
  with patch.object(accounts,'verify_identity',return_value={'sub':'provider-id','email':'person@example.org','email_verified':True}):self.assertEqual(self.complete(c).status_code,200)
  r=self.client.post('/account/login',data={'email':'person@example.org','password':'guess-password-123'});self.assertEqual(r.status_code,401)
 def test_apple_localhost_disabled(self):
  with patch.dict(os.environ,{'APPLE_SERVICES_ID':'com.example.app','APPLE_REDIRECT_URI':'http://localhost:8000/'}):self.assertFalse(self.begin()['providers']['apple']['enabled'])
 def test_server_nonce_checked(self):
  with patch('google.oauth2.id_token.verify_oauth2_token',return_value={'sub':'provider-id','nonce':'wrong'}):
   with self.assertRaises(ValueError):accounts.verify_identity('google','token','aud','expected')

if __name__=='__main__':unittest.main()
