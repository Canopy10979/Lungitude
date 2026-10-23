"""Check whether new tabular uploads add independent records or skin images."""
import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path
import numpy as np
import pandas as pd

def main():
    p=argparse.ArgumentParser();p.add_argument('--directory',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
    csv=a.directory/'Cancer_Data.csv';breast=a.directory/'breast+cancer+wisconsin+diagnostic.zip';cervical=a.directory/'cervical+cancer+risk+factors(1).zip'
    frame=pd.read_csv(csv)
    with zipfile.ZipFile(breast) as z:
        b=pd.read_csv(io.BytesIO(z.read('wdbc.data')),header=None)
    with zipfile.ZipFile(cervical) as z:
        payload=z.read('risk_factors_cervical_cancer.csv');c=pd.read_csv(io.BytesIO(payload),na_values='?')
    features=[x for x in frame if x not in {'id','diagnosis'} and not x.startswith('Unnamed:')]
    assert len(features)==30
    same=bool(np.array_equal(frame.id.to_numpy(),b[0].to_numpy()) and np.array_equal(frame.diagnosis.to_numpy(),b[1].to_numpy()) and np.allclose(frame[features].to_numpy(),b.iloc[:,2:].to_numpy(),rtol=0,atol=1e-12))
    result={'uploads':{f.name:{'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in [csv,breast,cervical]},
            'breast_csv_rows':len(frame),'breast_zip_rows':len(b),'same_breast_records':same,
            'independent_breast_rows':len(frame) if same else None,'cervical_rows':len(c),
            'labeled_skin_images':0,'skin_training_possible':False,
            'decision':'Train tabular research baselines separately; do not combine duplicate breast records or connect these models to skin-image scoring.'}
    a.output.write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
if __name__=='__main__':main()
