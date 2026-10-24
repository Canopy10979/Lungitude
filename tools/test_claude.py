"""Small billable Claude connectivity test; sends only a fixed OK prompt."""
import os
import sys
from pathlib import Path
import requests
from dotenv import load_dotenv


def main():
 load_dotenv(Path(__file__).resolve().parents[1]/'.env',override=False)
 key=os.getenv('ANTHROPIC_API_KEY','').strip()
 if not key:print('Missing ANTHROPIC_API_KEY. Run scripts/Set-ClaudeKey.ps1 locally.');return 1
 try:
  r=requests.post('https://api.anthropic.com/v1/messages',headers={'x-api-key':key,'anthropic-version':'2026-10-21','content-type':'application/json'},json={'model':'claude-opus-5-5','max_tokens':128,'messages':[{'role':'user','content':'Reply with only OK.'}]},timeout=45)
  data=r.json()
  if not r.ok:
   error=data.get('error',{});print('API test HTTP:',r.status_code);print('Error:',str(error.get('message','Request rejected')).replace(key,'[redacted]'));return 1
  print('PASS: Claude API HTTP',r.status_code)
  print('Response:',' '.join(b.get('text','') for b in data.get('content',[]) if b.get('type')=='text'))
  usage=data.get('usage',{});print('Tokens:',usage.get('input_tokens'), 'input,',usage.get('output_tokens'),'output')
  print('Connectivity test only; Claude is not integrated into the app UI.')
  return 0
 except (requests.RequestException,ValueError):print('API connection/response failed. Check your connection; no credentials were printed.');return 1

if __name__=='__main__':sys.exit(main())
