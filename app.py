import os
import logging
from flask import Flask, render_template, render_template_string, request, redirect, session, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

# ADD BELOW THIS LINE - Load local environment variables
load_dotenv()

# ADD BELOW THIS LINE - Supabase helpers
from supabase_client import insert_booking, insert_admin, update_admin, delete_admin as delete_admin_supabase

app = Flask(__name__)
app.secret_key = "secret123"

# ADD BELOW THIS LINE - Basic production-safe logging
logging.basicConfig(level=logging.INFO)

# =========================
# DATABASE FIX (LOCAL + VERCEL)
# =========================
if os.environ.get("VERCEL"):
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:////tmp/database.db'
else:
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


# ADD BELOW THIS LINE - Booking payload validation helpers
def get_booking_payload(data):
    return {
        "name": data.get('name', '').strip(),
        "phone": data.get('phone', '').strip(),
        "service": data.get('service', '').strip(),
        "date": data.get('date', '').strip(),
        "time": data.get('time', '').strip(),
        "status": "Pending"
    }


def is_valid_booking_payload(payload):
    required_fields = ["name", "phone", "service", "date", "time"]
    return all(payload.get(field) for field in required_fields)

# =========================
# DATABASE MODELS
# =========================
class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(200))
    role = db.Column(db.String(20), default="admin")

class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    service = db.Column(db.String(100))
    date = db.Column(db.String(20))
    time = db.Column(db.String(20))
    status = db.Column(db.String(20), default="Pending")

# =========================
# LANGUAGE
# =========================
@app.before_request
def set_default_language():
    if 'lang' not in session:
        session['lang'] = 'en'

translations = {
    "en": {
        "title": "Home Services",
        "book": "Book Now",
        "name": "Name",
        "phone": "Phone",
        "service": "Service"
    },
    "ar": {
        "title": "خدمات المنزل",
        "book": "احجز الآن",
        "name": "الاسم",
        "phone": "الهاتف",
        "service": "الخدمة"
    }
}

# =========================
# ROUTES
# =========================

@app.route('/')
def home():
    lang = session.get('lang', 'en')
    texts = translations[lang]
    # ADD BELOW THIS LINE - Supabase frontend config
    # ADD BELOW THIS LINE - Serve root index.html through Jinja
    try:
        basedir = os.path.abspath(os.path.dirname(__file__))
        with open(os.path.join(basedir, 'index.html'), 'r', encoding='utf-8') as f:
            html = f.read()
        return render_template_string(
            html,
            texts=texts,
            supabase_url=os.environ.get("SUPABASE_URL", ""),
            supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY", "")
        )
    except Exception as error:
        app.logger.exception("Failed to render index.html: %s", error)
        return "Error: Failed to load homepage."

@app.route('/book', methods=['POST'])
def book():
    try:
        data = request.form
        # ADD BELOW THIS LINE - Minimal payload validation
        booking_payload = get_booking_payload(data)
        if not is_valid_booking_payload(booking_payload):
            app.logger.warning("Rejected booking with missing required fields.")
            return redirect(url_for('home', booking='error', reason='missing') + '#booking')

        # ADD BELOW THIS LINE - Supabase mirror
        try:
            insert_booking(booking_payload)
        except Exception as supabase_error:
            app.logger.exception("Supabase booking mirror failed: %s", supabase_error)
        new_booking = Booking(
            name=data['name'],
            phone=data['phone'],
            service=data['service'],
            date=data['date'],
            time=data['time']
        )
        db.session.add(new_booking)
        db.session.commit()
        return redirect(url_for('home', booking='success') + '#booking')
    except Exception as e:
        app.logger.exception("Booking submission failed: %s", e)
        return redirect(url_for('home', booking='error', reason='server') + '#booking')

@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        admin = Admin.query.filter_by(username=username).first()

        if admin and check_password_hash(admin.password, password):
            session['admin'] = True
            session['admin_id'] = admin.id
            session['role'] = admin.role
            return redirect('/dashboard')
        else:
            flash("Invalid credentials!", "danger")

    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    if 'admin' not in session:
        return redirect('/admin')

    bookings = Booking.query.all()
    admins = Admin.query.all()

    for b in bookings:
        try:
            dt = datetime.strptime(b.time, "%H:%M")
            b.time = dt.strftime("%I:%M %p")
        except:
            pass

    total_bookings = len(bookings)
    today_bookings = len([b for b in bookings if b.date == date.today().strftime("%Y-%m-%d")])
    pending = len([b for b in bookings if b.status == "Pending"])
    accepted = len([b for b in bookings if b.status == "Accepted"])

    return render_template('admin.html',
                           bookings=bookings,
                           admins=admins,
                           total_bookings=total_bookings,
                           today_bookings=today_bookings,
                           pending=pending,
                           accepted=accepted)

@app.route('/accept/<int:id>')
def accept_booking(id):
    booking = Booking.query.get(id)
    if booking:
        booking.status = "Accepted"
        db.session.commit()
    return redirect('/dashboard')

@app.route('/delete_booking/<int:id>')
def delete_booking(id):
    booking = Booking.query.get(id)
    if booking:
        db.session.delete(booking)
        db.session.commit()
    return redirect('/dashboard')

@app.route('/add_admin', methods=['POST'])
def add_admin():
    if 'admin' not in session or session['role'] != 'main':
        flash("Only Main Admin can add admins", "danger")
        return redirect('/dashboard')

    username = request.form['username']
    password = generate_password_hash(request.form['password'])
    role = request.form.get('role', 'admin')

    new_admin = Admin(username=username, password=password, role=role)
    db.session.add(new_admin)
    db.session.commit()

    # ADD BELOW THIS LINE - Supabase mirror
    try:
        insert_admin({
            "sqlite_id": new_admin.id,
            "username": new_admin.username,
            "password": new_admin.password,
            "role": new_admin.role
        })
    except Exception as supabase_error:
        app.logger.exception("Supabase admin insert mirror failed: %s", supabase_error)

    return redirect('/dashboard')

@app.route('/delete_admin/<int:id>')
def delete_admin(id):
    if 'admin' not in session or session['role'] != 'main':
        flash("Only Main Admin can delete admins", "danger")
        return redirect('/dashboard')

    admin = Admin.query.get(id)
    if admin and admin.role != 'main':
        # ADD BELOW THIS LINE - Supabase mirror
        try:
            delete_admin_supabase(admin.id)
        except Exception as supabase_error:
            app.logger.exception("Supabase admin delete mirror failed: %s", supabase_error)
        db.session.delete(admin)
        db.session.commit()

    return redirect('/dashboard')

@app.route('/change_main_admin', methods=['POST'])
def change_main_admin():
    if 'admin' not in session or session['role'] != 'main':
        flash("Only Main Admin can change credentials", "danger")
        return redirect('/dashboard')

    main_admin = Admin.query.filter_by(role='main').first()
    if main_admin:
        main_admin.username = request.form['username']
        main_admin.password = generate_password_hash(request.form['password'])
        db.session.commit()

        # ADD BELOW THIS LINE - Supabase mirror
        try:
            update_admin(main_admin.id, {
                "username": main_admin.username,
                "password": main_admin.password,
                "role": main_admin.role
            })
        except Exception as supabase_error:
            app.logger.exception("Supabase admin update mirror failed: %s", supabase_error)

    return redirect('/dashboard')

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/admin')

@app.route('/set_language/<lang>')
def set_language(lang):
    session['lang'] = lang
    return redirect(request.referrer or '/')

# =========================
# CREATE DATABASE
# =========================
with app.app_context():
    db.create_all()

    if not Admin.query.filter_by(role='main').first():
        main_admin = Admin(
            username="admin",
            password=generate_password_hash("1234"),
            role="main"
        )
        db.session.add(main_admin)
        db.session.commit()

    # ADD BELOW THIS LINE - Supabase admin bootstrap sync
    try:
        admins = Admin.query.all()
        for admin in admins:
            insert_admin({
                "sqlite_id": admin.id,
                "username": admin.username,
                "password": admin.password,
                "role": admin.role
            })
    except Exception as supabase_error:
        app.logger.exception("Supabase admin bootstrap sync failed: %s", supabase_error)

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True)
