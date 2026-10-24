"""Experimental spectral pulse estimate from a tracked ROI's RGB means.
No identity recognition, disease classification, HRV or arrhythmia diagnosis.
"""
import numpy as np
from scipy.signal import detrend, butter, sosfiltfilt, welch


def estimate(samples):
    a = np.asarray(samples, dtype=float)
    if a.ndim != 2 or a.shape[1] != 4 or not 300 <= len(a) <= 1800 or not np.isfinite(a).all():
        raise ValueError('Supply 300–1800 finite [seconds, red, green, blue] samples')
    t, rgb = a[:,0], a[:,1:]
    dt = np.diff(t)
    if (dt <= 0).any() or t[-1]-t[0] < 20 or t[-1]-t[0] > 90:
        raise ValueError('Need 20–90 seconds of strictly increasing timestamps')
    fs = 1/np.median(dt)
    if not 10 <= fs <= 60 or dt.max() > .5 or np.std(dt)/np.mean(dt) > .25:
        return {'bpm':None, 'quality':'rejected', 'reason':'Irregular sampling or dropped frames'}
    if (rgb < 0).any() or (rgb > 255).any():
        raise ValueError('RGB means must be in [0,255]')
    if (rgb.mean(axis=0) < 10).any() or (rgb.mean(axis=0) > 245).any():
        return {'bpm':None, 'quality':'rejected', 'reason':'Poor exposure'}
    # Green-channel baseline, not a trained rPPG model. Uniform resampling first.
    grid = np.arange(t[0], t[-1], 1/fs)
    g = np.interp(grid, t, rgb[:,1])
    if np.std(g) < .02:
        return {'bpm':None, 'quality':'rejected', 'reason':'No measurable temporal variation'}
    clean = sosfiltfilt(butter(3, [.7, 3], btype='bandpass', fs=fs, output='sos'), detrend(g))
    f, power = welch(clean, fs=fs, nperseg=min(len(clean), int(fs*20)))
    band = (f >= .7) & (f <= 3)
    peak = np.flatnonzero(band)[np.argmax(power[band])]
    concentration = float(power[max(0,peak-1):peak+2].sum()/max(power[band].sum(),1e-12))
    if concentration < .5:
        return {'bpm':None, 'quality':'rejected', 'reason':'No dominant pulse-band component'}
    return {'bpm':round(float(f[peak]*60),1), 'quality':'experimental', 'spectral_concentration':round(concentration,3),
            'notice':'Unvalidated estimate; motion and lighting can mimic pulse. Not an arrhythmia or cancer assessment.'}
