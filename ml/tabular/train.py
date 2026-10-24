"""Reproducible research baselines. ZIP inputs remain local; no patient data exported."""
import argparse
import hashlib
import json
import platform
import zipfile
from pathlib import Path
import joblib
from schema import BREAST_FEATURES
import numpy as np
import pandas as pd
import sklearn
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import classification_report, confusion_matrix, average_precision_score, roc_auc_score


def load(path, dataset):
    if Path(path).suffix.lower() == '.csv':
        if dataset != 'breast':
            raise ValueError('CSV adapter currently supports Wisconsin breast diagnostic records only')
        source = pd.read_csv(path)
        if not {'id', 'diagnosis'}.issubset(source):
            raise ValueError('Expected Wisconsin id and diagnosis columns')
        source = source.drop(columns=[c for c in source if c.startswith('Unnamed:') and source[c].isna().all()])
        source = source.rename(columns=lambda c: c.replace(' ', '_'))
        if not set(BREAST_FEATURES).issubset(source):
            raise ValueError('CSV does not match the 30 Wisconsin measurement names')
        if len(source.columns) != 32:
            raise ValueError('Expected id, diagnosis and exactly 30 measurements')
        df = source[['id', 'diagnosis'] + BREAST_FEATURES].copy()
        df.columns = range(32)
    else:
        with zipfile.ZipFile(path) as archive:
            member = 'wdbc.data' if dataset == 'breast' else 'risk_factors_cervical_cancer.csv'
            with archive.open(member) as stream:
                df = pd.read_csv(stream, header=None if dataset == 'breast' else 0, na_values='?')
    if dataset == 'breast':
        if df[0].duplicated().any():
            raise ValueError('Duplicate patient identifiers')
        X = df.iloc[:, 2:].copy()
        X.columns = BREAST_FEATURES
        y = df[1].map({'B': 0, 'M': 1})
        target = 'malignant sampled breast mass (not questionnaire risk)'
    else:
        y = df['Biopsy']
        # Exclude examinations and diagnoses unavailable before the predicted test.
        X = df.drop(columns=['Biopsy', 'Hinselmann', 'Schiller', 'Citology', 'Dx:Cancer', 'Dx:CIN', 'Dx:HPV', 'Dx'])
        target = 'recorded biopsy positivity (not future cancer incidence)'
    X = X.apply(pd.to_numeric)
    if y.isna().any() or not set(y.unique()) <= {0, 1}:
        raise ValueError('Invalid target')
    return X, y.astype(int), target


def three_way_split(X, y):
    groups = pd.util.hash_pandas_object(X, index=False).to_numpy()
    development, test = next(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42).split(X,y,groups))
    train, validation = next(StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=43).split(X.iloc[development],y.iloc[development],groups[development]))
    parts = [development[train], development[validation], test]
    sets = [set(groups[part]) for part in parts]
    if sets[0]&sets[1] or sets[0]&sets[2] or sets[1]&sets[2]:raise ValueError('Duplicate predictors cross splits')
    if any(set(y.iloc[part])!={0,1} for part in parts):raise ValueError('Each split must contain both classes')
    return parts, groups


def evaluate(model, X, y):
    pred=model.predict(X)
    rank=model.decision_function(X) if hasattr(model,'decision_function') else model.predict_proba(X)[:,1]
    return {'average_precision':float(average_precision_score(y,rank)),
            'roc_auc':float(roc_auc_score(y,rank)),
            'report':classification_report(y,pred,output_dict=True,zero_division=0),
            'confusion_matrix':confusion_matrix(y,pred,labels=[0,1]).tolist()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', choices=['breast', 'cervical'], required=True)
    parser.add_argument('--input', '--zip', dest='zip', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    X, y, target = load(args.zip, args.dataset)
    (tr, va, te), groups = three_way_split(X,y)
    candidates = {
        'logistic': LogisticRegression(max_iter=3000, class_weight='balanced'),
        'svm': SVC(class_weight='balanced'),
        'random_forest': RandomForestClassifier(n_estimators=200, min_samples_leaf=3, class_weight='balanced', random_state=42, n_jobs=1),
        'gradient_boosting': HistGradientBoostingClassifier(max_iter=100, l2_regularization=1, random_state=42),
    }
    args.output.mkdir(parents=True, exist_ok=True)
    source_hash=hashlib.sha256(args.zip.read_bytes()).hexdigest()
    manifest={'source_sha256':source_hash,'seed':[42,43],'policy':'Identical predictor rows grouped. Approximately 60/20/20; group sizes affect exact counts.',
              'partitions':{name:{'row_indices':part.tolist(),'group_hashes':[str(g) for g in groups[part]],'rows':len(part),'positive_count':int(y.iloc[part].sum())} for name,part in zip(['train','validation','test'],[tr,va,te])}}
    fingerprint=hashlib.sha256(json.dumps(manifest,sort_keys=True).encode()).hexdigest()
    manifest['fingerprint']=fingerprint
    (args.output/'split_audit.json').write_text(json.dumps(manifest,indent=2))
    scores, models = {}, {}
    for name, classifier in candidates.items():
        model=make_pipeline(SimpleImputer(strategy='median',add_indicator=True),StandardScaler(),classifier)
        model.fit(X.iloc[tr],y.iloc[tr])  # Imputer/scaler see training rows only.
        scores[name]=evaluate(model,X.iloc[va],y.iloc[va]);models[name]=model
        print(name,'validation AP:',scores[name]['average_precision'],flush=True)
    winner=max(scores,key=lambda name:scores[name]['average_precision'])
    # Selection is locked BEFORE touching the test set. No test-based ensemble or tuning.
    result={'dataset':args.dataset,'target':target,'source_sha256':source_hash,'split_fingerprint':fingerprint,
            'seed':[42,43],'selected_model':winner,'selection_metric':'validation average precision',
            'rows':len(y),'train_rows':len(tr),'validation_rows':len(va),'test_rows':len(te),
            'test_positive_count':int(y.iloc[te].sum()),'models':{},'features':list(X.columns),'research_only':True,
            'limitations':['Internal holdout only; no clinical validation.','No calibration or individual cancer probability claim.',
             'Cervical source lacks patient identifiers; repeated-patient leakage cannot be excluded.' if args.dataset=='cervical' else 'Requires sampled-cell measurements, not user photos.'],
            'versions':{'python':platform.python_version(),'sklearn':sklearn.__version__,'pandas':pd.__version__}}
    for name,model in models.items():
        holdout=evaluate(model,X.iloc[te],y.iloc[te])
        evaluation={'validation':scores[name],'test':holdout,'split_fingerprint':fingerprint,'fit_partition':'train_only'}
        result['models'][name]=evaluation
        checkpoint={'pipeline':model,'features':list(X.columns),'target':target,'research_only':True,'architecture':name,'split_fingerprint':fingerprint}
        joblib.dump(checkpoint,args.output/(name+'.joblib'))
        (args.output/(name+'_evaluation.json')).write_text(json.dumps(evaluation,indent=2))
        if name==winner:joblib.dump(checkpoint,args.output/'model.joblib')
    chosen=result['models'][winner]['test']
    result.update(test_average_precision=chosen['average_precision'],test_roc_auc=chosen['roc_auc'],test_report=chosen['report'],confusion_matrix=chosen['confusion_matrix'])
    (args.output/'evaluation.json').write_text(json.dumps(result,indent=2))
    print('Validation-selected:',winner,'Final test AP:',chosen['average_precision'])
    print('Saved all four trained models, validation/test reports and shared split audit.')

if __name__ == '__main__':
    from threadpoolctl import threadpool_limits
    with threadpool_limits(limits=1):main()
