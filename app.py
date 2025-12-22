from flask import Flask, render_template, request, jsonify, session, redirect, url_for, make_response
from sklearn.base import BaseEstimator, TransformerMixin
import joblib
import os
import random
import string
import sqlite3
import re
import numpy as np
from datetime import timedelta
from werkzeug.security import generate_password_hash, check_password_hash

# ==========================================
# 0. SPACY SAFETY IMPORT
# ==========================================
SPACY_AVAILABLE = False
try:
    import spacy
    SPACY_AVAILABLE = True
    print(">> SYSTEM: Spacy library found.")
except ImportError:
    print(">> WARNING: Spacy not installed. Spacy-based models will fail.")

app = Flask(__name__)
app.secret_key = "jobguard_super_secret_key"
app.permanent_session_lifetime = timedelta(days=7) # Session lasts 7 days if "Remember" is checked
DB_NAME = "users.db"

# ==========================================
# 1. CUSTOM CLASSES
# ==========================================

class TextCleaner(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        return self

    def transform(self, X):
        cleaned_text = []
        for text in X:
            text = str(text).lower() if text is not None else ""
            text = re.sub(r'&[a-z]+;', '', text)
            text = re.sub(r'http\S+|www\.\S+', 'token_url', text)
            text = re.sub(r'\S+@\S+', 'token_email', text)
            text = re.sub(r'[^a-z0-9\s\$\%\@\.\,\!]', '', text)
            text = re.sub(r'\s+', ' ', text).strip()
            if not text: text = "token_empty_input"
            cleaned_text.append(text)
        return cleaned_text

class SpacyVectorTransformer(BaseEstimator, TransformerMixin):
    def __init__(self):
        self.nlp = None
        if SPACY_AVAILABLE:
            try:
                self.nlp = spacy.load("en_core_web_md")
            except OSError:
                print(">> WARNING: 'en_core_web_md' not found. Using blank model.")
                self.nlp = spacy.blank("en")

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        if not self.nlp: return np.zeros((len(X), 300))
        docs = list(self.nlp.pipe(X, disable=["ner", "parser"]))
        vectors = [doc.vector if doc.has_vector else np.zeros(300) for doc in docs]
        return np.array(vectors)

# ==========================================
# 2. DATABASE SETUP
# ==========================================
def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        conn.commit()

if not os.path.exists(DB_NAME):
    init_db()

# ==========================================
# 3. INTELLIGENT MODEL LOADING
# ==========================================
model = None

# Priority 1: Spacy Production Model
if os.path.exists('production_fake_job_pipeline.pkl') and SPACY_AVAILABLE:
    try:
        model = joblib.load('production_fake_job_pipeline.pkl')
        print(">> SYSTEM: Loaded PRODUCTION model.")
    except Exception as e:
        print(f">> ERROR: Production model failed ({e}). Falling back...")

# Priority 2: Mobile Model
if model is None and os.path.exists('mobile_model.pkl'):
    try:
        model = joblib.load('mobile_model.pkl')
        print(">> SYSTEM: Loaded MOBILE model.")
    except Exception as e:
        print(f">> ERROR: Mobile model failed ({e}).")

if model is None:
    print(">> WARNING: Running in MOCK MODE.")

# ==========================================
# 4. SECURITY HEADERS (No Cache)
# ==========================================
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# ==========================================
# 5. AUTH ROUTES
# ==========================================
@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'error': 'Missing fields'}), 400

    hashed_pw = generate_password_hash(password, method='pbkdf2:sha256')

    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", (username, email, hashed_pw))
            conn.commit()
        session['user'] = username
        return jsonify({'message': 'Success', 'success': True})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'User already exists.'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    remember = data.get('remember', False) # Checkbox value

    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT password FROM users WHERE username = ?", (username,))
        user_row = cursor.fetchone()

    if user_row and check_password_hash(user_row[0], password):
        session['user'] = username
        # Handle "Remember Me"
        if remember:
            session.permanent = True
        else:
            session.permanent = False
            
        return jsonify({'message': 'Login successful', 'success': True, 'username': username})
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/delete_account', methods=['POST'])
def api_delete_account():
    if 'user' not in session: return jsonify({'error': 'Unauthorized'}), 401
    username = session['user']
    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE username = ?", (username,))
            conn.commit()
        session.clear()
        return jsonify({'success': True, 'message': 'Account deleted.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# 6. PAGE ROUTES
# ==========================================
@app.route('/')
def login_page():
    if 'user' in session: return redirect(url_for('dashboard_page'))
    return render_template('login.html')

@app.route('/dashboard')
def dashboard_page():
    if 'user' not in session: return redirect(url_for('login_page'))
    resp = make_response(render_template('index.html', username=session['user']))
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return resp

@app.route('/predict', methods=['POST'])
def predict():
    if 'user' not in session: return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json()
    text = data.get('text', '')

    if not text: return jsonify({'error': 'Empty data'}), 400

    if model:
        try:
            prediction = model.predict([text])[0]
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba([text])[0]
                confidence = round(max(proba) * 100, 1)
                fake_prob = round(proba[1] * 100, 1)
            else:
                confidence = 95.0
                fake_prob = 100.0 if prediction == 1 else 0.0
            
            return jsonify({'is_fake': bool(prediction == 1), 'confidence': confidence, 'fraud_probability': fake_prob})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        # Mock Mode
        is_fake = any(w in text.lower() for w in ['urgent', 'wire', 'transfer'])
        return jsonify({'is_fake': is_fake, 'confidence': 88.5, 'mode': 'mock'})

if __name__ == '__main__':
    app.run(debug=True)
