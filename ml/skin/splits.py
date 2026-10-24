"""Reproducible group splits, independent of PyTorch and architecture."""
import hashlib
import json
from sklearn.model_selection import GroupShuffleSplit

NAMES = ['train', 'validation', 'test']

def split_metadata(frame, classes=None, files=None):
    frame = frame.copy()
    required = {'image_id','lesion_id','dx'}
    if not required.issubset(frame) or frame[list(required)].isna().any().any():
        raise ValueError('Image, lesion and diagnosis identifiers are required')
    if frame.image_id.duplicated().any():raise ValueError('Duplicate image identifiers')
    # Join patient/lesion groups and exact duplicate file contents. This does not
    # detect resized/re-encoded duplicates or missing patient identifiers.
    group_ids=frame.get('group_id',frame['lesion_id'])
    if group_ids.isna().any() or group_ids.astype(str).str.strip().eq('').any():raise ValueError('Empty split group identifier')
    frame['group_id'] = group_ids.astype(str)
    if files is not None:
        frame['content_sha256'] = [hashlib.sha256(files[k].read_bytes()).hexdigest() for k in frame.image_id]
    parent = {}
    def root(key):
        parent.setdefault(key,key)
        while parent[key]!=key:
            parent[key]=parent[parent[key]];key=parent[key]
        return key
    def join(a,b):
        a,b=root(a),root(b)
        if a!=b:parent[max(a,b)]=min(a,b)
    for row in frame.to_dict('records'):
        group='group:'+row['group_id'];join(group,'lesion:'+str(row['lesion_id']))
        if 'content_sha256' in row:join(group,'sha:'+row['content_sha256'])
    frame['group_id'] = [root('group:'+v) for v in frame.group_id]
    if 'content_sha256' in frame and (frame.groupby('content_sha256').dx.nunique()>1).any():
        raise ValueError('Identical image content has conflicting labels')
    development,test=next(GroupShuffleSplit(n_splits=1,test_size=.2,random_state=42).split(frame,groups=frame.group_id))
    dev=frame.iloc[development]
    train,validation=next(GroupShuffleSplit(n_splits=1,test_size=.1875,random_state=43).split(dev,groups=dev.group_id))
    parts=[dev.iloc[train].copy(),dev.iloc[validation].copy(),frame.iloc[test].copy()]
    for field in ['group_id','lesion_id']+(['content_sha256'] if 'content_sha256' in frame else []):
        groups=[set(p[field]) for p in parts]
        if groups[0]&groups[1] or groups[0]&groups[2] or groups[1]&groups[2]:raise ValueError('Split leakage: '+field)
    for part,name in zip(parts,NAMES):
        missing=set(classes or frame.dx.unique())-set(part.dx)
        if missing:raise ValueError(f'{name} lacks classes {missing}; obtain a documented split with coverage before training.')
    return parts

def write_split_audit(output, parts, dataset):
    digest=hashlib.sha256()
    for part,name in zip(parts,NAMES):
        content=part.sort_values('image_id').to_csv(index=False,lineterminator='\n')
        (output/f'{name}_split.csv').write_text(content)
        digest.update(name.encode()+content.encode())
    audit={'fingerprint':digest.hexdigest(),'dataset':dataset,'seeds':[42,43],
           'target_group_fractions':{'train':.65,'validation':.15,'test':.2},
           'policy':'patient/lesion groups plus exact-file duplicates; no cross-partition overlap',
           'test_use':'One final evaluation after validation selects checkpoint. Do not tune using test scores.',
           'counts':{name:{'images':len(p),'groups':p.group_id.nunique(),'classes':p.dx.value_counts().to_dict()} for name,p in zip(NAMES,parts)},
           'limitations':['HAM10000 lacks full patient IDs.','Exact hashes do not identify re-encoded or near-duplicate images.','No external or webcam validation.']}
    (output/'split_audit.json').write_text(json.dumps(audit,indent=2))
    return audit
