import csv
from datetime import datetime
from app import create_app, db
from app.models import DailyIncome, Expense 

app = create_app()

def clean_amount(val):
    """Extracts a clean number from strings like '330 TND', ' - TND ', or '150.50'"""
    if not val:
        return 0.0
    # Remove 'TND', spaces, and dashes, then convert to float
    cleaned = str(val).replace('TND', '').replace('-', '').strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def import_data():
    with app.app_context():
        print("🚀 Starting one-time data import...")
        
        # 1. Use delimiter=';' for European/Tunisian Excel CSVs
        with open('import_data.csv', mode='r', encoding='cp1252') as file:
            reader = csv.DictReader(file, delimiter=';')
            
            # AUTOMATICALLY CLEAN HEADERS: lowercase and strip spaces
            reader.fieldnames = [field.strip().lower() for field in reader.fieldnames if field]
            
            income_count = 0
            expense_count = 0
            
            for row in reader:
                # Safely get the date
                date_str = row.get('date', '').strip()
                if not date_str:
                    continue
                    
                try:
                    # 2. Handle DD/MM/YYYY format specifically
                    row_date = datetime.strptime(date_str, '%d/%m/%Y').date()
                except ValueError:
                    # This catches summary rows like "267" at the bottom of the Excel file
                    print(f"⚠️ Skipping row due to bad date format: '{date_str}' (Likely a total/summary row)")
                    continue

                # Check if it's an Income or Expense based on the columns present
                if 'day_type' in row or 'num_patients' in row or 'amount' in row:
                    amount_val = clean_amount(row.get('amount', 0))
                    patients_val = int(row.get('num_patients', 0) or 0)
                    
                    new_income = DailyIncome(
                        date=row_date,
                        month=row_date.strftime('%Y-%m'), # <-- ADDED: Generates '2026-01'
                        day_type=row.get('day_type', 'Normal'),
                        num_patients=patients_val,
                        amount=amount_val
                    )
                    db.session.add(new_income)
                    income_count += 1
                    
                elif 'category' in row or 'total_amount' in row:
                    is_dec_str = str(row.get('is_declarable', 'false')).strip().lower()
                    is_dec = is_dec_str in ['true', '1', 'yes']
                    
                    new_expense = Expense(
                        date=row_date,
                        month=row_date.strftime('%Y-%m'), # <-- ADDED: Generates '2026-01'
                        due_date=row_date, 
                        category=row.get('category', 'General'),
                        supplier=row.get('supplier', ''),
                        total_amount=clean_amount(row.get('total_amount', 0)),
                        paid_amount=clean_amount(row.get('paid_amount', 0)),
                        is_declarable=is_dec,
                        vat_amount=clean_amount(row.get('vat_amount', 0))
                    )
                    db.session.add(new_expense)
                    expense_count += 1

            db.session.commit()
            print(f"✅ Success! Imported {income_count} Income records and {expense_count} Expense records.")

if __name__ == '__main__':
    import_data()