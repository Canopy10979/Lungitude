"""Real PHP stream transport, mocked upstream. Never evaluates a medical model."""
import hashlib
import json
import shutil
import socket
import subprocess
import threading
import time
import unittest
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import requests

@unittest.skipUnless(shutil.which('php'),'PHP runtime not installed')
class ImagingProxyTests(unittest.TestCase):
 def test_curl_free_status_multipart_and_safe_errors(self):
  received={}
  class Upstream(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def send(self,data,status=200):
    body=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
   def do_GET(self):self.send({'models':{'test_fixture':{'checkpoint_present':True}}})
   def do_POST(self):
    raw=self.rfile.read(int(self.headers['Content-Length']))
    message=BytesParser(policy=default).parsebytes(('Content-Type: '+self.headers['Content-Type']+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+raw)
    for part in message.iter_parts():received[part.get_param('name',header='content-disposition')]=part.get_payload(decode=True)
    self.send({'detail':'private/path/port8010'},503)
  try:upstream=ThreadingHTTPServer(('127.0.0.1',8010),Upstream)
  except OSError:self.skipTest('Fixed upstream port already in use')
  thread=threading.Thread(target=upstream.serve_forever,daemon=True);thread.start()
  with socket.socket() as probe:probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
  root=Path(__file__).resolve().parents[1]
  process=subprocess.Popen(['php','-n','-d','allow_url_fopen=1','-S',f'127.0.0.1:{port}','router.php'],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  url=f'http://127.0.0.1:{port}/api/imaging.php'
  try:
   for _ in range(100):
    try:r=requests.get(url,params={'action':'status'},timeout=.3);break
    except requests.RequestException:time.sleep(.05)
   else:self.fail('PHP server did not start')
   self.assertEqual(r.status_code,200);self.assertTrue(r.json()['models']['test_fixture']['checkpoint_present'])
   blob=b'\x89PNG\r\n\x1a\ntransport-test-\x00\xff\r\nbinary'
   r=requests.post(url,params={'action':'infer_all'},data={'consent':'yes','research':'yes'},files={'image':('photo.png',blob,'image/png')},timeout=5)
   self.assertEqual(received['image'],blob);self.assertEqual(received['consent'],b'yes');self.assertEqual(received['research'],b'yes')
   self.assertEqual(r.status_code,503);self.assertNotIn('private',r.text);self.assertNotIn('8010',r.text)
  finally:
   process.terminate();process.wait(timeout=5);upstream.shutdown();upstream.server_close();thread.join(timeout=5)

if __name__=='__main__':unittest.main()
