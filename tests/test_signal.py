import unittest
import numpy as np
from backend.signal import estimate

class SignalTests(unittest.TestCase):
    def test_known_frequency(self):
        t=np.arange(0,30,.05)
        a=np.column_stack([t, np.full(len(t),120), 110+2*np.sin(2*np.pi*1.2*t), np.full(len(t),90)])
        self.assertAlmostEqual(estimate(a)['bpm'],72,delta=3)
    def test_flat_rejected(self):
        t=np.arange(0,30,.05)
        self.assertIsNone(estimate(np.column_stack([t,np.ones((len(t),3))*100]))['bpm'])
    def test_bad_time(self):
        with self.assertRaises(ValueError):estimate(np.ones((600,4)))
    def test_nonfinite(self):
        with self.assertRaises(ValueError):estimate(np.full((600,4),np.nan))
if __name__=='__main__':unittest.main()
