"""Exploratory dated-image comparison; user scales/outlines determine validity."""
from datetime import date
import cv2
import numpy as np


def compare(previous, current, mask_before, mask_after, date_before, date_after, scale_before, scale_after):
    before=date.fromisoformat(date_before);after=date.fromisoformat(date_after)
    days=(after-before).days
    if days<=0:raise ValueError('Follow-up date must be later than baseline date')
    if not (0<scale_before<=10000 and 0<scale_after<=10000):raise ValueError('Provide positive pixels-per-mm scales measured from a ruler in each image')
    if previous.shape[:2]!=mask_before.shape[:2] or current.shape[:2]!=mask_after.shape[:2]:raise ValueError('Mask dimensions must match their images')
    if (mask_before>127).sum()<100 or (mask_after>127).sum()<100:raise ValueError('Outline the lesion in both images')
    area_before=float((mask_before>127).sum())/scale_before**2
    area_after=float((mask_after>127).sum())/scale_after**2
    alignment={'status':'unavailable','reason':'Not enough consistent image features for registration'}
    orb=cv2.ORB_create(nfeatures=1500)
    a,desca=orb.detectAndCompute(cv2.cvtColor(previous,cv2.COLOR_RGB2GRAY),None)
    b,descb=orb.detectAndCompute(cv2.cvtColor(current,cv2.COLOR_RGB2GRAY),None)
    if desca is not None and descb is not None and len(a)>=12 and len(b)>=12:
        pairs=cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(desca,descb,k=2)
        matches=[pair[0] for pair in pairs if len(pair)==2 and pair[0].distance<.7*pair[1].distance]
        if len(matches)>=12:
            src=np.float32([a[m.queryIdx].pt for m in matches]);dst=np.float32([b[m.trainIdx].pt for m in matches])
            h,inliers=cv2.findHomography(src,dst,cv2.RANSAC,3)
            count=int(inliers.sum()) if inliers is not None else 0
            if h is not None and count>=12 and count/len(matches)>=.5 and np.isfinite(h).all():
                projected=cv2.perspectiveTransform(src.reshape(-1,1,2),h).reshape(-1,2)
                error=float(np.median(np.linalg.norm(projected[inliers.ravel()>0]-dst[inliers.ravel()>0],axis=1)))
                aligned=cv2.warpPerspective(mask_before,h,(current.shape[1],current.shape[0]),flags=cv2.INTER_NEAREST)>127
                union=np.logical_or(aligned,mask_after>127).sum()
                mismatch=float(np.logical_xor(aligned,mask_after>127).sum()/max(union,1))
                alignment={'status':'experimental_alignment','inliers':count,'median_reprojection_error_pixels':round(error,3),'outline_mismatch_fraction':round(mismatch,4),'notice':'Registration may align background instead of lesion; visually verify correspondence. No accuracy established.'}
    return {'research_only':True,'days_between':days,'area_before_mm2':round(area_before,3),'area_after_mm2':round(area_after,3),'area_difference_mm2':round(area_after-area_before,3),'area_difference_per_day_mm2':round((area_after-area_before)/days,5),'alignment':alignment,'notice':'Exploratory measurement difference, not confirmed biological growth or cancer evidence. Ruler accuracy, perspective, camera angle and outlines affect results. No malignancy prediction.'}
