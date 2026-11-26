from app.features.assets.models import Asset, Category  # noqa: F401
from app.features.borrow.models import Borrow  # noqa: F401
from app.features.consumables.models import Consumable, StockMovement  # noqa: F401
from app.features.counts.models import CountItem, InventoryCount  # noqa: F401
from app.features.labs.models import LabRoom, LabStation  # noqa: F401
from app.features.repairs.models import RepairTicket  # noqa: F401
from app.features.sessions.models import ClassSchedule, LabSession, StationLog  # noqa: F401
from app.features.users.models import User  # noqa: F401
from app.shared.audit import AuditLog, Base  # noqa: F401