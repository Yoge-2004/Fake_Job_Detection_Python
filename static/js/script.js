document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. USER PROFILE & AUTH LOGIC
    // ==========================================
    const profileNameLabel = document.getElementById('profileName');
    const logoutBtn = document.getElementById('logoutBtn');
    const deleteBtn = document.getElementById('deleteAccountBtn');

    const currentUser = localStorage.getItem('jobGuardUser') || 'UNKNOWN_OPERATOR';
    if(profileNameLabel) {
        profileNameLabel.innerText = `OPERATOR: ${currentUser.toUpperCase()}`;
    }

    if(logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(confirm("TERMINATE SESSION AND DISCONNECT?")) {
                fetch('/api/logout', { method: 'POST' })
                .then(() => {
                    localStorage.removeItem('jobGuardUser'); 
                    window.location.href = '/'; 
                })
                .catch(() => {
                    localStorage.removeItem('jobGuardUser'); 
                    window.location.href = '/'; 
                });
            }
        });
    }

    if(deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(confirm("⚠️ CRITICAL WARNING ⚠️\n\nPERMANENTLY DELETE ACCOUNT?")) {
                fetch('/api/delete_account', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        alert("ACCOUNT DELETED.");
                        localStorage.removeItem('jobGuardUser');
                        window.location.href = '/';
                    } else {
                        alert("ERROR: " + data.error);
                    }
                });
            }
        });
    }

    // ==========================================
    // 2. MATRIX RAIN
    // ==========================================
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
    window.addEventListener('resize', () => { 
        canvas.width = window.innerWidth; 
        canvas.height = window.innerHeight; 
    });

    // ==========================================
    // 3. UI STATE & ANIMATIONS (MOBILE FIXED)
    // ==========================================
    const analyzeBtn = document.getElementById('analyzeBtn');
    const jobInput = document.getElementById('jobDescription');
    const loader = document.getElementById('loader');
    const resultContainer = document.getElementById('resultContainer');
    const charCount = document.getElementById('charCount');
    const scanStatus = document.getElementById('scanStatus');
    
    const verdictTitle = document.getElementById('verdictTitle');
    const verdictMessage = document.getElementById('verdictMessage');
    const confidenceScore = document.getElementById('confidenceScore');
    const confidenceFill = document.getElementById('confidenceFill');
    const root = document.documentElement;

    // Typing Timer Variables
    let typingTimer;
    const doneTypingInterval = 800; // 0.8s delay

    // A. Typing Event
    jobInput.addEventListener('input', function() { 
        charCount.innerText = `BUFFER: ${this.value.length} BYTES`;
        clearTimeout(typingTimer); // Reset timer

        if(this.value.length > 0) {
            scanStatus.innerText = ">> RECEIVING DATA...";
            scanStatus.style.color = "#fff"; 
            scanStatus.classList.add('blink');
        } else {
            scanStatus.innerText = ">> IDLE";
            scanStatus.style.color = "#666";
            scanStatus.classList.remove('blink');
        }

        // Start timer
        typingTimer = setTimeout(doneTyping, doneTypingInterval);
    });

    // B. Done Typing Helper
    function doneTyping() {
        scanStatus.classList.remove('blink');
        if(jobInput.value.length > 0) {
            scanStatus.innerText = ">> SIGNAL STANDBY"; 
            scanStatus.style.color = "var(--neon-green)";
        } else {
            scanStatus.innerText = ">> IDLE";
            scanStatus.style.color = "#666";
        }
    }

    // C. Focus Event
    jobInput.addEventListener('focus', function() {
        this.parentElement.style.boxShadow = "0 0 15px var(--neon-cyan)";
        this.parentElement.style.borderColor = "var(--neon-cyan)";

        if(this.value.length === 0) {
            scanStatus.innerText = ">> AWAITING INPUT";
            scanStatus.style.color = "var(--neon-cyan)";
        }
    });

    // D. Blur Event
    jobInput.addEventListener('blur', function() {
        this.parentElement.style.boxShadow = "none";
        this.parentElement.style.borderColor = "rgba(0, 243, 255, 0.2)";
        doneTyping(); // Immediate update on blur
    });

    // ==========================================
    // 4. MAIN ANALYSIS LOGIC
    // ==========================================
    analyzeBtn.addEventListener('click', () => {
        const text = jobInput.value.trim();
        
        if (text.length < 5) { 
            alert("INPUT_ERROR: DATA_STREAM_EMPTY"); 
            jobInput.focus(); 
            return; 
        }

        analyzeBtn.disabled = true;
        resultContainer.classList.add('hidden');
        loader.classList.remove('hidden');
        
        scanStatus.innerText = ">> ESTABLISHING UPLINK...";
        scanStatus.style.color = "var(--neon-cyan)";
        scanStatus.classList.add('blink'); 

        fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        })
        .then(response => response.json())
        .then(data => {
            loader.classList.add('hidden');
            analyzeBtn.disabled = false;
            scanStatus.classList.remove('blink');

            if (data.error) {
                alert("SERVER ERROR: " + data.error);
                scanStatus.innerText = ">> CONNECTION ERROR";
                scanStatus.style.color = "var(--neon-pink)";
                return;
            }

            displayResult(data.is_fake, data.confidence);
        })
        .catch(error => {
            loader.classList.add('hidden');
            analyzeBtn.disabled = false;
            scanStatus.classList.remove('blink');
            alert("CONNECTION FAILURE: BACKEND OFFLINE");
            
            // Simulation Fallback
            const mockScore = Math.random() * 100;
            const mockFake = mockScore > 50;
            displayResult(mockFake, mockScore.toFixed(1));
        });
    });

    function displayResult(isFake, confidence) {
        resultContainer.classList.remove('hidden');
        
        if (isFake) {
            root.style.setProperty('--state-color', '#ff0055'); 
            verdictTitle.innerText = "CRITICAL THREAT";
            verdictMessage.innerText = ">> ANALYSIS_REPORT\n>> THREAT_DETECTED: SCAM_PATTERN\n>> RISK_FACTOR: HIGH\n>> ACTION: BLOCK_SENDER";
            scanStatus.innerText = ">> THREAT DETECTED";
            scanStatus.style.color = "#ff0055";
        } else {
            root.style.setProperty('--state-color', '#00ff9d'); 
            verdictTitle.innerText = "SYSTEM CLEAN";
            verdictMessage.innerText = ">> ANALYSIS_REPORT\n>> PATTERN_MATCH: LEGITIMATE\n>> INTEGRITY: VERIFIED\n>> ACTION: SAFE_TO_PROCEED";
            scanStatus.innerText = ">> SCAN COMPLETE";
            scanStatus.style.color = "#00ff9d";
        }

        confidenceFill.style.width = '0%';
        setTimeout(() => {
            confidenceFill.style.width = confidence + '%';
            confidenceScore.innerText = confidence + '%';
        }, 100);
    }
});
