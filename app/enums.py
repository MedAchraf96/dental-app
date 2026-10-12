# app/enums.py
from enum import StrEnum, IntEnum

# --- Clinical & Dental ---
class ToothState(StrEnum):
    HEALTHY = "healthy"
    DECAYED = "decayed"
    FILLED = "filled"
    MISSING = "missing"
    IMPLANT = "implant"
    CROWN = "crown"
    ROOT_CANAL = "root_canal"

class ProstheticType(StrEnum):
    BRIDGE = "bridge"
    PARTIAL = "partial"
    IMPLANT_BRIDGE = "implant_bridge"
    FULL_UPPER = "full_upper"
    FULL_LOWER = "full_lower"

class TreatmentStatus(StrEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    SCHEDULED = "scheduled" # Added based on calendar logic
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TreatmentScope(StrEnum):
    SINGLE = "single"
    RANGE = "range"
    FULL_UPPER = "FULL UPPER"
    FULL_LOWER = "FULL LOWER"
    FULL_MOUTH = "FULL MOUTH"

# --- User & Appointments ---
class UserRole(StrEnum):
    ADMIN = "admin"
    DENTIST = "dentist"
    ASSISTANT = "assistant"
    SECRETARY = "secretary"

class AppointmentStatus(StrEnum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DELETED = "deleted"

class Gender(StrEnum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

# --- Financial ---
class ExpenseCategory(StrEnum):
    FIXED_EXPENSES = "Fixed Expenses"
    CONSUMABLES = "Consumables"
    MEDICAL_SUPPLIES = "Medical Supplies"
    ETC = "ETC"
    OWNERS_DRAW = "Owner's Draw"
    TAX_VAT = "Tax/VAT"
    OTHER = "Other"

class PaymentStatus(StrEnum):
    PAID = "Paid"
    PARTIAL = "Partial"
    UNPAID = "Unpaid"

class IncomeDayType(StrEnum):
    WORKING_DAY = "Working Day"
    HOLIDAY = "Holiday"
    LEAVE = "Leave"
    SUNDAY = "Sunday"
    REMPLACANT = "Remplaçant"

class TransactionType(StrEnum):
    INVOICE = "invoice"
    PAYMENT = "payment"

# --- Utility ---
class FlashCategory(StrEnum):
    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

class AppointmentDuration(IntEnum):
    MIN_15 = 15
    MIN_30 = 30
    MIN_45 = 45
    MIN_60 = 60
    MIN_75 = 75
    MIN_90 = 90
    MIN_105 = 105
    MIN_120 = 120