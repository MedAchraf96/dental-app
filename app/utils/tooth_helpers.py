# app/utils/tooth_helpers.py
import re
from app.models import db, ToothRecord

def update_tooth_chart_on_completion(treatment):
    """Automatically updates the tooth chart state when a treatment is completed."""
    tooth_num = treatment.tooth_number.strip().upper()
    proc_name = treatment.procedure_name.lower()
    
    # Only auto-update for SINGLE teeth (ignore ranges like "13-23" or "FULL MOUTH")
    if not re.match(r'^[1-4][1-8]$', tooth_num):
        return  

    new_state = None
    
    # 1. Fillings / Restorations
    if any(word in proc_name for word in ['cavité', 'composite', 'filling', 'obturation', 'scellement']):
        new_state = 'filled'
    # 2. Extractions
    elif any(word in proc_name for word in ['extraction', 'exo', 'avulsion', 'germectomie']):
        new_state = 'missing'
    # 3. Root Canals
    elif any(word in proc_name for word in ['o.b.c', 'endodontie', 'root canal', 'pulpectomie', 'coiffage']):
        new_state = 'root_canal'
    # 4. Crowns
    elif any(word in proc_name for word in ['couronne', 'crown', 'chape', 'tenon']):
        new_state = 'crown'
    # 5. Implants
    elif 'implant' in proc_name:
        new_state = 'implant'

    # If we found a matching state, update or create the ToothRecord
    if new_state:
        record = ToothRecord.query.filter_by(
            patient_id=treatment.patient_id, 
            tooth_number=tooth_num
        ).first()
        
        if record:
            record.state = new_state
        else:
            new_record = ToothRecord(
                patient_id=treatment.patient_id,
                tooth_number=tooth_num,
                state=new_state
            )
            db.session.add(new_record)