"""Verify published research artifact integrity and inference shape, not medical accuracy."""

import hashlib
import json
import math
from pathlib import Path
import sys
import unittest

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml" / "skin"))
from train import PAD_CLASSES, build_model


class PublishedModels(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.manifest = json.loads((ROOT / "models" / "manifest.json").read_text())

    def test_three_real_artifacts(self):
        self.assertEqual(self.manifest["trained_model_count"], 3)
        self.assertEqual(len(self.manifest["models"]), 3)
        for entry in self.manifest["models"]:
            with self.subTest(model=entry["id"]):
                path = ROOT / entry["artifact"]
                self.assertTrue(path.is_file())
                self.assertEqual(path.stat().st_size, entry["bytes"])
                self.assertEqual(
                    hashlib.sha256(path.read_bytes()).hexdigest(), entry["sha256"]
                )
                self.assertTrue(entry["trained"])
                self.assertFalse(entry["clinical_validation"])

    def test_skin_checkpoints_load_and_predict(self):
        for entry in self.manifest["models"][:2]:
            with self.subTest(model=entry["id"]):
                checkpoint = torch.load(
                    ROOT / entry["artifact"], map_location="cpu", weights_only=True
                )
                self.assertEqual(checkpoint["classes"], PAD_CLASSES)
                self.assertEqual(checkpoint["dataset"], "pad_ufes20")
                self.assertEqual(checkpoint["modality"], "clinical_photo")
                model = build_model(architecture=entry["id"], classes=PAD_CLASSES)
                model.load_state_dict(checkpoint["state_dict"])
                model.eval()
                with torch.inference_mode():
                    scores = torch.softmax(model(torch.zeros(1, 3, 224, 224)), dim=1)
                self.assertEqual(tuple(scores.shape), (1, 6))
                self.assertTrue(torch.isfinite(scores).all())
                self.assertAlmostEqual(float(scores.sum()), 1.0, places=5)

    def test_skin_evaluation_matches_registry(self):
        for entry in self.manifest["models"][:2]:
            with self.subTest(model=entry["id"]):
                evaluation = json.loads((ROOT / entry["evaluation"]).read_text())
                matrix = np.array(evaluation["confusion_matrix"])
                self.assertEqual(matrix.shape, (6, 6))
                self.assertEqual(int(matrix.sum()), 461)
                self.assertAlmostEqual(
                    float(np.trace(matrix) / matrix.sum()), entry["test_accuracy"]
                )
                self.assertEqual(evaluation["test_report"]["MEL"]["support"], 7)
                self.assertEqual(
                    evaluation["data_integrity"]["cross_partition_exact_duplicates"], 0
                )
                self.assertEqual(evaluation["checkpoint_sha256"], entry["sha256"])
                self.assertEqual(evaluation["training"]["best_epoch"], 12)

    def test_lung_weights_and_evaluation(self):
        entry = self.manifest["models"][2]
        model = json.loads((ROOT / entry["artifact"]).read_text())
        evaluation = json.loads((ROOT / entry["evaluation"]).read_text())
        self.assertEqual(np.array(model["coef"]).shape, (4, 97))
        self.assertEqual(len(model["mean"]), 97)
        self.assertEqual(len(model["std"]), 97)
        self.assertTrue(np.all(np.array(model["std"]) > 0))
        self.assertEqual(model["test"]["split"], "patient-level")
        self.assertEqual(model["test"]["patients"], 38)
        self.assertEqual(evaluation["export_prediction_agreement"], 1.0)
        self.assertAlmostEqual(evaluation["icbhi_score"], entry["icbhi_score"])
        self.assertEqual(sum(sum(row) for row in evaluation["confusion_matrix"]), 1459)
        self.assertLess(
            evaluation["classification_report"]["accuracy"],
            evaluation["majority_class_accuracy"],
        )
        self.assertTrue(math.isfinite(entry["test_accuracy"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
