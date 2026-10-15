import unittest
from ..tools.ocr_tool import extract_coach_number

class TestOCRCoachVerification(unittest.TestCase):
    def test_exact_match(self):
        result = extract_coach_number("dummy_B4.jpg", "B4")
        self.assertTrue(result["coach_match"])
        self.assertEqual(result["edit_distance"], 0)

    def test_mismatch(self):
        result = extract_coach_number("dummy_B7.jpg", "B4")
        self.assertFalse(result["coach_match"])
        self.assertGreater(result["edit_distance"], 0)

    def test_normalization_replacements(self):
        # 84 instead of B4 -> matches under normalization
        result = extract_coach_number("dummy_84.jpg", "B4")
        self.assertTrue(result["coach_match"])
        self.assertEqual(result["edit_distance"], 0)

        # 53 instead of S3 -> matches under normalization
        result = extract_coach_number("dummy_53.jpg", "S3")
        self.assertTrue(result["coach_match"])
        self.assertEqual(result["edit_distance"], 0)

if __name__ == '__main__':
    unittest.main()
