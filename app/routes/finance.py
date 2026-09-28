from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from app.models import DailyIncome, Expense, CashBalance, db
from sqlalchemy import func
from datetime import datetime

finance_bp = Blueprint('finance', __name__, template_folder='templates')

# 1. THE PAGE ROUTE: Loads the empty HTML shell
@finance_bp.route('/finance')
@login_required
def finance_page():
    return render_template('finance/dashboard.html')

# 2. THE API ROUTE: Sends the JSON data to your JavaScript
@finance_bp.route('/api/finance/dashboard')
@login_required
def get_finance_dashboard():
    # Fetch the LATEST manual balance entry
    latest_balance = CashBalance.query.order_by(CashBalance.date.desc()).first()
    cash_on_hand = latest_balance.cash_on_hand if latest_balance else 0.0
    bank_account = latest_balance.bank_account if latest_balance else 0.0
    total_liquidity = cash_on_hand + bank_account

    # Revenue and Total Expenses
    total_revenue = db.session.query(func.sum(DailyIncome.amount)).scalar() or 0
    total_expenses = db.session.query(func.sum(Expense.total_amount)).scalar() or 0
    
    # Calculate Owner's Draw and Tax separately
    owners_draw = db.session.query(func.sum(Expense.total_amount)).filter(
        Expense.expense_type == "Owner's Draw"
    ).scalar() or 0
    
    tax_payments = db.session.query(func.sum(Expense.total_amount)).filter(
        Expense.expense_type == "Tax/VAT"
    ).scalar() or 0
    
    # Business expenses only
    business_expenses = db.session.query(func.sum(Expense.total_amount)).filter(
        ~Expense.expense_type.in_(["Owner's Draw", "Tax/VAT"])
    ).scalar() or 0
    
    net_profit = total_revenue - business_expenses
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    # Return as JSON!
    return jsonify({
        "cash_on_hand": cash_on_hand,
        "bank_account": bank_account,
        "total_liquidity": total_liquidity,
        "total_revenue": total_revenue,
        "business_expenses": business_expenses,
        "net_profit": net_profit,
        "profit_margin": profit_margin,
        "owners_draw": owners_draw,
        "tax_payments": tax_payments,
        "total_expenses": total_expenses
    })

# 3. THE API UPDATE ROUTE: Saves the balance from JavaScript
@finance_bp.route('/api/finance/update-balance', methods=['POST'])
@login_required
def update_balance_api():
    data = request.get_json()
    new_cash = data.get('cash_on_hand', 0)
    new_bank = data.get('bank_account', 0)
    
    latest = CashBalance.query.order_by(CashBalance.date.desc()).first()
    
    if latest:
        latest.cash_on_hand = new_cash
        latest.bank_account = new_bank
        latest.date = datetime.now().date() 
    else:
        new_balance = CashBalance(
            date=datetime.now().date(), 
            cash_on_hand=new_cash, 
            bank_account=new_bank
        )
        db.session.add(new_balance)
        
    db.session.commit()
    return jsonify({"message": "Balance updated successfully!"}), 200

# ... (keep your existing imports and dashboard routes above this) ...

# 1. GET all income records
@finance_bp.route('/api/finance/income')
@login_required
def get_income():
    records = DailyIncome.query.order_by(DailyIncome.date.desc()).all()
    
    income_data = [{
        "id": record.id,
        "date": record.date.strftime('%Y-%m-%d'), # For the input field
        "date_display": record.date.strftime('%d/%m/%Y'), # For the table display
        "day_type": record.day_type,
        "num_patients": record.num_patients,
        "amount": record.amount
    } for record in records]
    
    return jsonify(income_data)

# 2. POST a new income record (or update if ID is provided)
@finance_bp.route('/api/finance/income', methods=['POST'])
@login_required
def save_income():
    data = request.get_json()
    date_obj = datetime.strptime(data['date'], '%Y-%m-%d').date()
    
    if 'id' in data and data['id']:
        # Update existing
        record = DailyIncome.query.get_or_404(data['id'])
        record.date = date_obj
        record.month = date_obj.month
        record.day_type = data['day_type']
        record.num_patients = int(data['num_patients'])
        record.amount = float(data['amount'])
    else:
        # Create new
        new_record = DailyIncome(
            date=date_obj,
            month=date_obj.month,
            day_type=data['day_type'],
            num_patients=int(data['num_patients']),
            amount=float(data['amount'])
        )
        db.session.add(new_record)
        
    db.session.commit()
    return jsonify({"message": "Income saved successfully!"}), 200

# 3. DELETE an income record
@finance_bp.route('/api/finance/income/<int:record_id>', methods=['DELETE'])
@login_required
def delete_income(record_id):
    record = DailyIncome.query.get_or_404(record_id)
    db.session.delete(record)
    db.session.commit()
    return jsonify({"message": "Income deleted successfully!"}), 200
