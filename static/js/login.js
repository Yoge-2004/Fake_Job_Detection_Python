document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. MATRIX RAIN (RESPONSIVE FIX)
    // ==========================================
    const canvas = document.getElementById('matrixCanvas');
    const ctx = canvas.getContext('2d');
    
    const fontSize = 14;
    const alphabet = '01'; 
    let columns = 0;
    let drops = [];

    function initMatrix() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        columns = Math.floor(canvas.width / fontSize);
        drops = [];
        for(let x = 0; x < columns; x++) {
            drops[x] = Math.floor(Math.random() * -100); 
        }
    }

    const draw = () => {
        ctx.fillStyle = 'rgba(5, 8, 10, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0F0';
        ctx.font = fontSize + 'px monospace';

        for(let i = 0; i < drops.length; i++) {
            const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
            ctx.fillStyle = Math.random() > 0.9 ? '#00f3ff' : '#00ff9d';
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if(drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    };

    initMatrix();
    setInterval(draw, 33);
    window.addEventListener('resize', initMatrix); // ⚡ FIX: Recalculate on rotation

    // ==========================================
    // 2. UI TOGGLES
    // ==========================================
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

    // ==========================================
    // 3. LOGIN LOGIC (UX ENHANCED)
    // ==========================================
    const loginForm = document.getElementById('loginForm');
    const loginUser = document.getElementById('loginUser');
    const loginPass = document.getElementById('loginPass');
    
    // Helper to find the button inside the form
    const loginBtn = loginForm.querySelector('button[type="submit"]');
    const btnText = loginBtn.querySelector('.btn-text');

    // FUNCTION: Reset Button to Initial State
    function resetLoginState() {
        if (loginBtn.disabled || loginBtn.style.borderColor === "var(--neon-pink)") {
            loginBtn.disabled = false;
            loginBtn.style.borderColor = "var(--neon-cyan)";
            loginBtn.style.background = "transparent";
            loginBtn.style.color = "var(--neon-cyan)";
            loginBtn.style.boxShadow = "none";
            btnText.innerText = "INITIATE UPLINK";
            loginBtn.style.cursor = "pointer";
        }
    }

    // LISTENER: Reset state when user modifies text (⚡ FIX for UX)
    loginUser.addEventListener('input', resetLoginState);
    loginPass.addEventListener('input', resetLoginState);

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = loginUser.value;
        const pass = loginPass.value;
        
        const rememberBox = document.getElementById('rememberCheck');
        const remember = rememberBox ? rememberBox.checked : false;

        btnText.innerText = "AUTHENTICATING...";
        loginBtn.style.background = "rgba(0, 243, 255, 0.1)";
        loginBtn.style.color = "var(--neon-cyan)";
        loginBtn.disabled = true;
        loginBtn.style.cursor = "wait";

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: user, 
                password: pass,
                remember: remember 
            })
        })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                // ⚡ FIX: Save username for Dashboard self-healing
                localStorage.setItem('jobGuardUser', data.username);
                
                loginBtn.style.borderColor = "var(--neon-green)";
                loginBtn.style.color = "var(--neon-green)";
                btnText.innerText = "ACCESS GRANTED";
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 500);
            } else {
                // ⚡ FIX: Visual Error State (No Alert)
                btnText.innerText = "ACCESS DENIED";
                loginBtn.style.background = "var(--neon-pink)";
                loginBtn.style.borderColor = "var(--neon-pink)";
                loginBtn.style.color = "#fff";
                loginBtn.style.boxShadow = "0 0 15px var(--neon-pink)";
                loginBtn.style.cursor = "not-allowed";
                // Button stays disabled until user types again
            }
        })
        .catch(err => {
            console.error(err);
            btnText.innerText = "SYSTEM FAILURE";
            loginBtn.style.borderColor = "#ffaa00";
            loginBtn.style.color = "#ffaa00";
            loginBtn.disabled = false;
        });
    });

    // ==========================================
    // 4. SIGNUP LOGIC
    // ==========================================
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
                btn.innerText = "REGISTER UNIT";
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

    // ==========================================
    // 5. VALIDATION
    // ==========================================
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
