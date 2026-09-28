from flask_login import UserMixin
from datetime import datetime
from .extensions import db

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'dentist', 'assistant', 'secretary'
    name = db.Column(db.String(100))


class Patient(db.Model):

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False, index=True)
    last_name = db.Column(db.String(50), nullable=False, index=True)
    date_of_birth = db.Column(db.Date)
    phone = db.Column(db.String(20), nullable=False, index=True)
    email = db.Column(db.String(120))
    gender = db.Column(db.String(10))
    insurance_provider = db.Column(db.String(100))
    allergies = db.Column(db.Text)
    medical_history = db.Column(db.Text)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))

    # Relationship with appointments
    appointments = db.relationship('Appointment', backref='patient', lazy=True)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    @property
    def age(self):
        if self.date_of_birth:
            today = datetime.today()
            return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
        return None
    
    def __repr__(self):
        return f'<Patient {self.id} - {self.full_name}>'
    
class Appointment(db.Model):
    __tablename__ = 'appointments'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)  # Foreign key to Patient
    dentist_id = db.Column(db.Integer, db.ForeignKey('user.id'))  # Foreign key to User (dentist)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    treatment_type = db.Column(db.String(100), nullable=False)
    notes = db.Column(db.Text)
    status = db.Column(db.String(20), default='scheduled')  # 'scheduled', 'completed', 'cancelled', 'deleted'
    completed_at = db.Column(db.DateTime)
    deleted_at = db.Column(db.DateTime)

    # Relationships
    dentist = db.relationship('User', backref=db.backref('appointments', lazy=True))

    def __init__(self, dentist_id, patient_id, start_time, end_time, treatment_type):
        self.dentist_id = dentist_id
        self.patient_id = patient_id
        self.start_time = start_time
        self.end_time = end_time
        self.treatment_type = treatment_type

    def __repr__(self):
        return f'<Appointment {self.id} - {self.treatment_type}>'

# FINANCIAL MODELS (Merged from Financial App)
# ==========================================

class DailyIncome(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, unique=True)
    month = db.Column(db.Integer, nullable=False)
    day_type = db.Column(db.String(20))
    num_patients = db.Column(db.Integer, default=0)
    amount = db.Column(db.Float, default=0.0)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    expense_type = db.Column(db.String(50))
    description = db.Column(db.String(200))
    bill_number = db.Column(db.String(50))
    supplier = db.Column(db.String(100))
    total_amount = db.Column(db.Float, nullable=False)
    paid_amount = db.Column(db.Float, default=0.0)

class SupplierBill(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bill_number = db.Column(db.String(50))
    supplier = db.Column(db.String(100), nullable=False)
    bill_amount = db.Column(db.Float, nullable=False)
    paid_amount = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='Partial')
    payment_count = db.Column(db.Integer, default=0)
    date = db.Column(db.Date, default=datetime.utcnow)

    @property
    def balance(self):
        return self.bill_amount - self.paid_amount

class LabWork(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, unique=True)
    month = db.Column(db.Integer)
    patient_name = db.Column(db.String(100))
    procedure = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1)
    lab_cost = db.Column(db.Float)
    total_cost = db.Column(db.Float)
    billed_amount = db.Column(db.Float)
    billed_date = db.Column(db.Date)
    collected_amount = db.Column(db.Float)
    discount = db.Column(db.Float, default=0.0)
    remaining = db.Column(db.Float, default=0.0)
    actual_lab_paid = db.Column(db.Float)
    bill_reference = db.Column(db.String(50))

class CashBalance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    cash_on_hand = db.Column(db.Float, default=0.0)
    bank_account = db.Column(db.Float, default=0.0)
    note = db.Column(db.String(200))
