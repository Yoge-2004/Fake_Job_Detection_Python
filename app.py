import warnings
# warnings.filterwarnings("ignore") 

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, g
from sklearn.base import BaseEstimator, TransformerMixin
import joblib
import os
import re
import numpy as np
import sqlite3
import sys
import traceback
import sklearn
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "jobguard_super_secret_key"
app.permanent_session_lifetime = timedelta(days=30) # Default limit for Remember Me
DB_NAME = "users.db"

# ==========================================
# 0. OPTIMIZATIONS (Pre-compiled Regex)
# ==========================================
# Compiling regex once at startup is faster
REGEX_LONG_STRING = re.compile(r'\S{40,}')
REGEX_REPEATED_CHARS = re.compile(r'(.)\1{4,}')
REGEX_CONSONANT_SMASH = re.compile(r'[aeiouy]') # Checks for Vowels
REGEX_HTTP = re.compile(r'http\S+|www\.\S+')
REGEX_EMAIL = re.compile(r'\S+@\S+')
REGEX_SPECIAL_CHARS = re.compile(r'[^a-z0-9\s\$\%\@\.\,\!]')
REGEX_SPACES = re.compile(r'\s+')
REGEX_WORD_TOKEN = re.compile(r'\w+')

SERVER_LOGS = []

def log_debug(message, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = f"[{timestamp}] {level}: {message}"
    SERVER_LOGS.append(entry)
    if len(SERVER_LOGS) > 100: SERVER_LOGS.pop(0)
    print(entry, flush=True)

# ==========================================
# 1. CUSTOM CLASSES (Training Aligned + Optimized)
# ==========================================

class TextCleaner(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None): return self

    def transform(self, X):
        cleaned = []
        for text in X:
            text = str(text).lower() if text else ""
            # Regex cleaning (Matches Training Logic)
            text = REGEX_HTTP.sub('token_url', text)
            text = REGEX_EMAIL.sub('token_email', text)
            text = REGEX_SPECIAL_CHARS.sub('', text)
            text = REGEX_SPACES.sub(' ', text).strip()
            cleaned.append(text if text else "token_empty_input")
        return cleaned

class SpacyVectorTransformer(BaseEstimator, TransformerMixin):
    def __init__(self, nlp=None):
        self.nlp = nlp

    def fit(self, X, y=None): return self

    def transform(self, X):
        # OPTIMIZATION: Check if we already processed this in the route
        # 'g.spacy_doc' holds the pre-calculated doc for the current request
        if hasattr(g, 'spacy_doc') and g.spacy_doc is not None:
             # Only valid if processing single input (Real-time mode)
            if len(X) == 1:
                doc = g.spacy_doc
                return np.array([doc.vector if doc.has_vector else np.zeros(300)])

        # Fallback for batch processing or if 'g' is missing
        if self.nlp is None:
            if 'nlp_engine' in globals() and nlp_engine:
                self.nlp = nlp_engine
            else:
                return np.zeros((len(X), 300))
        
        docs = list(self.nlp.pipe(X, disable=["ner", "parser"]))
        return np.array([doc.vector if doc.has_vector else np.zeros(300) for doc in docs])

if __name__ != '__main__':
    sys.modules['__main__'] = sys.modules[__name__]

# ==========================================
# 2. LOAD RESOURCES
# ==========================================
SPACY_AVAILABLE = False
nlp_engine = None

try:
    import spacy
    try:
        # 1. Try LARGE Model (Best Accuracy)
        nlp_engine = spacy.load("en_core_web_lg")
        SPACY_AVAILABLE = True
        log_debug("Spacy 'lg' (Large 3.8.0) loaded. Max Accuracy.", "SUCCESS")
    except:
        try:
            # 2. Fallback to MEDIUM
            nlp_engine = spacy.load("en_core_web_md")
            SPACY_AVAILABLE = True
            log_debug("Spacy 'lg' missing. Loaded 'md'.", "WARN")
        except:
            # 3. Fallback to SMALL
            try:
                nlp_engine = spacy.load("en_core_web_sm")
                SPACY_AVAILABLE = True
                log_debug("Spacy 'sm' loaded (Low Accuracy).", "WARN")
            except:
                nlp_engine = spacy.blank("en")
                log_debug("Spacy failed. Using Blank.", "ERROR")
except ImportError:
    log_debug("Spacy Not Installed.", "ERROR")

model = None
MODEL_FILE = 'production_fake_job_pipeline.pkl'

if os.path.exists(MODEL_FILE):
    try:
        model = joblib.load(MODEL_FILE)
        
        # INJECT SPACY
        def inject(est):
            if isinstance(est, SpacyVectorTransformer): 
                est.nlp = nlp_engine
                return True
            if hasattr(est, 'steps'): [inject(s[1]) for s in est.steps]
            if hasattr(est, 'transformer_list'): [inject(s[1]) for s in est.transformer_list]
            if hasattr(est, 'estimator'): inject(est.estimator)
        
        inject(model)
        log_debug("AI Model Loaded & Optimized.", "SUCCESS")
    except Exception as e:
        log_debug(f"Model Load Failed: {str(e)}", "ERROR")
else:
    log_debug("Model file missing.", "WARN")

# ==========================================
# 3. PREDICTION LOGIC (One-Pass Loop)
# ==========================================
@app.route('/predict', methods=['POST'])
def predict():
    current_user = session.get('user', '')
    is_admin = (current_user == 'Yoge')
    
    current_request_logs = []
    def req_log(msg, lvl="INFO"):
        log_debug(msg, lvl)
        if is_admin: current_request_logs.append(f"[{lvl}] {msg}")

    if not current_user: return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        text_lower = text.lower()
        if not text: return jsonify({'error': 'Empty data'}), 400

        # Reset Global Spacy Doc for this request
        g.spacy_doc = None

        is_gibberish = False
        reasons = []

        # --- A. REGEX CHECKS ---
        if REGEX_LONG_STRING.search(text) and "http" not in text:
            is_gibberish = True
            reasons.append("🚫 **Input Error:** Suspicious long strings detected.")
        
        if REGEX_REPEATED_CHARS.search(text_lower):
            is_gibberish = True
            reasons.append("🚫 **Gibberish:** Repetitive characters detected.")

        if not is_gibberish:
            # Check Consonant Smash
            words_raw = text_lower.split()
            for w in words_raw:
                if len(w) > 6 and not REGEX_CONSONANT_SMASH.search(w) and "http" not in w:
                    is_gibberish = True
                    req_log(f"Consonant Smash Detected: {w}", "WARN")
                    reasons.append("🚫 **Gibberish:** Random key-mashing detected.")
                    break

        # --- B. OPTIMIZED SPACY PROCESSING (One Pass) ---
        if not is_gibberish:
            total_words = 0
            valid_words = 0
            
            if SPACY_AVAILABLE and nlp_engine:
                # RUN SPACY ONCE HERE
                doc = nlp_engine(text)
                
                # STORE IN GLOBAL CONTEXT FOR PIPELINE REUSE
                g.spacy_doc = doc 
                
                # Single Pass Counting
                for t in doc:
                    if t.is_alpha:
                        total_words += 1
                        # t.has_vector uses the LARGE model's 500k vocab
                        if t.has_vector:
                            valid_words += 1
            else:
                # Fallback Regex
                words = REGEX_WORD_TOKEN.findall(text_lower)
                total_words = len(words)
                valid_words = total_words # Skip check

            ratio = valid_words / total_words if total_words > 0 else 0
            req_log(f"Stats: {valid_words}/{total_words} words (Ratio: {ratio:.2f})", "DEBUG")
            
            # --- DYNAMIC RULES ---
            if total_words > 0 and total_words < 5:
                if ratio < 0.75: # Short text needs high accuracy
                    is_gibberish = True
                    reasons.append("🚫 **Unknown Data:** Short text must be valid English.")

            elif 5 <= total_words <= 20:
                if ratio < 0.5:
                    is_gibberish = True
                    reasons.append("🚫 **Gibberish:** Text contains mostly random words.")

            elif total_words > 20:
                if ratio < 0.3:
                    is_gibberish = True
                    reasons.append("🚫 **Gibberish:** Text structure is incoherent.")
            
            if total_words > 0 and valid_words == 0:
                is_gibberish = True
                reasons.append("🚫 **Unknown Data:** AI cannot recognize this language.")

        # --- C. PREDICTION ---
        result = {}
        if is_gibberish:
            result = {'fraud_probability': 100.0, 'reasons': reasons, 'is_gibberish': True}
            req_log("Blocked as Gibberish", "WARN")
            
        elif model:
            # SpacyVectorTransformer uses 'g.spacy_doc' -> Instant Result
            proba = model.predict_proba([text])[0]
            fake_prob = proba[1]
            req_log(f"Base AI Score: {fake_prob:.4f}", "INFO")
            
            human_reasons = []
            override_active = False

            # CRITICAL KEYWORDS
            critical_triggers = {
                "telegram": "🚨 **CRITICAL:** 'Telegram' is used 99% by scammers.",
                "whatsapp": "🚨 **CRITICAL:** 'WhatsApp' interview request detected.",
                "kindly deposit": "💸 **FRAUD:** 'Kindly deposit' is a known scam phrase.",
                "check to purchase": "💸 **FRAUD:** Fake Equipment Check Scam detected.",
                "send a check": "💸 **FRAUD:** Fake Check Scam detected."
            }

            for key, reason in critical_triggers.items():
                if key in text_lower:
                    fake_prob = 0.99 
                    human_reasons.append(reason)
                    override_active = True

            if not override_active:
                if "@gmail.com" in text_lower or "@yahoo.com" in text_lower:
                    fake_prob += 0.30 
                    human_reasons.append("⚠️ **Suspicious:** Using personal email for corporate role.")
                if "urgent" in text_lower or "immediate" in text_lower:
                    fake_prob += 0.10
                    human_reasons.append("⚠️ **Urgency:** Scammers often create fake urgency.")

            fake_prob = min(max(fake_prob, 0.0), 1.0)

            if fake_prob > 0.8:
                if not human_reasons: human_reasons.append("🤖 **AI Verdict:** Highly suspicious pattern detected.")
            elif fake_prob > 0.5:
                if not human_reasons: human_reasons.append("🤖 **AI Verdict:** Text resembles known scam templates.")
            else:
                human_reasons.append("✅ **System Clean:** No known threats detected.")

            req_log(f"Final Risk Score: {fake_prob:.4f}", "SUCCESS")
            result = {'fraud_probability': round(fake_prob * 100, 2), 'reasons': human_reasons, 'is_gibberish': False}
        else:
            result = {'fraud_probability': 0, 'reasons': ["Mock Mode"], 'is_gibberish': False}

        result['system_logs'] = list(reversed(SERVER_LOGS)) if is_admin else None
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# 4. AUTH & DB
# ==========================================
def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        conn.cursor().execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL, password TEXT NOT NULL)''')
if not os.path.exists(DB_NAME): init_db()

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response

@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.get_json()
    hashed = generate_password_hash(data.get('password'))
    try:
        with sqlite3.connect(DB_NAME) as conn:
            conn.cursor().execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
                                (data.get('username'), data.get('email'), hashed))
        session['user'] = data.get('username')
        session.permanent = True # Signups get remembered by default for UX
        return jsonify({'success': True, 'username': data.get('username')})
    except: return jsonify({'error': 'User exists'}), 409

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    with sqlite3.connect(DB_NAME) as conn:
        row = conn.cursor().execute("SELECT password FROM users WHERE username = ?", (data.get('username'),)).fetchone()
    
    if row and check_password_hash(row[0], data.get('password')):
        session['user'] = data.get('username')
        
        # REMEMBER ME LOGIC
        if data.get('remember'):
            session.permanent = True # Lasts 30 days
        else:
            session.permanent = False # Clears on browser close
            
        return jsonify({'success': True, 'username': data.get('username')})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def api_logout(): session.clear(); return jsonify({'success': True})

@app.route('/api/delete_account', methods=['POST'])
def api_delete_account():
    with sqlite3.connect(DB_NAME) as conn:
        conn.cursor().execute("DELETE FROM users WHERE username = ?", (session.get('user'),))
    session.clear()
    return jsonify({'success': True})

@app.route('/')
def login_page():
    if 'user' in session: return redirect(url_for('dashboard_page'))
    return render_template('login.html')

@app.route('/dashboard')
def dashboard_page():
    if 'user' not in session: return redirect(url_for('login_page'))
    return render_template('index.html', username=session['user'])

if __name__ == '__main__':
    app.run(debug=True)
