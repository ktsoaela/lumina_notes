from django.test import SimpleTestCase

from core.shelf_limits import (
    BOOKS_PER_ROW,
    CHARTS_PER_CABINET_PAGE,
    RAIL_VISIBLE_BAYS,
    SOFT_MAX_CHARTS_PER_UNIT,
    bay_code,
    cabinet_pages_needed,
    chunk_into_rows,
    density_needs_paging,
    page_window,
    rail_pages_needed,
)


class ShelfLimitsTests(SimpleTestCase):
    def test_layout_constants(self):
        self.assertEqual(BOOKS_PER_ROW, 12)
        self.assertEqual(CHARTS_PER_CABINET_PAGE, 96)
        self.assertEqual(RAIL_VISIBLE_BAYS, 8)
        self.assertEqual(SOFT_MAX_CHARTS_PER_UNIT, 480)

    def test_bay_codes_span_many_units(self):
        self.assertEqual(bay_code(0), "A01")
        self.assertEqual(bay_code(25), "Z01")
        self.assertEqual(bay_code(26), "A02")
        self.assertEqual(bay_code(99), "V04")

    def test_chunk_rows_for_thousand_charts(self):
        items = list(range(1000))
        rows = chunk_into_rows(items)
        self.assertEqual(len(rows), 84)  # ceil(1000/12)
        self.assertEqual(len(rows[0]), 12)
        self.assertEqual(len(rows[-1]), 4)

    def test_cabinet_paging_for_1000_charts(self):
        self.assertEqual(cabinet_pages_needed(1000), 11)  # ceil(1000/96)
        self.assertTrue(density_needs_paging(1000))
        self.assertFalse(density_needs_paging(50))

    def test_rail_paging_for_100_bays(self):
        self.assertEqual(rail_pages_needed(100), 13)  # ceil(100/8)
        win = page_window(100, RAIL_VISIBLE_BAYS, 0)
        self.assertEqual(win["start"], 0)
        self.assertEqual(win["end"], 8)
        win_last = page_window(100, RAIL_VISIBLE_BAYS, 12)
        self.assertEqual(win_last["start"], 96)
        self.assertEqual(win_last["end"], 100)

    def test_page_window_clamps(self):
        win = page_window(10, 8, 99)
        self.assertEqual(win["page"], 1)
        self.assertEqual(win["start"], 8)
        self.assertEqual(win["end"], 10)
