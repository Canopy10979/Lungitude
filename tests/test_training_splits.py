"""Partition integrity tests; synthetic rows do not establish medical accuracy."""
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ml'/'skin'))
from splits import split_metadata, write_split_audit
sys.path.insert(0,str(ROOT/'ml'/'tabular'))
spec=importlib.util.spec_from_file_location('tabular_train_tests',ROOT/'ml'/'tabular'/'train.py')
tabular=importlib.util.module_from_spec(spec);spec.loader.exec_module(tabular)

class SplitTests(unittest.TestCase):
 def frame(self):
  return pd.DataFrame([{'image_id':str(i),'lesion_id':str(i),'group_id':'patient'+str(i//7),'dx':str(i%7)} for i in range(700)])
 def test_patient_separation_coverage_and_reproducibility(self):
  frame=self.frame();first=split_metadata(frame);second=split_metadata(frame)
  groups=[set(p.group_id) for p in first]
  self.assertFalse(groups[0]&groups[1] or groups[0]&groups[2] or groups[1]&groups[2])
  self.assertEqual(sum(map(len,first)),len(frame))
  for a,b in zip(first,second):self.assertEqual(a.image_id.tolist(),b.image_id.tolist());self.assertEqual(set(a.dx),set(frame.dx))
 def test_duplicate_files_are_joined_across_patients(self):
  frame=self.frame()
  with tempfile.TemporaryDirectory() as d:
   files={}
   for i in frame.image_id:
    files[i]=Path(d)/i;files[i].write_bytes(('content'+i).encode())
   files['7'].write_bytes(files['0'].read_bytes())
   parts=split_metadata(frame,files=files)
   containing=[p for p in parts if '0' in set(p.image_id)]
   self.assertIn('7',set(containing[0].image_id))
   audit=write_split_audit(Path(d),parts,'synthetic')
   self.assertEqual(len(audit['fingerprint']),64)
   self.assertTrue((Path(d)/'validation_split.csv').exists())
 def test_conflicting_duplicate_labels_rejected(self):
  frame=self.frame()
  with tempfile.TemporaryDirectory() as d:
   files={}
   for i in frame.image_id:
    files[i]=Path(d)/i;files[i].write_bytes(i.encode())
   files['1'].write_bytes(files['0'].read_bytes())
   with self.assertRaisesRegex(ValueError,'conflicting labels'):split_metadata(frame,files=files)
 def test_tabular_identical_rows_cannot_cross_partitions(self):
  X=pd.DataFrame({'a':list(range(100))*2,'b':list(range(100))*2});y=pd.Series([i%2 for i in range(100)]*2)
  parts,groups=tabular.three_way_split(X,y)
  sets=[set(groups[p]) for p in parts]
  self.assertFalse(sets[0]&sets[1] or sets[0]&sets[2] or sets[1]&sets[2])
  self.assertEqual(sum(map(len,parts)),200)

if __name__=='__main__':unittest.main()
