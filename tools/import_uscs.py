"""Build a small regional context export, retaining suppression as null."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path
import pandas as pd

def main():
    p=argparse.ArgumentParser();p.add_argument('--zip',required=True);p.add_argument('--state',default='WA');p.add_argument('--output',required=True);p.add_argument('--site',default='Lung and Bronchus');a=p.parse_args()
    rows=[]
    with zipfile.ZipFile(a.zip) as z, z.open('BYAREA_COUNTY.TXT') as f:
        for chunk in pd.read_csv(f,sep='|',dtype=str,chunksize=50000,keep_default_na=False):
            selected=chunk[(chunk.STATE==a.state)&(chunk.RACE=='All Races')&(chunk.SEX=='Male and Female')&(chunk.SITE==a.site)]
            for row in selected.to_dict('records'):
                for key in ['COUNT','POPULATION','AGE_ADJUSTED_RATE','AGE_ADJUSTED_CI_LOWER','AGE_ADJUSTED_CI_UPPER']:
                    value=pd.to_numeric(row[key],errors='coerce');row[key]=None if pd.isna(value) else float(value)
                rows.append(row)
    if not rows:raise ValueError('No matching rows; verify state and demographic labels')
    Path(a.output).write_text(json.dumps({'source_sha256':hashlib.sha256(Path(a.zip).read_bytes()).hexdigest(), 'source':'Uploaded USCS 1999–2023 ASCII','state':a.state,
        'notice':'Population statistics, not individual risk; missing/suppressed values are null. Multi-year windows must not be treated as independent annual observations.',
        'rows':rows},indent=2));print('Exported',len(rows),'regional rows')
if __name__=='__main__':main()
