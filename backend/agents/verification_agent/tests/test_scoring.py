import unittest
from ..tools.scoring_tool import calculate_suspicion

class TestScoringAndRiskLevels(unittest.TestCase):
    def test_combined_green(self):
        # Both location and coach match
        result = calculate_suspicion(
            location_available=True,
            location_match=True,
            coach_available=True,
            coach_match=True,
            distance_km=1.2
        )
        self.assertEqual(result["risk_level"], "GREEN")
        self.assertEqual(result["suspicion_score"], 0.0)
        self.assertFalse(result["human_review_required"])

    def test_combined_yellow(self):
        # Coach mismatch only (weight 0.4)
        result = calculate_suspicion(
            location_available=True,
            location_match=True,
            coach_available=True,
            coach_match=False,
            distance_km=1.2
        )
        self.assertEqual(result["risk_level"], "YELLOW")
        self.assertEqual(result["suspicion_score"], 0.4)
        self.assertTrue(result["human_review_required"])

    def test_combined_red(self):
        # Location mismatch only (weight 0.6)
        result = calculate_suspicion(
            location_available=True,
            location_match=False,
            coach_available=True,
            coach_match=True,
            distance_km=340.0
        )
        self.assertEqual(result["risk_level"], "RED")
        self.assertEqual(result["suspicion_score"], 0.6)
        self.assertTrue(result["human_review_required"])
        
        # Both mismatch (weight 1.0)
        result_both = calculate_suspicion(
            location_available=True,
            location_match=False,
            coach_available=True,
            coach_match=False,
            distance_km=340.0
        )
        self.assertEqual(result_both["risk_level"], "RED")
        self.assertEqual(result_both["suspicion_score"], 1.0)
        self.assertTrue(result_both["human_review_required"])

if __name__ == '__main__':
    unittest.main()
