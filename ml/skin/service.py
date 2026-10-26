"""Local research sidecar. Bind only to 127.0.0.1; PHP forwards approved requests."""
import io
import logging
from threading import Lock
from starlette.concurrency import run_in_threadpool
import os
from pathlib import Path
import numpy as np
from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from features import describe

Image.MAX_IMAGE_PIXELS = 6_000_000
app=FastAPI(title='Lungitude research imaging',docs_url=None,redoc_url=None)
from breast_service import router as breast_router
app.include_router(breast_router)
from account_service import router as account_router
app.include_router(account_router)
from engagement_service import router as engagement_router
app.include_router(engagement_router)
from care_service import router as care_router
app.include_router(care_router)
ROOT=Path(__file__).resolve().parent
from registry import ARCHITECTURES
MODELS={name:ROOT/spec['output']/'model.pt' for name,spec in ARCHITECTURES.items()}
loaded={}
inference_lock=Lock()

async def decode(file):
    raw=await file.read(8_000_001)
    if len(raw)>8_000_000:raise HTTPException(413,'Image exceeds 8 MB')
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.width*image.height>6_000_000:raise HTTPException(413,'Image exceeds 6 million pixels')
            if image.format not in ['JPEG','PNG','WEBP']:raise HTTPException(422,'Use JPEG, PNG or WebP')
            return image.convert('RGB').copy()
    except (UnidentifiedImageError,OSError,Image.DecompressionBombError):
        raise HTTPException(422,'Could not decode image')

@app.get('/status')
def status():
    return {'research_only':True,'models':{k:{'checkpoint_present':p.is_file(),'clinical_validation':False} for k,p in MODELS.items()},'features_available':True,'temporal_comparison_available':True,'temporal_model_available':False,'vascular_model_available':False}

@app.post('/features')
async def features(image:UploadFile=File(...),mask:UploadFile=File(...),consent:str=Form('')):
    if consent!='yes':raise HTTPException(422,'Confirm consent for local image analysis')
    image=await decode(image);mask=await decode(mask)
    try:return describe(np.asarray(image),np.asarray(mask.convert('L')))
    except ValueError as e:raise HTTPException(422,str(e))

@app.post('/infer')
async def infer(image:UploadFile=File(...),architecture:str=Form(...),research:str=Form(''),consent:str=Form('')):
    if consent!='yes':raise HTTPException(422,'Explicit selected-image upload consent required')
    if research!='yes':raise HTTPException(422,'Research acknowledgement required')
    if architecture not in MODELS:raise HTTPException(422,'Unsupported architecture')
    if not MODELS[architecture].is_file():raise HTTPException(503,'Trained checkpoint unavailable. Train this model first.')
    img=await decode(image)
    return await run_in_threadpool(predict_still, img, architecture)


def predict_still(img, architecture):
    # Keep model loading/inference off the async event loop; serialize CPU work.
    with inference_lock:
        try:return _predict_still(img, architecture)
        except HTTPException:raise
        except Exception as error:
            logging.getLogger(__name__).error("Skin model %s failed: %s",architecture,type(error).__name__)
            raise HTTPException(503,"Skin model could not be loaded or evaluated")


def _predict_still(img, architecture):
    import torch
    from train import build_model, weights_for, PAD_CLASSES
    if architecture not in loaded:
        ckpt=torch.load(MODELS[architecture],map_location='cpu',weights_only=True)
        if ckpt.get('dataset')!='pad_ufes20' or ckpt.get('architecture')!=architecture or ckpt.get('classes')!=PAD_CLASSES:
            raise HTTPException(503,'Checkpoint is incompatible with this clinical-photo research workflow')
        model=build_model(architecture=architecture,classes=PAD_CLASSES)
        model.load_state_dict(ckpt['state_dict']);model.eval();loaded[architecture]=model
    model=loaded[architecture]
    with torch.inference_mode():
        values=torch.softmax(model(weights_for(architecture).transforms()(img).unsqueeze(0)),dim=1)[0].tolist()
    return {'research_only':True,'architecture':architecture,'scores':dict(zip(PAD_CLASSES,values)),
            'notice':'Uncalibrated image class scores. Video and user-photo performance unvalidated. Not a diagnosis or a patient cancer probability.'}

@app.post('/compare')
async def compare_route(previous:UploadFile=File(...),current:UploadFile=File(...),mask_before:UploadFile=File(...),mask_after:UploadFile=File(...),date_before:str=Form(...),date_after:str=Form(...),scale_before:float=Form(...),scale_after:float=Form(...),consent:str=Form('')):
    if consent!='yes':raise HTTPException(422,'Confirm image analysis consent')
    from temporal import compare
    images=[np.asarray(await decode(f)) for f in [previous,current,mask_before,mask_after]]
    try:return compare(images[0],images[1],images[2][:,:,0],images[3][:,:,0],date_before,date_after,scale_before,scale_after)
    except ValueError as e:raise HTTPException(422,str(e))

@app.post('/infer_all')
async def infer_all(image:UploadFile=File(...),research:str=Form(''),consent:str=Form('')):
    if consent!='yes' or research!='yes':raise HTTPException(422,'Image analysis consent required')
    results={}
    for architecture in MODELS:
        if not MODELS[architecture].is_file():
            results[architecture]={'available':False,'probabilities':None};continue
        await image.seek(0)
        try:
            result=await infer(image=image,architecture=architecture,research=research,consent=consent)
            results[architecture]={'available':True,'probabilities':result['scores'],'calibration':'uncalibrated'}
        except HTTPException as error:
            if error.status_code in {413,422}:raise
            results[architecture]={'available':False,'probabilities':None}
    if not any(r['available'] for r in results.values()):raise HTTPException(503,'No skin assessment available')
    return {'research_only':True,'models':results,'notice':'Uncalibrated image-category probability estimates. Not a validated personal probability of cancer. Models may share training data; agreement is not independent clinical evidence.'}


@app.post('/infer_live')
async def infer_live(image:UploadFile=File(...),research:str=Form(''),consent:str=Form('')):
    """One sampled still per request. No video/temporal or clinical validation."""
    if consent!='yes' or research!='yes':raise HTTPException(422,'Image analysis consent required')
    for architecture in ['mobilenet_v3_small','resnet18','efficientnet_b0']:
        if not MODELS[architecture].is_file():continue
        await image.seek(0)
        try:
            result=await infer(image=image,architecture=architecture,research=research,consent=consent)
            result['preliminary']=True
            result['input_modality']='sampled_still_not_video_model'
            return result
        except HTTPException as error:
            if error.status_code in {413,422}:raise
    raise HTTPException(503,'No compatible live-preview checkpoint')
