"""Exploratory descriptors from a manually outlined lesion. Not diagnostic."""
import math
import numpy as np
import cv2


def describe(image, mask):
    selected = mask > 127
    if image.ndim != 3 or image.shape[:2] != selected.shape:
        raise ValueError('Image and mask dimensions must match')
    area = int(selected.sum())
    if area < 100: raise ValueError('Outline a larger lesion region')
    ys,xs = np.where(selected)
    crop = selected[ys.min():ys.max()+1,xs.min():xs.max()+1].astype(np.uint8)
    # Principal-axis alignment for geometric reflection comparisons.
    points = np.column_stack((xs,ys)).astype(np.float32)
    center, vectors = cv2.PCACompute(points, mean=None)
    angle = math.degrees(math.atan2(vectors[0,1],vectors[0,0]))
    matrix = cv2.getRotationMatrix2D(tuple(float(x) for x in center[0]),angle,1)
    aligned = cv2.warpAffine(selected.astype(np.uint8), matrix,(mask.shape[1],mask.shape[0]),flags=cv2.INTER_NEAREST)
    ay,ax = np.where(aligned)
    if len(ax)<100: raise ValueError('Outline too close to image edge for shape comparison')
    cut=aligned[ay.min():ay.max()+1,ax.min():ax.max()+1].astype(bool)
    asym=[]
    for axis in [0,1]:
        reflected=np.flip(cut,axis=axis); union=np.logical_or(cut,reflected).sum()
        asym.append(float(np.logical_xor(cut,reflected).sum()/max(1,union)))
    contours,_=cv2.findContours(selected.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    perimeter=sum(cv2.arcLength(c,True) for c in contours)
    circularity=4*math.pi*area/max(perimeter**2,1)
    colors=image[selected].astype(float)
    hsv=cv2.cvtColor(image,cv2.COLOR_RGB2HSV)[selected].astype(float)
    gray=cv2.cvtColor(image,cv2.COLOR_RGB2GRAY)
    quantized=(gray//16).astype(int)
    pairmask=selected[:,:-1]&selected[:,1:]
    pairs=quantized[:,:-1][pairmask]*16+quantized[:,1:][pairmask]
    glcm=np.bincount(pairs,minlength=256).reshape(16,16).astype(float)
    glcm+=glcm.T;glcm/=max(glcm.sum(),1)
    i,j=np.indices((16,16))
    return {
      'research_only':True,'segmentation':'manual outline; accuracy depends on outline and acquisition',
      'shape':{'area_pixels':area,'perimeter_pixels':round(float(perimeter),2),
               'axis_asymmetry':asym,'circularity':round(float(circularity),4)},
      'color':{'rgb_std':colors.std(0).round(3).tolist(),
               'saturation_std':round(float(hsv[:,1].std()),3),
               'brightness_std':round(float(hsv[:,2].std()),3)},
      'texture':{'glcm_contrast':round(float(((i-j)**2*glcm).sum()),4),
                 'glcm_homogeneity':round(float((glcm/(1+(i-j)**2)).sum()),4),
                 'glcm_energy':round(float((glcm**2).sum()),4),
                 'definition':'16 gray levels, horizontal neighbor offset, symmetric matrix'},
      'vascular':{'status':'unavailable','reason':'No validated vessel model; ordinary camera images cannot establish vascular architecture.'},
      'temporal':{'status':'requires_dated_calibrated_followup','reason':'A short recording cannot establish lesion growth. No growth rate estimated.'},
      'notice':'Shape, color and texture measurements are not malignancy scores. Lighting, focus, outline and skin tone affect them.'}
