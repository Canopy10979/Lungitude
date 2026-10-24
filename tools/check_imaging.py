"""Operator-only skin pipeline diagnosis. Does not upload a real person's image."""
import argparse
import importlib.util
import io
import sys
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ml'/'skin'))
from registry import ARCHITECTURES


def run(base='http://localhost:8000', service='http://127.0.0.1:8010', probe=False):
    states={};failures=[]
    for label,url in [('Python',service.rstrip('/')+'/status'),('Website',base.rstrip('/')+'/api/imaging.php?action=status')]:
        try:
            r=requests.get(url,timeout=12);r.raise_for_status();state=r.json()
            if not isinstance(state.get('models'),dict):raise ValueError('Unexpected response: check the project folder/server')
            states[label]=state
            print('PASS:',label,'imaging status')
            present=[k for k,v in state['models'].items() if v.get('checkpoint_present')]
            print('Checkpoint files reported:',', '.join(present) or 'NONE')
        except (requests.RequestException,ValueError):
            failures.append(label);print('FAIL:',label,'imaging status')
    if 'Python' in states and 'Website' not in states:
        print('NEXT: Keep PHP running from this updated folder; PHP needs cURL or allow_url_fopen for the proxy.')
    if 'Python' not in states:print('NEXT: Restart start-imaging.bat from this folder; check for a port conflict.')
    if len(states)==2 and states['Python']['models']!=states['Website']['models']:
        failures.append('different services');print('FAIL: Python and website report different model state; verify both use the same service.')
    compatible=[]
    for name,spec in ARCHITECTURES.items():
        path=ROOT/'ml'/'skin'/spec['output']/'model.pt'
        if not path.is_file():continue
        if importlib.util.find_spec('torch') is None:
            failures.append(name);print('FAIL:',name,'PyTorch missing; install ml/skin/requirements.txt');continue
        try:
            import torch
            checkpoint=torch.load(path,map_location='cpu',weights_only=True)
            from train import PAD_CLASSES,build_model
            if checkpoint.get('architecture')!=name or checkpoint.get('dataset')!='pad_ufes20' or checkpoint.get('classes')!=PAD_CLASSES:
                raise ValueError('Incompatible checkpoint')
            model=build_model(architecture=name,classes=PAD_CLASSES)
            model.load_state_dict(checkpoint['state_dict']);del model,checkpoint
            compatible.append(name);print('PASS:',name,'local checkpoint schema/weights')
        except Exception as error:
            failures.append(name);print('FAIL:',name,'checkpoint cannot load:',type(error).__name__)
    if not compatible:
        failures.append('skin checkpoint');print('BLOCKED: No compatible trained PAD-UFES-20 skin checkpoint in this project.')
        print('NEXT: Obtain labeled skin images/metadata and train a skin model. Breast tables/weights cannot analyze a skin photo.')
        print('Guide: MODEL_TRAINING.md; expected first checkpoint: ml/skin/output_mobile/model.pt')
    if probe and compatible and 'Website' in states:
        from PIL import Image
        blob=io.BytesIO();Image.new('RGB',(224,224),(120,100,90)).save(blob,format='PNG')
        try:
            r=requests.post(base.rstrip('/')+'/api/imaging.php?action=infer_all',data={'consent':'yes','research':'yes'},files={'image':('synthetic-probe.png',blob.getvalue(),'image/png')},timeout=100)
            r.raise_for_status();result=r.json()
            active=[name for name,item in result.get('models',{}).items() if item.get('available') and item.get('probabilities')]
            if not active:raise ValueError('No model results')
            print('PASS: Synthetic image reached website proxy and model inference:',', '.join(active))
            print('This checks wiring only; its scores have no medical meaning.')
        except (requests.RequestException,ValueError):failures.append('inference');print('FAIL: Inference through website; inspect the Python/PHP terminal logs.')
    return 1 if failures else 0

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',default='http://localhost:8000');parser.add_argument('--service',default='http://127.0.0.1:8010')
    parser.add_argument('--probe',action='store_true',help='Upload one synthetic image to verify full model wiring; never medical validation')
    args=parser.parse_args();sys.exit(run(args.base,args.service,args.probe))
