import os,sys,tempfile,unittest,json
from datetime import datetime,timezone
from pathlib import Path
from unittest.mock import patch,Mock
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'ml'/'skin'))
import service,account_service as accounts,engagement_service as engagement

class EngagementTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=patch.object(accounts,'DB',Path(self.tmp.name)/'accounts.sqlite');self.db.start();accounts.LIMITS.clear();self.client=TestClient(service.app)
  self.csrf=self.client.post('/account/register',data={'email':'private@example.org','password':'unique-password-123'}).json()['csrf']
 def tearDown(self):self.db.stop();self.tmp.cleanup()
 def post(self,action,**fields):return self.client.post('/account/'+action,data={'csrf':self.csrf,**fields})
 def test_points_require_correct_answer_and_cannot_be_farmed(self):
  self.assertEqual(self.post('learn',mission='model_limits',answer='yes').status_code,422)
  for _ in range(3):r=self.post('learn',mission='model_limits',answer='no')
  self.assertEqual(r.json()['points'],10);self.assertEqual(r.json()['completed'],['model_limits'])
  self.assertEqual(self.post('learn',mission='scan_again',answer='yes').status_code,422)
 def test_progress_requires_session_and_updates_require_csrf(self):
  self.assertEqual(TestClient(service.app).get('/account/engagement').status_code,401)
  self.assertEqual(self.post('learn',csrf='bad',mission='model_limits',answer='no').status_code,403)
 def test_leaderboard_optin_alias_only_and_optout(self):
  self.assertEqual(self.client.get('/account/engagement').json()['leaderboard'],[])
  data=self.post('leaderboard',opt_in='yes').json();self.assertTrue(data['listed']);self.assertRegex(data['alias'],r'^Explorer-[A-F0-9]{8}$')
  self.assertEqual(set(data['leaderboard'][0]),{'alias','points'});self.assertNotIn('private@example.org',json.dumps(data));self.assertNotIn('answer',data['missions'][0])
  self.assertEqual(self.post('leaderboard',opt_in='no').json()['leaderboard'],[])
 def test_account_deletion_removes_learning_data(self):
  self.post('learn',mission='model_limits',answer='no');self.post('leaderboard',opt_in='yes');self.post('delete')
  with accounts.connect() as db:
   for table in ['learning_awards','learning_visibility','assistant_usage']:self.assertEqual(db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0],0)
 def test_assistant_requires_explicit_consent(self):
  with patch.object(engagement,'ask_claude') as ask:
   self.assertEqual(self.post('assistant',message='Hello').status_code,422);ask.assert_not_called()
 def test_no_key_does_not_produce_a_fake_answer(self):
  with patch.dict(os.environ,{'ANTHROPIC_API_KEY':''}),patch.object(engagement,'ask_claude') as ask:
   self.assertEqual(self.post('assistant',message='Hello',assistant_consent='yes').status_code,503);ask.assert_not_called()
 def test_request_contains_only_typed_question_and_system(self):
  response=Mock();response.json.return_value={'content':[{'type':'text','text':'Educational fixture response'}],'stop_reason':'end_turn'}
  with patch.dict(os.environ,{'ANTHROPIC_API_KEY':'test-only-key'}),patch.object(engagement.requests,'post',return_value=response) as ask:
   r=self.post('assistant',message='What can this app do?',assistant_consent='yes');self.assertEqual(r.status_code,200)
   payload=ask.call_args.kwargs['json'];self.assertEqual(payload['messages'],[{'role':'user','content':'What can this app do?'}]);self.assertNotIn('private@example.org',json.dumps(payload));self.assertIn('Never diagnose',payload['system']);self.assertEqual(payload['max_tokens'],400);self.assertNotIn('test-only-key',r.text)
 def test_global_budget_is_independent_of_account_deletion(self):
  day=datetime.now(timezone.utc).date().isoformat()
  with accounts.connect() as db:db.execute('INSERT INTO assistant_global_usage VALUES (?,50)',(day,))
  with patch.dict(os.environ,{'ANTHROPIC_API_KEY':'test-only-key'}),patch.object(engagement,'ask_claude') as ask:
   self.assertEqual(self.post('assistant',message='Hello',assistant_consent='yes').status_code,429);ask.assert_not_called()
  self.post('delete')
  with accounts.connect() as db:self.assertEqual(db.execute('SELECT count FROM assistant_global_usage WHERE day=?',(day,)).fetchone()[0],50)
 def test_daily_budget_blocks_before_paid_call(self):
  day=datetime.now(timezone.utc).date().isoformat()
  with accounts.connect() as db:
   uid=db.execute('SELECT id FROM users').fetchone()[0];db.execute('INSERT INTO assistant_usage VALUES (?,?,20,0)',(uid,day))
  with patch.dict(os.environ,{'ANTHROPIC_API_KEY':'test-only-key'}),patch.object(engagement,'ask_claude') as ask:
   self.assertEqual(self.post('assistant',message='Hello',assistant_consent='yes').status_code,429);ask.assert_not_called()

if __name__=='__main__':unittest.main()
