"""Extract national melanoma incidence strata; retain suppression, no personal risk."""
import argparse,json,zipfile,hashlib
from pathlib import Path
import pandas as pd
p=argparse.ArgumentParser();p.add_argument('--zip',required=True);p.add_argument('--output',required=True);a=p.parse_args()
rows=[]
with zipfile.ZipFile(a.zip) as z,z.open('BYAGE.TXT') as f:
 for chunk in pd.read_csv(f,sep='|',dtype=str,chunksize=50000,keep_default_na=False):
  selected=chunk[(chunk.SITE=='Melanomas of the Skin')&(chunk.EVENT_TYPE=='Incidence')&(chunk.YEAR=='2023')]
  for row in selected.to_dict('records'):
   for k in ['RATE','COUNT','POPULATION','CI_LOWER','CI_UPPER']:
    value=pd.to_numeric(row[k],errors='coerce');row[k]=None if pd.isna(value) else float(value)
   rows.append(row)
if not rows:raise ValueError('No source rows')
Path(a.output).write_text(json.dumps({'source':'Uploaded USCS 1999–2023 ASCII, BYAGE.TXT','source_sha256':hashlib.sha256(Path(a.zip).read_bytes()).hexdigest(),'source_url':'https://www.cdc.gov/skin-cancer/statistics/','year':2023,'site':'Melanomas of the Skin','unit':'new cases per 100,000 population in 2023','rows':rows},indent=2))
print('Exported',len(rows),'national melanoma strata')
