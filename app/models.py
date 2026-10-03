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

# 1. THE LINKING TABLE (This creates the Many-to-Many relationship)
appointment_treatments = db.Table('appointment_treatments',
    db.Column('appointment_id', db.Integer, db.ForeignKey('appointments.id'), primary_key=True),
    db.Column('treatment_id', db.Integer, db.ForeignKey('treatment.id'), primary_key=True)
)

class Appointment(db.Model):
    __tablename__ = 'appointments'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)  # Foreign key to Patient
    dentist_id = db.Column(db.Integer, db.ForeignKey('user.id'))  # Foreign key to User (dentist)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    notes = db.Column(db.Text)
    status = db.Column(db.String(20), default='scheduled')  # 'scheduled', 'completed', 'cancelled', 'deleted'
    completed_at = db.Column(db.DateTime)
    deleted_at = db.Column(db.DateTime)

    # Relationships
    dentist = db.relationship('User', backref=db.backref('appointments', lazy=True))
    treatments = db.relationship('Treatment', secondary=appointment_treatments, back_populates='appointments', lazy='dynamic')

    def __repr__(self):
        return f'<Appointment {self.id} - {self.start_time}>'
    
# 3. THE NEW TREATMENT MODEL (The Clinical Work)
class Treatment(db.Model):
    __tablename__ = 'treatment'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    tooth_number = db.Column(db.String(2), nullable=True) # Null if it's a general cleaning
    procedure_name = db.Column(db.String(100), nullable=False) # e.g., "Composite Filling"
    cost = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='planned') # 'planned', 'in_progress', 'completed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Link back to Appointments
    appointments = db.relationship('Appointment', secondary=appointment_treatments, back_populates='treatments')

    def __repr__(self):
        return f'<Treatment {self.id} - {self.procedure_name}>'
    
class ToothRecord(db.Model):
    __tablename__ = 'tooth_record'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    tooth_number = db.Column(db.String(2), nullable=False)  # e.g., '11', '48'
    state = db.Column(db.String(20), default='healthy')    # 'healthy', 'decayed', 'filled', 'missing'
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Ensure only one record per tooth per patient
    __table_args__ = (db.UniqueConstraint('patient_id', 'tooth_number', name='uq_patient_tooth'),)
    
    patient = db.relationship('Patient', backref=db.backref('tooth_records', lazy=True))

class Prosthetic(db.Model):
    __tablename__ = 'prosthetic'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'bridge', 'partial', 'implant_bridge'
    start_tooth = db.Column(db.String(2), nullable=False)
    end_tooth = db.Column(db.String(2), nullable=False)
    
    patient = db.relationship('Patient', backref=db.backref('prosthetics', lazy=True))
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
    due_date = db.Column(db.Date, nullable=True)
    category = db.Column(db.String(50), nullable=False)
    supplier = db.Column(db.String(100))
    bill_number = db.Column(db.String(50))
    description = db.Column(db.String(200))
    total_amount = db.Column(db.Float, nullable=False)
    is_declarable = db.Column(db.Boolean, default=True)
    vat_amount = db.Column(db.Float, default=0.0)
    
    payments = db.relationship('Payment', backref='expense', lazy=True, cascade="all, delete-orphan")

    @property
    def paid_amount(self):
        return sum(p.amount for p in self.payments)

    @property
    def balance(self):
        return self.total_amount - self.paid_amount

    @property
    def status(self):
        if self.paid_amount >= self.total_amount: return 'Paid'
        if self.paid_amount > 0: return 'Partial'
        return 'Unpaid'

class Payment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    expense_id = db.Column(db.Integer, db.ForeignKey('expense.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    note = db.Column(db.String(100))

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

class OwnerDraw(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.String(7), unique=True, nullable=False)  # Stores 'YYYY-MM'
    amount = db.Column(db.Float, default=0.0)