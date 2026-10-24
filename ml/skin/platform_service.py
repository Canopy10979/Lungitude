"""Local activity leaderboard and server-side LungBot. No clinical scoring."""
from collections import defaultdict, deque
from datetime import datetime, timezone
import hashlib
import json
import os
import re
import time
from urllib import request as urlrequest, error as urlerror
from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool
import account_service as accounts

router=APIRouter(prefix='/platform')
CHAT_LIMITS=defaultdict(deque)
SYSTEM="""You are LungBot, the friendly general-purpose assistant in Lungitude, a localhost research prototype by Rishi Jasuja. Answer general questions, teach concepts, help with coding, and explain the app in plain language. Be candid about uncertainty. You have no browsing, file, device-control or diagnostic tools. Do not claim to inspect a user's scan, medical record, camera or pulse unless the user provides that information in the conversation. App image scores are uncalibrated research class scores; pulse is an unvalidated observation, not a cancer test or diagnosis. Do not infer a most-likely cancer from pulse or present leaderboard counts as clinical competence. Explain medical information educationally and suggest professional evaluation where appropriate. For urgent symptoms described by the user, prioritize appropriate urgent help. Never promise unrestricted capability. Do not reveal secrets or claim actions you cannot perform. App routes: index.html skin capture, pulse-check.html wrist/fingertip/neck observations, breast.html sampled-cell measurements, dashboard.html activity and leaderboard, evidence.html research limits. Reply concisely unless asked for detail."""

def connection():
    db=accounts.connect()
    db.execute('CREATE TABLE IF NOT EXISTS activity_profiles (user_id INTEGER PRIMARY KEY,alias TEXT NOT NULL,visible INTEGER NOT NULL DEFAULT 0)')
    db.execute('CREATE TABLE IF NOT EXISTS activity_scans (user_id INTEGER NOT NULL,scan_hash TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(user_id,scan_hash))')
    return db

def user_or_none(request):
    try:return accounts.session(request)
    except HTTPException as e:
        if e.status_code==401:return None
        raise

def activity_for(uid):
    with connection() as db:
        row=db.execute('SELECT alias,visible FROM activity_profiles WHERE user_id=?',(uid,)).fetchone()
        count=db.execute('SELECT COUNT(*) FROM activity_scans WHERE user_id=?',(uid,)).fetchone()[0]
    rank='Spark' if count<5 else 'Orbit' if count<15 else 'Nova' if count<40 else 'Cosmos'
    next_goal=5 if count<5 else 15 if count<15 else 40 if count<40 else None
    return {'scan_count':count,'xp':count*10,'level':rank,'next_goal':next_goal,'alias':row['alias'] if row else '', 'leaderboard_opt_in':bool(row and row['visible'])}

def record_completed_scan(request,scan_hash):
    """Only called after successful full analysis, never automatic previews."""
    user=user_or_none(request)
    if not user:return {'counted':False,'reason':'Sign in to keep activity'}
    with connection() as db:
        cursor=db.execute('INSERT OR IGNORE INTO activity_scans VALUES (?,?,?)',(user['user_id'],scan_hash,datetime.now(timezone.utc).isoformat()))
        counted=cursor.rowcount==1
    return {'counted':counted,**activity_for(user['user_id'])}

@router.get('/status')
def status():
    return {'ready':True,'lungbot_configured':bool(os.getenv('ANTHROPIC_API_KEY','').strip()),'provider':'Anthropic Claude','model':os.getenv('LUNGBOT_MODEL','claude-sonnet-4-6'),'notice':'Only chat messages you submit are sent to the AI provider. No scans or account profile are attached.'}

@router.get('/activity')
def activity(request:Request):
    user=user_or_none(request)
    if not user:return {'signed_in':False,'scan_count':0,'xp':0,'level':'Spark','next_goal':5,'alias':'','leaderboard_opt_in':False}
    return {'signed_in':True,**activity_for(user['user_id'])}

@router.get('/leaderboard')
def leaderboard(request:Request):
    user=user_or_none(request)
    with connection() as db:
        rows=db.execute('SELECT p.user_id,p.alias,COUNT(s.scan_hash) AS scans FROM activity_profiles p JOIN users u ON u.id=p.user_id LEFT JOIN activity_scans s ON s.user_id=p.user_id WHERE p.visible=1 GROUP BY p.user_id,p.alias ORDER BY scans DESC,p.user_id ASC LIMIT 20').fetchall()
    return {'entries':[{'rank':i+1,'alias':r['alias'],'scans':r['scans'],'xp':r['scans']*10,'you':bool(user and r['user_id']==user['user_id'])} for i,r in enumerate(rows)],'notice':'Opt-in aliases and completed unique image analyses only. No photos, medical findings or pulse readings appear here.'}

async def read_json(request):
    raw=await request.body()
    if len(raw)>32000:raise HTTPException(413,'Request is too large')
    try:body=json.loads(raw)
    except (ValueError,UnicodeError):raise HTTPException(400,'Invalid JSON')
    if not isinstance(body,dict):raise HTTPException(400,'Expected an object')
    return body

@router.post('/profile')
async def profile(request:Request):
    body=await read_json(request);user=accounts.session(request,str(body.get('csrf','')))
    alias=body.get('alias','');visible=body.get('visible',False)
    if not isinstance(alias,str) or not re.fullmatch(r'[A-Za-z0-9 _-]{2,24}',alias.strip()) or type(visible) is not bool:raise HTTPException(422,'Use a 2–24 character alias with letters, numbers, spaces, underscores or hyphens')
    with connection() as db:db.execute('INSERT INTO activity_profiles VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET alias=excluded.alias,visible=excluded.visible',(user['user_id'],alias.strip(),int(visible)))
    return activity_for(user['user_id'])

def ask_provider(messages):
    key=os.getenv('ANTHROPIC_API_KEY','').strip()
    if not key:raise HTTPException(503,'LungBot needs a server-side ANTHROPIC_API_KEY. Configure it in the terminal that runs Uvicorn, then restart the server.')
    payload={'model':os.getenv('LUNGBOT_MODEL','claude-sonnet-4-6'),'max_tokens':1024,'system':SYSTEM,'messages':messages}
    req=urlrequest.Request('https://api.anthropic.com/v1/messages',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},method='POST')
    try:
        with urlrequest.urlopen(req,timeout=45) as response:data=json.loads(response.read(500_000))
    except urlerror.HTTPError as e:
        if e.code==429:raise HTTPException(429,'The AI provider is rate-limiting requests. Please wait and retry.')
        raise HTTPException(502,'The AI provider rejected the request. Check the server API key, selected model and API account billing.')
    except (urlerror.URLError,TimeoutError,ValueError):raise HTTPException(502,'LungBot could not reach the AI provider. Retry shortly.')
    answer='\n'.join(b.get('text','') for b in data.get('content',[]) if b.get('type')=='text').strip()
    if not answer:raise HTTPException(502,'The AI provider returned no text. Please try again.')
    return {'answer':answer,'model':payload['model'],'notice':'AI-generated information may be incorrect; not a medical diagnosis.'}

@router.post('/chat')
async def chat(request:Request):
    body=await read_json(request);messages=body.get('messages')
    if not isinstance(messages,list) or not 1<=len(messages)<=12:raise HTTPException(422,'Send 1–12 chat messages')
    clean=[]
    for m in messages:
        if not isinstance(m,dict) or m.get('role') not in {'user','assistant'} or not isinstance(m.get('content'),str) or not 1<=len(m['content'].strip())<=3000:raise HTTPException(422,'Each message needs a user/assistant role and 1–3000 characters')
        clean.append({'role':m['role'],'content':m['content'].strip()})
    if clean[-1]['role']!='user' or sum(len(m['content']) for m in clean)>18000:raise HTTPException(422,'End with a user question and keep the conversation shorter')
    if not os.getenv('ANTHROPIC_API_KEY','').strip():raise HTTPException(503,'Set ANTHROPIC_API_KEY in the Uvicorn terminal to enable LungBot.')
    key=request.client.host if request.client else 'local';now=time.monotonic();queue=CHAT_LIMITS[key]
    while queue and now-queue[0]>60:queue.popleft()
    if len(queue)>=12:raise HTTPException(429,'Please wait before sending more LungBot questions')
    queue.append(now)
    return await run_in_threadpool(ask_provider,clean)
