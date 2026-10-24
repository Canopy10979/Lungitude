"""Separate sampled-cell research task. Never accepts camera images."""
import json
import math
import sys
from pathlib import Path
from fastapi import APIRouter, Form, HTTPException
sys.path.append(str(Path(__file__).resolve().parents[2]))
from ml.tabular.schema import BREAST_FEATURES

router = APIRouter(prefix='/breast')
ROOT=Path(__file__).resolve().parents[1]/'tabular'/'output_breast'

@router.get('/status')
def status():
    present=(ROOT/'model.joblib').is_file() and (ROOT/'evaluation.json').is_file()
    return {'checkpoint_present':present, 'features':BREAST_FEATURES, 'research_only':True,
            'input_modality':'fine_needle_aspirate_cell_measurements','clinical_validation':False}

@router.post('/infer')
def infer(measurements:str=Form(...),consent:str=Form(''),research:str=Form('')):
    if consent!='yes' or research!='yes':raise HTTPException(422,'Confirm consent and research acknowledgement')
    if len(measurements)>12000:raise HTTPException(413,'Measurement payload too large')
    try:
        values=json.loads(measurements)
        if not isinstance(values,dict) or set(values)!=set(BREAST_FEATURES):raise ValueError()
        if any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in values.values()):raise ValueError()
    except (ValueError,TypeError):raise HTTPException(422,'Provide exactly 30 named finite, nonnegative measurements')
    if not status()['checkpoint_present']:raise HTTPException(503,'Train the breast measurement model first')
    # Only load locally trained, trusted files. No checkpoint upload route exists.
    import joblib
    import pandas as pd
    checkpoint=joblib.load(ROOT/'model.joblib')
    if checkpoint.get('features')!=BREAST_FEATURES or not checkpoint.get('research_only'):
        raise HTTPException(503,'Checkpoint schema incompatible; retrain with the current trainer')
    model=checkpoint['pipeline'];frame=pd.DataFrame([[values[k] for k in BREAST_FEATURES]],columns=BREAST_FEATURES)
    prediction=int(model.predict(frame)[0])
    return {'research_only':True,'input_modality':'fine_needle_aspirate_cell_measurements',
            'predicted_dataset_class':'malignant' if prediction else 'benign',
            'notice':'Research classification of sampled-cell measurements. Not a diagnosis, a screening result, or a cancer probability. Does not assess photos, symptoms, or skin lesions.'}
