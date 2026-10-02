from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required
from app.models import DailyIncome, Expense, CashBalance, Payment, db,OwnerDraw
from sqlalchemy import func
from datetime import datetime
import calendar

finance_bp = Blueprint('finance', __name__, template_folder='templates')

# 1. THE PAGE ROUTE: Loads the empty HTML shell
@finance_bp.route('/finance')
@login_required
def finance_page():
    return render_template('finance/dashboard.html')

# 2. THE API ROUTE: Loads the JSON data
@finance_bp.route('/api/finance/dashboard')
@login_required
def get_finance_dashboard():
    # 1. Cash & Bank
    cash_balance = CashBalance.query.first()
    cash_on_hand = float(cash_balance.cash_on_hand) if cash_balance else 0.0
    bank_account = float(cash_balance.bank_account) if cash_balance else 0.0
    
    # 2. Current Year Totals
    current_year = datetime.now().year
    cy_revenue = db.session.query(func.sum(DailyIncome.amount)).filter(
        func.strftime('%Y', DailyIncome.date) == str(current_year)
    ).scalar() or 0.0
    
    cy_expenses = db.session.query(func.sum(Expense.total_amount)).filter(
        func.strftime('%Y', Expense.date) == str(current_year)
    ).scalar() or 0.0
    
    cy_net_profit = cy_revenue - cy_expenses

    # 3. Monthly Data (Last 24 Months for adjustable charts)
    monthly_data = []
    now = datetime.now()
    for i in range(23, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        
        month_str = f"{y}-{m:02d}"
        month_label = f"{calendar.month_abbr[m]} {y}"
        
        rev = db.session.query(func.sum(DailyIncome.amount)).filter(
            func.strftime('%Y-%m', DailyIncome.date) == month_str
        ).scalar() or 0.0
        
        exp = db.session.query(func.sum(Expense.total_amount)).filter(
            func.strftime('%Y-%m', Expense.date) == month_str
        ).scalar() or 0.0
        
        monthly_data.append({
            "month": month_str,
            "label": month_label,
            "revenue": float(rev),
            "expenses": float(exp),
            "net": float(rev) - float(exp)
        })

    return jsonify({
        "cash_on_hand": cash_on_hand,
        "bank_account": bank_account,
        "total_liquidity": cash_on_hand + bank_account,
        "current_year_revenue": cy_revenue,
        "current_year_expenses": cy_expenses,
        "current_year_net_profit": cy_net_profit,
        "monthly_data": monthly_data
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

@finance_bp.route('/api/finance/cash-balance', methods=['POST'])
@login_required
def update_cash_balance():
    data = request.get_json()
    cash_on_hand = float(data.get('cash_on_hand', 0))
    bank_account = float(data.get('bank_account', 0))

    # Find existing record or create a new one
    balance = CashBalance.query.first()
    if not balance:
        balance = CashBalance(cash_on_hand=cash_on_hand, bank_account=bank_account)
        db.session.add(balance)
    else:
        balance.cash_on_hand = cash_on_hand
        balance.bank_account = bank_account

    db.session.commit()
    return jsonify({"message": "Balance updated successfully"}), 200
    
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

@finance_bp.route('/api/finance/expenses')
@login_required
def get_expenses():
    records = Expense.query.order_by(Expense.date.desc()).all()
    return jsonify([{
        "id": r.id, "date": r.date.strftime('%Y-%m-%d'),
        "date_display": r.date.strftime('%d/%m/%Y'),
        "due_date": r.due_date.strftime('%Y-%m-%d') if r.due_date else '',
        "due_date_display": r.due_date.strftime('%d/%m/%Y') if r.due_date else '-',
        "category": r.category, "supplier": r.supplier,
        "bill_number": r.bill_number, "description": r.description,
        "total_amount": r.total_amount, "paid_amount": r.paid_amount,
        "balance": r.balance, "status": r.status,
        "is_declarable": r.is_declarable, "vat_amount": r.vat_amount,
        "payments": [{"id": p.id, "date": p.date.strftime('%d/%m/%Y'), "amount": p.amount, "note": p.note} for p in r.payments]
    } for r in records])

@finance_bp.route('/api/finance/expenses', methods=['POST'])
@login_required
def save_expense():
    data = request.get_json()
    date_obj = datetime.strptime(data['date'], '%Y-%m-%d').date()
    due_date_obj = datetime.strptime(data['due_date'], '%Y-%m-%d').date() if data.get('due_date') else None
    
    if 'id' in data and data['id']:
        exp = Expense.query.get_or_404(data['id'])
        exp.date, exp.due_date, exp.category = date_obj, due_date_obj, data['category']
        exp.supplier, exp.bill_number, exp.description = data.get('supplier'), data.get('bill_number'), data.get('description')
        exp.total_amount = float(data['total_amount'])
        exp.is_declarable = data.get('is_declarable', True)
        exp.vat_amount = float(data.get('vat_amount', 0))
    else:
        db.session.add(Expense(
            date=date_obj, due_date=due_date_obj, category=data['category'],
            supplier=data.get('supplier'), bill_number=data.get('bill_number'),
            description=data.get('description'), total_amount=float(data['total_amount']),
            is_declarable=data.get('is_declarable', True), vat_amount=float(data.get('vat_amount', 0))
        ))
    db.session.commit()
    return jsonify({"message": "Expense saved"}), 200

@finance_bp.route('/api/finance/expenses/<int:exp_id>', methods=['DELETE'])
@login_required
def delete_expense(exp_id):
    db.session.delete(Expense.query.get_or_404(exp_id))
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200

@finance_bp.route('/api/finance/expenses/<int:exp_id>/payment', methods=['POST'])
@login_required
def add_payment(exp_id):
    exp = Expense.query.get_or_404(exp_id)
    data = request.get_json()
    date_obj = datetime.strptime(data['date'], '%Y-%m-%d').date()
    db.session.add(Payment(expense_id=exp.id, date=date_obj, amount=float(data['amount']), note=data.get('note', '')))
    db.session.commit()
    return jsonify({"message": "Payment added"}), 200

@finance_bp.route('/api/finance/expenses/<int:exp_id>/payment/<int:pay_id>', methods=['DELETE'])
@login_required
def delete_payment(exp_id, pay_id):
    db.session.delete(Payment.query.get_or_404(pay_id))
    db.session.commit()
    return jsonify({"message": "Payment deleted"}), 200

@finance_bp.route('/api/finance/monthly-summary')
@login_required
def get_monthly_summary():
    month_str = request.args.get('month', datetime.now().strftime('%Y-%m'))

    # 1. Income & Expenses for the month
    income = db.session.query(func.sum(DailyIncome.amount)).filter(
        func.strftime('%Y-%m', DailyIncome.date) == month_str
    ).scalar() or 0.0

    expenses = db.session.query(func.sum(Expense.total_amount)).filter(
        func.strftime('%Y-%m', Expense.date) == month_str
    ).scalar() or 0.0

    # 2. NEW: Expense Breakdown by Category (Replaces Excel Rows 7-13)
    breakdown_query = db.session.query(
        Expense.category, func.sum(Expense.total_amount)
    ).filter(
        func.strftime('%Y-%m', Expense.date) == month_str
    ).group_by(Expense.category).all()

    # Format into a list of dictionaries and sort by highest amount
    expense_breakdown = [{"category": row[0], "amount": float(row[1])} for row in breakdown_query]
    expense_breakdown.sort(key=lambda x: x['amount'], reverse=True)

    # 3. VAT Calculations
    vat_deductible = db.session.query(func.sum(Expense.vat_amount)).filter(
        func.strftime('%Y-%m', Expense.date) == month_str,
        Expense.is_declarable == True
    ).scalar() or 0.0

    vat_collected = income * 0.07
    vat_due = vat_collected - vat_deductible

    # 4. The "Caveat" Calculation (Available Liquidity)
    available_draw = income - expenses - vat_due

    # 5. Fetch the Actual Saved Draw for this month
    draw_record = OwnerDraw.query.filter_by(month=month_str).first()
    actual_draw = draw_record.amount if draw_record else 0.0

    return jsonify({
        "month": month_str,
        "income": income,
        "expenses": expenses,
        "net_profit": income - expenses,
        "vat_collected": vat_collected,
        "vat_deductible": vat_deductible,
        "vat_due": vat_due,
        "available_draw": available_draw,
        "actual_draw": actual_draw,
        "expense_breakdown": expense_breakdown # <-- NEW DATA SENT TO FRONTEND
    })
@finance_bp.route('/api/finance/save-draw', methods=['POST'])
@login_required
def save_owner_draw():
    data = request.get_json()
    month_str = data.get('month')
    amount = float(data.get('amount', 0))

    draw_record = OwnerDraw.query.filter_by(month=month_str).first()
    if not draw_record:
        draw_record = OwnerDraw(month=month_str, amount=amount)
        db.session.add(draw_record)
    else:
        draw_record.amount = amount

    db.session.commit()
    return jsonify({"message": "Draw updated successfully"}), 200