"""Wisconsin diagnostic measurements in the original UCI feature order."""
BASE = ['radius','texture','perimeter','area','smoothness','compactness','concavity','concave_points','symmetry','fractal_dimension']
BREAST_FEATURES = [f'{name}_{summary}' for summary in ['mean','se','worst'] for name in BASE]
