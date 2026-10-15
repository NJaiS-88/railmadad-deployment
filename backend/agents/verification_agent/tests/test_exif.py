import unittest
from unittest.mock import MagicMock, patch
from ..tools.exif_tool import extract_exif

class TestExifExtraction(unittest.TestCase):
    @patch('PIL.Image.open')
    def test_missing_exif(self, mock_open):
        mock_img = MagicMock()
        mock_img._getexif.return_value = None
        mock_open.return_value = mock_img
        
        result = extract_exif("dummy.jpg")
        self.assertFalse(result["metadata_available"])
        self.assertIn("No EXIF data found", result["reason"])

    @patch('PIL.Image.open')
    def test_valid_gps_exif(self, mock_open):
        mock_img = MagicMock()
        
        gps_tag_num = 34853
        datetime_tag_num = 36867
        
        mock_img._getexif.return_value = {
            gps_tag_num: {
                1: 'N',
                2: (19.0, 4.0, 33.6),
                3: 'E',
                4: (72.0, 52.0, 39.72),
            },
            datetime_tag_num: "2026:08:15 10:15:30"
        }
        mock_open.return_value = mock_img
        
        result = extract_exif("dummy.jpg")
        self.assertTrue(result["metadata_available"])
        self.assertTrue(result["has_gps"])
        self.assertAlmostEqual(result["latitude"], 19.0760, places=3)
        self.assertAlmostEqual(result["longitude"], 72.8777, places=3)
        self.assertEqual(result["timestamp"], "2026-08-15T10:15:30")

if __name__ == '__main__':
    unittest.main()
