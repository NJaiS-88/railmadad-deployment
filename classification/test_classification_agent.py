import unittest

from classification_agent import normalize_department_selection


class TestClassificationRouting(unittest.TestCase):
    def test_allowed_departments_only(self):
        self.assertEqual(
            normalize_department_selection(["Electrical", "Food and Catering", "Ticketing"]),
            ["Electrical", "Commercial/Catering", "Ticket Checking"],
        )

    def test_multi_department_routing(self):
        self.assertEqual(
            normalize_department_selection(["Electrical", "cleanliness", "Mechanical"]),
            ["Electrical", "Cleanliness/Housekeeping", "Mechanical"],
        )

    def test_unknown_department_rejected(self):
        self.assertEqual(
            normalize_department_selection(["Unknown Department"]),
            ["Operations/Train Control"],
        )


if __name__ == "__main__":
    unittest.main()
