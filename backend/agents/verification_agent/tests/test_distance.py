import unittest
from ..tools.distance_tool import calculate_distance

class TestDistanceCalculation(unittest.TestCase):
    def test_haversine_distance(self):
        # Mumbai to Pune
        lat1, lon1 = 19.0760, 72.8777
        lat2, lon2 = 18.5204, 73.8567
        
        result = calculate_distance(lat1, lon1, lat2, lon2)
        # Expected is ~120 km
        self.assertAlmostEqual(result["distance_km"], 120.8, delta=2.0)
        
    def test_zero_distance(self):
        lat, lon = 19.0760, 72.8777
        result = calculate_distance(lat, lon, lat, lon)
        self.assertEqual(result["distance_km"], 0.0)

if __name__ == '__main__':
    unittest.main()
