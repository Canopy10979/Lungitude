"""Local research sidecar. Bind only to 127.0.0.1; PHP forwards approved requests."""
import io
import os
from pathlib import Path
import numpy as np
from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from features import describe

Image.MAX_IMAGE_PIXELS = 6_000_000
app=FastAPI(title='Lungitude research imaging',docs_url=None,redoc_url=None)
ROOT=Path(__file__).resolve().parent
MODELS={'mobilenet_v3_small': ROOT/'output_mobile/model.pt','efficientnet_b0':ROOT/'output_efficient/model.pt'}
loaded={}

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
async def infer(image:UploadFile=File(...),architecture:str=Form(...),research:str=Form('')):
    if research!='yes':raise HTTPException(422,'Research acknowledgement required')
    if architecture not in MODELS:raise HTTPException(422,'Unsupported architecture')
    if not MODELS[architecture].is_file():raise HTTPException(503,'Trained checkpoint unavailable. Train this model first.')
    img=await decode(image)
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
