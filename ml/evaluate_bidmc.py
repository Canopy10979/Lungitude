"""Contact-PPG benchmark; explicitly NOT webcam validation or neural training."""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
import numpy as np
from scipy.signal import resample_poly
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.signal import estimate


def read_record(z, root):
    lines=z.read(root+'.hea').decode().splitlines()
    head=lines[0].split(); channels=int(head[1]); fs=float(head[2])
    data=np.frombuffer(z.read(root+'.dat'),dtype='<i2').reshape(-1,channels).astype(float)
    names=[]
    for i,line in enumerate(lines[1:channels+1]):
        parts=line.split()
        if parts[1]!='16':raise ValueError('Only interleaved WFDB format 16 supported')
        match=re.fullmatch(r'([\d.]+)\((-?\d+)\)/.*',parts[2])
        if parts[2].startswith('NaN('):
            data[:,i]=np.nan;names.append(parts[-1].rstrip(','));continue
        if not match:raise ValueError('Unsupported gain/baseline')
        missing=data[:,i]==-32768
        data[:,i]=(data[:,i]-float(match[2]))/float(match[1])
        data[missing,i]=np.nan
        names.append(parts[-1].rstrip(','))
    return data, fs, names


def main():
    p=argparse.ArgumentParser();p.add_argument('--zip',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    rows=[]
    with zipfile.ZipFile(a.zip) as z:
        for name in sorted(z.namelist()):
            if not re.search(r'/bidmc\d\d\.hea$',name):continue
            root=name[:-4];data,fs,names=read_record(z,root);numeric,nfs,nnames=read_record(z,root+'n')
            if fs!=125 or nfs!=1:raise ValueError('Unexpected BIDMC sample rate')
            errors=[]; rejected=0; attempted=0
            for start in range(0,int(len(data)/fs)-30,30):
                ref=numeric[start:start+30,nnames.index('HR')]
                ref=ref[(ref>=42)&(ref<=180)]
                if len(ref)<20:continue
                attempted+=1
                wave=resample_poly(data[int(start*fs):int((start+30)*fs),names.index('PLETH')],4,25)
                if not np.isfinite(wave).all():
                    rejected+=1;continue
                wave=(wave-wave.mean())/max(wave.std(),1e-9)
                t=np.arange(len(wave))/20
                result=estimate(np.column_stack([t,np.full(len(t),120),110+2*wave,np.full(len(t),90)]))
                if result['bpm'] is None:rejected+=1
                else:errors.append(abs(result['bpm']-float(np.median(ref))))
            rows.append({'record':Path(root).name,'eligible_windows':attempted,'accepted_windows':len(errors),'rejected_windows':rejected,
                         'mae_bpm':float(np.mean(errors)) if errors else None})
    valid=[r['mae_bpm'] for r in rows if r['mae_bpm'] is not None]
    result={'source_sha256':hashlib.sha256(Path(a.zip).read_bytes()).hexdigest(), 'benchmark':'BIDMC contact PPG against monitor HR; 30-second windows','research_only':True,
            'subject_macro_mae_bpm':float(np.mean(valid)), 'records':rows,
            'limitations':['Contact PPG is not facial video. No webcam validity established.',
                           'Reference is monitor numeric HR, not independently adjudicated beats.',
                           'Results conditional on quality gate; report rejected-window coverage.',
                           'No HRV or arrhythmia diagnosis. No model parameters trained.']}
    Path(a.output).write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='records'},indent=2))
if __name__=='__main__':main()
