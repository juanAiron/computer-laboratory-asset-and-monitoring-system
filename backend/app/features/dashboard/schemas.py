from pydantic import BaseModel


class DashboardStatsResponse(BaseModel):
    total_assets: int
    available_assets: int
    borrowed_assets: int
    under_repair_assets: int
    overdue_borrows: int
    low_stock_consumables: int
    active_students_in_labs: int
    open_repair_tickets: int