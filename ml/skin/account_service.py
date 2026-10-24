"""Local prototype accounts and population context, separate from image inference.
Use HTTPS and an audited identity provider before public health-data deployment.
"""
import hashlib,hmac,json,math,os,re,secrets,sqlite3,time,urllib.request
from collections import defaultdict,deque
from pathlib import Path
from fastapi import APIRouter,Form,Request,Response,HTTPException

router=APIRouter(prefix='/account')
ROOT=Path(__file__).resolve().parents[2]
DB=ROOT/'data'/'accounts.sqlite'
COOKIE='lungitude_session'
LIMITS=defaultdict(deque)

def connect():
 DB.parent.mkdir(exist_ok=True)
 db=sqlite3.connect(DB,timeout=5);db.row_factory=sqlite3.Row
 db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY,email TEXT UNIQUE,password TEXT,profile TEXT)')
 db.execute('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,user_id INTEGER,csrf TEXT,expires REAL)')
 return db

def password_hash(password,salt=None):
 salt=salt or secrets.token_hex(16)
 return salt+':'+hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()

def credentials(request,email,password):
 origin=request.headers.get('origin')
 if origin and origin not in {'http://localhost:8000','http://127.0.0.1:8000',os.getenv('LUNGITUDE_PUBLIC_ORIGIN','')}:
  raise HTTPException(403,'Request not permitted')
 email=email.strip().lower()
 if not re.fullmatch(r'[^\s@]{1,100}@[^\s@.]+\.[^\s@]+',email) or len(email)>254 or not 10<=len(password)<=128:
  raise HTTPException(422,'Use a valid email and a password of 10–128 characters')
 key=request.client.host if request.client else 'local';q=LIMITS[key];now=time.time()
 while q and now-q[0]>600:q.popleft()
 if len(q)>=20:raise HTTPException(429,'Please wait before trying again')
 q.append(now)
 return email

def create_session(db,user_id,response):
 token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(32)
 db.execute('INSERT INTO sessions VALUES (?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),user_id,csrf,time.time()+86400))
 response.set_cookie(COOKIE,token,httponly=True,samesite='strict',secure=os.getenv('LUNGITUDE_SECURE_COOKIES')=='1',max_age=86400,path='/')
 return csrf

def session(request,csrf=None):
 token=request.cookies.get(COOKIE,'')
 with connect() as db:
  row=db.execute('SELECT sessions.*,users.email,users.profile FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),time.time())).fetchone()
 if row is None:raise HTTPException(401,'Sign in to continue')
 if csrf is not None and not hmac.compare_digest(csrf,row['csrf']):raise HTTPException(403,'Please sign in again')
 return row

@router.post('/register')
def register(request:Request,response:Response,email:str=Form(...),password:str=Form(...)):
 email=credentials(request,email,password)
 with connect() as db:
  if db.execute('SELECT id FROM users WHERE email=?',(email,)).fetchone():raise HTTPException(409,'Unable to create this account; try signing in')
  try:uid=db.execute('INSERT INTO users(email,password) VALUES (?,?)',(email,password_hash(password))).lastrowid
  except sqlite3.IntegrityError:raise HTTPException(409,'Unable to create this account')
  csrf=create_session(db,uid,response)
 return {'signed_in':True,'csrf':csrf,'profile':None}

@router.post('/login')
def login(request:Request,response:Response,email:str=Form(...),password:str=Form(...)):
 email=credentials(request,email,password)
 with connect() as db:
  row=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
  stored=row['password'] if row else password_hash('dummy-password-123')
  if not hmac.compare_digest(password_hash(password,stored.split(':')[0]),stored) or row is None:raise HTTPException(401,'Email or password not recognized')
  csrf=create_session(db,row['id'],response)
 return {'signed_in':True,'csrf':csrf,'profile':json.loads(row['profile']) if row['profile'] else None}

@router.get('/me')
def me(request:Request):
 row=session(request)
 return {'signed_in':True,'csrf':row['csrf'],'profile':json.loads(row['profile']) if row['profile'] else None}

RACES={'All Races','Hispanic of any race','Non-Hispanic White','Non-Hispanic Black','Non-Hispanic American Indian/Alaska Native','Non-Hispanic Asian/Pacific Islander'}
def validate_profile(value):
 if not isinstance(value,dict):raise ValueError()
 age=value.get('age');height=value.get('height_in');weight=value.get('weight_lb')
 if type(age) is not int or not 0<=age<=120:raise ValueError()
 for number,low,high in [(height,10,100),(weight,1,1500)]:
  if type(number) not in (int,float) or not math.isfinite(number) or not low<=number<=high:raise ValueError()
 if not re.fullmatch(r'\d{5}',str(value.get('zip',''))):raise ValueError()
 race=value.get('race','All Races');sex=value.get('registry_sex','Male and Female');gender=value.get('gender','Prefer not to say')
 if race not in RACES or sex not in {'Male','Female','Male and Female'} or gender not in {'Woman','Man','Nonbinary','Self-described','Prefer not to say'}:raise ValueError()
 return {'age':age,'height_in':height,'weight_lb':weight,'bmi':round(703*weight/(height*height),1),'zip':value['zip'],'race':race,'gender':gender,'registry_sex':sex,'map_consent':value.get('map_consent') is True}

@router.post('/profile')
def profile(request:Request,profile:str=Form(...),csrf:str=Form(...)):
 user=session(request,csrf)
 try:
  if len(profile)>4000:raise ValueError()
  value=validate_profile(json.loads(profile))
 except (ValueError,TypeError):raise HTTPException(422,'Review your age, body measurements and ZIP code')
 with connect() as db:db.execute('UPDATE users SET profile=? WHERE id=?',(json.dumps(value),user['user_id']))
 return {'profile':value}

def age_band(age):return '<1' if age<1 else '1-4' if age<5 else '85+' if age>=85 else f'{age//5*5}-{age//5*5+4}'

def context_for(profile):
 data=json.loads((ROOT/'data'/'skin_national_context.json').read_text())
 target={'AGE':age_band(profile['age']),'RACE':profile['race'],'SEX':profile['registry_sex']}
 row=next((r for r in data['rows'] if all(r[k]==v for k,v in target.items())),None)
 # Never silently substitute an unmatched group or a zero for suppression.
 return {'source':data['source'],'source_url':data['source_url'],'year':data['year'],'site':data['site'],'unit':data['unit'],'matched_group':target,
         'rate':row['RATE'] if row else None,'count':row['COUNT'] if row else None,'ci_lower':row['CI_LOWER'] if row else None,'ci_upper':row['CI_UPPER'] if row else None,
         'notice':'National population context, not your probability of cancer. BMI, height, weight and gender identity do not adjust these registry rates. ZIP is used only for the map. Basal and squamous cell skin cancers are not routinely captured in these registry statistics.'}

def zip_location(zip_code):
 with urllib.request.urlopen('https://api.zippopotam.us/us/'+zip_code,timeout=5) as r:data=json.load(r)
 place=data['places'][0];lat=float(place['latitude']);lon=float(place['longitude'])
 if not -90<=lat<=90 or not -180<=lon<=180:raise ValueError()
 return {'lat':lat,'lon':lon,'place':place['place name'],'state':place['state'],'precision':'ZIP centroid, not your address'}

@router.post('/context')
def context(request:Request,csrf:str=Form(...)):
 user=session(request,csrf)
 if not user['profile']:raise HTTPException(422,'Complete your profile first')
 p=json.loads(user['profile']);result=context_for(p);result['location']=None
 if p['map_consent']:
  try:result['location']=zip_location(p['zip'])
  except Exception:result['map_unavailable']=True
 return result

@router.post('/logout')
def logout(request:Request,response:Response,csrf:str=Form(...)):
 user=session(request,csrf)
 with connect() as db:db.execute('DELETE FROM sessions WHERE token=?',(user['token'],))
 response.delete_cookie(COOKIE,path='/');return {'signed_in':False}

@router.post('/delete')
def delete(request:Request,response:Response,csrf:str=Form(...)):
 user=session(request,csrf)
 with connect() as db:
  db.execute('DELETE FROM sessions WHERE user_id=?',(user['user_id'],));db.execute('DELETE FROM users WHERE id=?',(user['user_id'],))
 response.delete_cookie(COOKIE,path='/');return {'deleted':True}
