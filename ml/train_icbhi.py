"""
Train the Lungitude lung-sound model on the ICBHI 2017 Respiratory Sound Database.

Python is used ONLY here, for training. The result is a small JSON file
(data/lung_model.json). The browser runs it in plain JavaScript (js/lungsound.js),
so the app itself needs no Python and no npm.

What it learns: for each breathing cycle -> normal / crackle / wheeze / both.
What it does NOT learn: cancer, or the type of cancer. ICBHI has no cancer labels.

Data: https://bhichallenge.med.auth.gr/ICBHI_2017_Challenge
    Unzip so that ml/icbhi/ holds the .wav + .txt pairs, plus (optional)
    ICBHI_challenge_train_test.txt for the official split.

Run:
    pip install numpy scipy scikit-learn --break-system-packages
    python3 ml/train_icbhi.py ml/icbhi
"""

import glob
import json
import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import GroupShuffleSplit

SR = 4000          # lung sounds are mostly below 2 kHz
N_FFT = 256        # 64 ms frames at 4 kHz
HOP = 128
N_MELS = 32
FMIN = 50
FMAX = 2000
CLASSES = ["normal", "crackle", "wheeze", "both"]


def hz_to_mel(f):
    return 2595.0 * np.log10(1.0 + f / 700.0)


def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1.0)


def mel_filters():
    mels = np.linspace(hz_to_mel(FMIN), hz_to_mel(FMAX), N_MELS + 2)
    bins = np.floor((N_FFT + 1) * mel_to_hz(mels) / SR).astype(int)
    fb = np.zeros((N_MELS, N_FFT // 2 + 1))
    for m in range(1, N_MELS + 1):
        left, center, right = bins[m - 1], bins[m], bins[m + 1]
        for k in range(left, center):
            fb[m - 1, k] = (k - left) / max(center - left, 1)
        for k in range(center, right):
            fb[m - 1, k] = (right - k) / max(right - center, 1)
    return fb


FB = mel_filters()
WINDOW = np.hanning(N_FFT)


def features(x):
    """Same math as js/lungsound.js. Change both together."""
    x = x - np.mean(x)
    peak = np.max(np.abs(x))
    if peak > 0:
        x = x / peak
    if len(x) < N_FFT:
        x = np.pad(x, (0, N_FFT - len(x)))
    frames = []
    for start in range(0, len(x) - N_FFT + 1, HOP):
        frame = x[start:start + N_FFT] * WINDOW
        power = np.abs(np.fft.rfft(frame)) ** 2
        frames.append(np.log(FB @ power + 1e-6))
    m = np.array(frames)
    zcr = np.mean(np.abs(np.diff(np.sign(x)))) / 2
    delta = np.mean(np.abs(np.diff(m, axis=0)), axis=0) if len(m) > 1 else np.zeros(N_MELS)
    return np.concatenate([m.mean(axis=0), m.std(axis=0), delta, [zcr]])


def load_audio(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        g = np.gcd(sr, SR)
        x = resample_poly(x, SR // g, sr // g)
    return x


def load_dataset(root):
    X, y, groups, names = [], [], [], []
    for wav in sorted(glob.glob(os.path.join(root, "*.wav"))):
        base = os.path.splitext(os.path.basename(wav))[0]
        ann = os.path.join(root, base + ".txt")
        if not os.path.exists(ann):
            continue
        x = load_audio(wav)
        patient = base.split("_")[0]
        for line in open(ann):
            parts = line.split()
            if len(parts) < 4:
                continue
            start, end, crackle, wheeze = float(parts[0]), float(parts[1]), int(parts[2]), int(parts[3])
            seg = x[int(start * SR):int(end * SR)]
            if len(seg) < SR * 0.3:
                continue
            X.append(features(seg))
            y.append(crackle + 2 * wheeze)   # 0 normal, 1 crackle, 2 wheeze, 3 both
            groups.append(patient)
            names.append(base)
    return np.array(X), np.array(y), np.array(groups), names


def official_split(root, names):
    path = os.path.join(root, "ICBHI_challenge_train_test.txt")
    if not os.path.exists(path):
        return None
    split = {}
    for line in open(path):
        parts = line.split()
        if len(parts) == 2:
            split[parts[0]] = parts[1]
    test = np.array([split.get(n) == "test" for n in names])
    return np.where(~test)[0], np.where(test)[0]


def icbhi_score(y_true, y_pred):
    """Official ICBHI score: average of specificity (normal) and sensitivity (abnormal)."""
    normal = y_true == 0
    sp = np.mean(y_pred[normal] == 0) if normal.any() else 0.0
    sens_hits = (y_pred == y_true) & ~normal
    se = sens_hits.sum() / max((~normal).sum(), 1)
    return sp, se, (sp + se) / 2


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "ml/icbhi"
    X, y, groups, names = load_dataset(root)
    if len(X) == 0:
        print("No data found in", root)
        sys.exit(1)
    print(f"{len(X)} cycles from {len(set(groups))} patients")

    split = official_split(root, names)
    if split is None:
        # Split by PATIENT. A random split by cycle leaks the same person
        # into train and test and gives a fake high score.
        gss = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=7)
        split = next(gss.split(X, y, groups))
        print("Using a patient-level 70/30 split")
    else:
        print("Using the official ICBHI split")
    tr, te = split

    mean = X[tr].mean(axis=0)
    std = X[tr].std(axis=0) + 1e-6
    clf = LogisticRegression(max_iter=3000, class_weight="balanced", C=0.5)
    clf.fit((X[tr] - mean) / std, y[tr])

    pred = clf.predict((X[te] - mean) / std)
    sp, se, score = icbhi_score(y[te], pred)
    print(f"Specificity {sp:.3f}  Sensitivity {se:.3f}  ICBHI score {score:.3f}")
    print("Confusion matrix (rows = true", CLASSES, ")")
    print(confusion_matrix(y[te], pred, labels=[0, 1, 2, 3]))

    model = {
        "classes": [CLASSES[c] for c in clf.classes_],
        "sr": SR, "n_fft": N_FFT, "hop": HOP, "n_mels": N_MELS, "fmin": FMIN, "fmax": FMAX,
        "mean": mean.round(6).tolist(),
        "std": std.round(6).tolist(),
        "coef": clf.coef_.round(6).tolist(),
        "intercept": clf.intercept_.round(6).tolist(),
        "test": {"specificity": round(sp, 3), "sensitivity": round(se, 3), "icbhi_score": round(score, 3),
                 "cycles": int(len(te)), "patients": int(len(set(groups[te])))},
    }
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "lung_model.json")
    with open(out, "w") as f:
        json.dump(model, f)
    print("Saved", os.path.normpath(out))


if __name__ == "__main__":
    main()
