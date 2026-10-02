import csv
from datetime import datetime
from app import create_app, db
from app.models import Expense, Payment

app = create_app()

def clean_amount(val):
    if not val: return 0.0
    cleaned = str(val).replace('TND', '').replace(',', '.').strip()
    try: return float(cleaned)
    except ValueError: return 0.0

def import_expenses():
    with app.app_context():
        print("🚀 Starting final historical expense import...")
        count = 0
        
        with open('expenses_history.csv', mode='r', encoding='cp1252') as file:
            reader = csv.DictReader(file, delimiter=';') 
            
            for row in reader:
                # 1. CLEAN THE ROW: Remove spaces from all column names
                clean_row = {k.strip(): v for k, v in row.items() if k and k.strip()}
                
                date_str = clean_row.get('Day', '').strip()
                if not date_str: continue
                
                try:
                    row_date = datetime.strptime(date_str, '%d/%m/%Y').date()
                except ValueError: continue

                total = clean_amount(clean_row.get('Total', 0))
                if total == 0: continue

                paid = clean_amount(clean_row.get('Paid', 0))
                
                # 2. Create the Expense (DO NOT set paid_amount, it's a @property!)
                new_expense = Expense(
                    date=row_date,
                    due_date=row_date,
                    category=clean_row.get('Type', 'Other'),
                    description=clean_row.get('Description', ''),
                    bill_number=clean_row.get('Bill#', ''),
                    supplier=clean_row.get('Supplier', ''),
                    total_amount=total,
                    is_declarable=False,
                    vat_amount=0.0
                )
                db.session.add(new_expense)
                db.session.flush() # Flush to generate the new_expense.id immediately
                
                # 3. If there was a paid amount, create a Payment record!
                # This ensures the @property paid_amount and status calculate correctly.
                if paid > 0:
                    new_payment = Payment(
                        expense_id=new_expense.id,
                        date=row_date,
                        amount=paid,
                        note="Historical import"
                    )
                    db.session.add(new_payment)
                
                count += 1

            db.session.commit()
            print(f"✅ SUCCESS! Imported {count} historical expenses and payments.")

if __name__ == '__main__':
    import_expenses()