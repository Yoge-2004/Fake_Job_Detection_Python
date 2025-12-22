document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. MATRIX RAIN ---
    const canvas = document.getElementById('matrixCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const alphabet = '01'; 
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = [];
    for(let x = 0; x < columns; x++) drops[x] = 1;

    const draw = () => {
        ctx.fillStyle = 'rgba(5, 8, 10, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0F0';
        ctx.font = fontSize + 'px monospace';
        for(let i = 0; i < drops.length; i++) {
            const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
            ctx.fillStyle = Math.random() > 0.9 ? '#00f3ff' : '#00ff9d';
            ctx.fillText(text, i*fontSize, drops[i]*fontSize);
            if(drops[i]*fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    };
    setInterval(draw, 33);
    window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

    // --- 2. UI TOGGLES ---
    const loginBox = document.querySelector('.login-box');
    const signupBox = document.querySelector('.signup-box');
    
    document.getElementById('showSignup').addEventListener('click', (e) => {
        e.preventDefault();
        loginBox.classList.add('hidden');
        signupBox.classList.remove('hidden');
    });

    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        signupBox.classList.add('hidden');
        loginBox.classList.remove('hidden');
    });

    document.querySelectorAll('.password-toggle').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('.password-field');
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // --- 3. LOGIN LOGIC (UPDATED WITH REMEMBER ME) ---
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('loginUser').value;
        const pass = document.getElementById('loginPass').value;
        const btn = e.target.querySelector('button[type="submit"]');
        
        // GET CHECKBOX STATUS
        const rememberBox = document.getElementById('rememberCheck');
        const remember = rememberBox ? rememberBox.checked : false;

        const originalText = btn.innerText;
        btn.innerText = "AUTHENTICATING...";
        btn.style.background = "var(--neon-green)";
        btn.style.color = "#000";
        btn.disabled = true;

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: user, 
                password: pass,
                remember: remember // Send to backend
            })
        })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                localStorage.setItem('jobGuardUser', data.username);
                window.location.href = '/dashboard';
            } else {
                alert("ACCESS DENIED: " + data.error);
                btn.innerText = "TRY AGAIN";
                btn.style.background = "var(--neon-pink)";
                btn.style.color = "#fff";
                btn.disabled = false;
            }
        })
        .catch(err => {
            console.error(err);
            alert("SERVER ERROR: Could not reach authentication node.");
            btn.innerText = originalText;
            btn.style.background = "";
            btn.disabled = false;
        });
    });

    // --- 4. SIGNUP LOGIC ---
    document.getElementById('signupForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('signupUser').value;
        const email = document.getElementById('signupEmail').value;
        const pass = document.getElementById('signupPass').value;
        const btn = e.target.querySelector('button[type="submit"]');

        btn.innerText = "REGISTERING...";
        btn.style.background = "var(--neon-pink)";
        btn.style.color = "#fff";
        btn.disabled = true;

        fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email, password: pass })
        })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                alert("REGISTRATION SUCCESSFUL. LOGGING IN...");
                localStorage.setItem('jobGuardUser', user);
                window.location.href = '/dashboard';
            } else {
                alert("REGISTRATION FAILED: " + data.error);
                btn.innerText = "REGISTER_UNIT";
                btn.style.background = "";
                btn.disabled = false;
            }
        })
        .catch(err => {
            console.error(err);
            alert("SERVER ERROR: Registration node offline.");
            btn.disabled = false;
        });
    });

    // --- 5. VALIDATION ---
    const sUser = document.getElementById('signupUser');
    const sEmail = document.getElementById('signupEmail');
    const sPass = document.getElementById('signupPass');
    const regBtn = document.getElementById('regBtn');

    const patterns = {
        user: /^[a-zA-Z0-9_]{3,15}$/,
        email: /^([a-z\d\.-]+)@([a-z\d-]+)\.([a-z]{2,8})(\.[a-z]{2,8})?$/, 
        pass: /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/
    };

    function validateField(field, regex, msgElement, errorMsg) {
        if (regex.test(field.value)) {
            field.parentElement.classList.add('valid');
            field.parentElement.classList.remove('invalid');
            msgElement.innerText = ">> VALID";
            msgElement.style.color = "var(--neon-green)";
            return true;
        } else {
            field.parentElement.classList.add('invalid');
            field.parentElement.classList.remove('valid');
            msgElement.innerText = errorMsg;
            msgElement.style.color = "var(--neon-pink)";
            return false;
        }
    }

    function checkFormValidity() {
        if (patterns.user.test(sUser.value) && 
            patterns.email.test(sEmail.value) && 
            patterns.pass.test(sPass.value)) {
            regBtn.removeAttribute('disabled');
            regBtn.style.cursor = "pointer";
        } else {
            regBtn.setAttribute('disabled', 'true');
            regBtn.style.cursor = "not-allowed";
        }
    }

    if(sUser && sEmail && sPass) {
        sUser.addEventListener('input', () => {
            validateField(sUser, patterns.user, document.getElementById('userMsg'), ">> 3-15 CHARS, ALPHANUMERIC");
            checkFormValidity();
        });
        sEmail.addEventListener('input', () => {
            validateField(sEmail, patterns.email, document.getElementById('emailMsg'), ">> INVALID EMAIL FORMAT");
            checkFormValidity();
        });
        sPass.addEventListener('input', () => {
            validateField(sPass, patterns.pass, document.getElementById('passMsg'), ">> 8+ CHARS, 1 NUM, 1 SPECIAL");
            checkFormValidity();
        });
    }
});
