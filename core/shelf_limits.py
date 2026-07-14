"""
Storage-scale limits mirrored for Django/admin tests and docs.
Keep in sync with src/lib/shelfLayout.ts (frontend source of truth for UI).
"""

BOOKS_PER_ROW = 12
MAX_VISIBLE_ROWS = 8
CHARTS_PER_CABINET_PAGE = BOOKS_PER_ROW * MAX_VISIBLE_ROWS  # 96
SOFT_MAX_CHARTS_PER_UNIT = 480
RAIL_VISIBLE_BAYS = 8


def bay_code(index: int) -> str:
    if index < 0:
        return "??"
    letter = chr(65 + (index % 26))
    n = index // 26 + 1
    return f"{letter}{n:02d}"


def chunk_into_rows(items: list, per_row: int = BOOKS_PER_ROW) -> list[list]:
    if per_row <= 0:
        raise ValueError("per_row must be > 0")
    if not items:
        return []
    return [items[i : i + per_row] for i in range(0, len(items), per_row)]


def page_window(total: int, page_size: int, page: int) -> dict:
    if page_size <= 0:
        raise ValueError("page_size must be > 0")
    page_count = max(1, (total + page_size - 1) // page_size if total else 1)
    safe_page = min(max(0, page), page_count - 1)
    start = safe_page * page_size
    end = min(total, start + page_size)
    return {
        "page": safe_page,
        "page_count": page_count,
        "start": start,
        "end": end,
    }


def cabinet_pages_needed(chart_count: int) -> int:
    if chart_count <= 0:
        return 1
    return (chart_count + CHARTS_PER_CABINET_PAGE - 1) // CHARTS_PER_CABINET_PAGE


def rail_pages_needed(bay_count: int) -> int:
    if bay_count <= 0:
        return 1
    return (bay_count + RAIL_VISIBLE_BAYS - 1) // RAIL_VISIBLE_BAYS


def density_needs_paging(chart_count: int) -> bool:
    return chart_count > CHARTS_PER_CABINET_PAGE
