import unittest
from unittest.mock import patch, MagicMock
from ..agent import verify_complaint_evidence
from ..schemas import VerificationResponse

class TestVerificationAgentPipeline(unittest.TestCase):
    @patch('verification_agent.agent.extract_exif')
    @patch('verification_agent.agent.get_train_position')
    def test_full_pipeline_verified(self, mock_get_position, mock_extract_exif):
        # Setup mocks for GREEN scenario
        mock_extract_exif.return_value = {
            "has_gps": True,
            "latitude": 19.0760,
            "longitude": 72.8777,
            "timestamp": "2026-08-15T10:15:30",
            "metadata_available": True
        }
        
        mock_get_position.return_value = {
            "train_number": "12247",
            "timestamp": "2026-08-15T10:15:30",
            "latitude": 19.0750,
            "longitude": 72.8750,
            "source": "mock_train_position",
            "interpolated": True
        }
        
        # Test agent execution
        result = verify_complaint_evidence(
            image_path="dummy_B4.jpg",
            train_number="12247",
            coach="B4"
        )
        
        self.assertIsInstance(result, VerificationResponse)
        self.assertEqual(result.verification_status, "VERIFIED")
        self.assertEqual(result.risk_level, "GREEN")
        self.assertFalse(result.human_review_required)
        self.assertTrue(result.location_match)
        self.assertTrue(result.ocr.coach_match)

if __name__ == '__main__':
    unittest.main()
