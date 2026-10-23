"""Reproducible research baselines. ZIP inputs remain local; no patient data exported."""
import argparse
import hashlib
import json
import platform
import zipfile
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.model_selection import StratifiedGroupKFold, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, average_precision_score, roc_auc_score, brier_score_loss


def load(path, dataset):
    with zipfile.ZipFile(path) as archive:
        member = 'wdbc.data' if dataset == 'breast' else 'risk_factors_cervical_cancer.csv'
        with archive.open(member) as stream:
            df = pd.read_csv(stream, header=None if dataset == 'breast' else 0, na_values='?')
    if dataset == 'breast':
        if df[0].duplicated().any():
            raise ValueError('Duplicate patient identifiers')
        X = df.iloc[:, 2:].copy()
        X.columns = [f'cell_measurement_{i+1}' for i in range(X.shape[1])]
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', choices=['breast', 'cervical'], required=True)
    parser.add_argument('--zip', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    X, y, target = load(args.zip, args.dataset)
    groups = pd.util.hash_pandas_object(X, index=False).to_numpy()
    outer = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    tr, te = next(outer.split(X, y, groups))
    assert not (set(groups[tr]) & set(groups[te]))
    candidates = {
        'logistic': LogisticRegression(max_iter=3000, class_weight='balanced'),
        'svm': SVC(class_weight='balanced'),
        'random_forest': RandomForestClassifier(n_estimators=200, min_samples_leaf=3, class_weight='balanced', random_state=42, n_jobs=1),
        'gradient_boosting': HistGradientBoostingClassifier(max_iter=100, l2_regularization=1, random_state=42),
    }
    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    scores, models = {}, {}
    for name, classifier in candidates.items():
        model = make_pipeline(SimpleImputer(strategy='median', add_indicator=True), StandardScaler(), classifier)
        folds = cross_val_score(model, X.iloc[tr], y.iloc[tr], cv=cv, groups=groups[tr], scoring='average_precision')
        scores[name] = {'mean_average_precision': float(folds.mean()), 'std': float(folds.std())}
        models[name] = model
        print(name, scores[name], flush=True)
    winner = max(scores, key=lambda n: scores[n]['mean_average_precision'])
    model = models[winner].fit(X.iloc[tr], y.iloc[tr])
    pred = model.predict(X.iloc[te])
    rank = model.decision_function(X.iloc[te]) if hasattr(model, 'decision_function') else model.predict_proba(X.iloc[te])[:,1]
    result = {'dataset':args.dataset, 'target':target, 'source_sha256':hashlib.sha256(args.zip.read_bytes()).hexdigest(),
              'seed':42, 'split_policy':'identical predictor rows grouped across all folds', 'selected_model':winner, 'development_cv':scores,
              'rows':len(y), 'development_rows':len(tr), 'test_rows':len(te), 'test_positive_count':int(y.iloc[te].sum()),
              'test_average_precision':float(average_precision_score(y.iloc[te], rank)),
              'test_roc_auc':float(roc_auc_score(y.iloc[te], rank)),
              'test_report':classification_report(y.iloc[te], pred, output_dict=True, zero_division=0),
              'confusion_matrix':confusion_matrix(y.iloc[te], pred, labels=[0,1]).tolist(),
              'features':list(X.columns), 'research_only':True,
              'limitations':['Internal holdout only; no clinical validation.', 'No calibration or individual cancer probability claim.',
                             'Cervical source lacks patient identifiers; repeated-patient leakage cannot be excluded.' if args.dataset == 'cervical' else 'Requires sampled-cell measurements, not user photos.'],
              'versions':{'python':platform.python_version(), 'sklearn':sklearn.__version__, 'pandas':pd.__version__}}
    args.output.mkdir(parents=True, exist_ok=True)
    joblib.dump({'pipeline':model, 'features':list(X.columns), 'target':target, 'research_only':True}, args.output/'model.joblib')
    (args.output/'evaluation.json').write_text(json.dumps(result, indent=2))
    print('Selected:',winner,'Test AP:',result['test_average_precision'])

if __name__ == '__main__':
    main()
