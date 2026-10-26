"""Consent-based Google Maps listings. No images/profile data sent to Google."""
import math
import os
import time
from collections import defaultdict,deque
from threading import Lock
from urllib.parse import urlencode
import requests
from fastapi import APIRouter,Form,HTTPException,Request
from starlette.concurrency import run_in_threadpool

router=APIRouter(prefix='/care')
METERS_PER_MILE=1609.344
RADIUS_METERS=10*METERS_PER_MILE
QUERY='skin cancer centers'
LIMITS=defaultdict(deque)
LIMIT_LOCK=Lock()

def distance_meters(lat,lon,other_lat,other_lon):
 a,b=map(math.radians,[lat,other_lat]);dlat=b-a;dlon=math.radians(other_lon-lon)
 h=math.sin(dlat/2)**2+math.cos(a)*math.cos(b)*math.sin(dlon/2)**2
 return 6371008.8*2*math.asin(math.sqrt(min(1,max(0,h))))

def normalize(places,lat,lon):
 results=[];seen=set()
 for place in places:
  location=place.get('location',{});x=location.get('latitude');y=location.get('longitude')
  if type(x) not in (int,float) or type(y) not in (int,float) or not math.isfinite(x) or not math.isfinite(y) or abs(x)>90 or abs(y)>180:continue
  distance=distance_meters(lat,lon,x,y)
  if distance>RADIUS_METERS:continue
  identity=place.get('id');name=place.get('displayName',{}).get('text','Care listing');address=place.get('formattedAddress','')
  unique=identity or (name,address)
  if unique in seen:continue
  seen.add(unique)
  query={'api':'1','query':name+' '+address}
  if identity:query['query_place_id']=identity
  results.append({'name':name,'address':address,'meters':distance,'miles':round(distance/METERS_PER_MILE,2),'maps_url':'https://www.google.com/maps/search/?'+urlencode(query),'attributions':place.get('attributions',[])})
 return sorted(results,key=lambda p:p['meters'])[:10]

def search(lat,lon):
 key=os.getenv('GOOGLE_PLACES_KEY','').strip()
 if not key:raise HTTPException(503,'Care search is not configured')
 try:
  response=requests.post('https://places.googleapis.com/v1/places:searchText',
   headers={'X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location,places.attributions','Content-Type':'application/json'},
   json={'textQuery':QUERY,'pageSize':20,'rankPreference':'DISTANCE','locationBias':{'circle':{'center':{'latitude':lat,'longitude':lon},'radius':RADIUS_METERS}}},timeout=12)
  response.raise_for_status();data=response.json()
  if not isinstance(data,dict) or 'error' in data:raise ValueError()
 except (requests.RequestException,ValueError):raise HTTPException(502,'Care search could not be completed')
 return {'source':'Google Maps','query':QUERY,'radius_miles':10,'distance_basis':'straight_line','places':normalize(data.get('places',[]),lat,lon),
         'notice':'Search matches, not verified treatment providers. Call to confirm skin cancer services. Distances are straight-line, not travel distances.'}

@router.post('/search')
async def care_search(request:Request,latitude:float=Form(...),longitude:float=Form(...),consent:str=Form('')):
 if consent!='yes':raise HTTPException(422,'Location sharing consent required')
 if not math.isfinite(latitude) or not math.isfinite(longitude) or abs(latitude)>90 or abs(longitude)>180:raise HTTPException(422,'Valid coordinates required')
 with LIMIT_LOCK:
  key=request.client.host if request.client else 'local';now=time.time();attempts=LIMITS[key]
  while attempts and now-attempts[0]>3600:attempts.popleft()
  if len(attempts)>=20:raise HTTPException(429,'Please wait before searching again')
  attempts.append(now)
 return await run_in_threadpool(search,latitude,longitude)
