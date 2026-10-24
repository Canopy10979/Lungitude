"""Verify real website/proxy/session/password roundtrip with a temporary account."""
import argparse,secrets,sys
import requests

p=argparse.ArgumentParser();p.add_argument('--base',default='http://localhost:8000');a=p.parse_args()
base=a.base.rstrip('/')+'/api/account.php'
s=requests.Session();password=secrets.token_urlsafe(24);email='diagnostic-'+secrets.token_hex(10)+'@example.org';csrf=None

def call(action,fields=None):
 r=s.post(base,params={'action':action},data=fields,timeout=20) if fields is not None else s.get(base,params={'action':action},timeout=20)
 if not r.ok:
  print('FAIL:',action,'HTTP',r.status_code)
  if r.status_code==401:print('Session or credentials rejected. Use a single hostname consistently; check Secure cookies are not enabled for HTTP localhost.')
  raise RuntimeError(action)
 return r.json()
try:
 health=call('health');print('PASS: account service reachable through website')
 for name,enabled in health.get('providers_configured',{}).items():print(name+':', 'configured' if enabled else 'requires app-owner configuration')
 d=call('register',{'email':email,'password':password});csrf=d['csrf'];call('me');print('PASS: account creation and cookie persistence')
 call('logout',{'csrf':csrf});csrf=None
 d=call('login',{'email':email,'password':password});csrf=d['csrf'];call('me');print('PASS: password sign-in and session restore')
 call('delete',{'csrf':csrf});csrf=None;print('PASS: temporary diagnostic account deleted')
 print('Email authentication works end-to-end. For your own account, create it first or use its original password; this diagnostic never resets existing accounts.')
except Exception:
 print('Authentication diagnostic failed. No passwords or session tokens were printed. Share the PASS/FAIL lines only.')
 if csrf:
  try:call('delete',{'csrf':csrf});print('Temporary account cleaned up')
  except Exception:print('Temporary diagnostic account cleanup could not be completed')
 sys.exit(1)
