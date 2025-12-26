document.addEventListener('DOMContentLoaded', () => {

    // --- 1. AUTH & USER IDENTITY ---
    const profileNameLabel = document.getElementById('profileName');
    const logoutBtn = document.getElementById('logoutBtn');
    const deleteBtn = document.getElementById('deleteAccountBtn');
    const logsPanel = document.querySelector('.live-logs');
    
    const storedUser = localStorage.getItem('jobGuardUser') || 'UNKNOWN';
    if(profileNameLabel) profileNameLabel.innerText = `OPERATOR: ${storedUser.toUpperCase()}`;

    if (storedUser === 'Yoge' && logsPanel) {
        logsPanel.style.display = 'flex'; 
    }

    if(logoutBtn) logoutBtn.addEventListener('click', () => {
        if(confirm("TERMINATE SESSION?")) {
            fetch('/api/logout', { method: 'POST' }).then(() => { 
                localStorage.removeItem('jobGuardUser'); 
                window.location.href = '/'; 
            });
        }
    });

    // --- 2. COPY LOGS (FIXED) ---
    const copyBtn = document.getElementById('copyLogsBtn');
    const logList = document.querySelector('.log-list');

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const logs = logList.querySelectorAll('li');
            if (logs.length === 0) {
                alert("NO LOG DATA FOUND");
                return;
            }
            
            let logText = "--- JOBGUARD SYSTEM LOGS ---\n";
            logText += `TIMESTAMP: ${new Date().toLocaleString()}\n`;
            logText += "----------------------------\n";
            
            logs.forEach(li => {
                logText += li.innerText + "\n";
            });

            navigator.clipboard.writeText(logText).then(() => {
                const originalIcon = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color: var(--neon-green)"></i>';
                setTimeout(() => copyBtn.innerHTML = originalIcon, 2000);
            }).catch(err => {
                console.error("Copy failed", err);
                alert("CLIPBOARD ACCESS DENIED");
            });
        });
    }

    // --- 3. TYPING STATUS ---
    const jobInput = document.getElementById('jobDescription');
    const charCount = document.getElementById('charCount');
    const scanStatus = document.getElementById('scanStatus');
    const analyzeBtn = document.getElementById('analyzeBtn');
    let typingTimer;

    if (jobInput) {
        jobInput.addEventListener('input', function() { 
            const text = this.value;
            if(charCount) charCount.innerText = `BUFFER: ${text.length} chars | ${new Blob([text]).size} bytes`;
            
            clearTimeout(typingTimer);
            resetScanUI();

            scanStatus.innerText = ">> RECEIVING DATA...";
            scanStatus.style.color = "#00f3ff"; 
            scanStatus.classList.add('blink');

            typingTimer = setTimeout(() => {
                scanStatus.classList.remove('blink');
                if(text.length > 0) {
                    scanStatus.innerText = ">> SIGNAL STANDBY";
                    scanStatus.style.color = "var(--neon-green)";
                } else {
                    scanStatus.innerText = ">> IDLE";
                    scanStatus.style.color = "#666";
                }
            }, 800);
        });
    }

    function resetScanUI() {
        if(!analyzeBtn) return;
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<span>INITIALIZE SCAN</span>';
        analyzeBtn.style.border = "1px solid var(--neon-cyan)";
        analyzeBtn.style.backgroundColor = "transparent";
        analyzeBtn.style.color = "var(--neon-cyan)";
        analyzeBtn.style.boxShadow = "none";
    }

    // --- 4. MATRIX BACKGROUND ---
    const canvas = document.getElementById('matrixCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const alphabet = '01'; const fontSize = 14;
        let columns, drops, matrixInterval;

        function initMatrix() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            columns = Math.floor(canvas.width / fontSize);
            drops = Array(columns).fill(1);
        }

        const draw = () => {
            ctx.fillStyle = 'rgba(5, 8, 10, 0.1)'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = fontSize + 'px monospace';
            for(let i = 0; i < drops.length; i++) {
                ctx.fillStyle = Math.random() > 0.9 ? '#00f3ff' : '#00ff9d';
                ctx.fillText(alphabet.charAt(Math.floor(Math.random() * alphabet.length)), i*fontSize, drops[i]*fontSize);
                if(drops[i]*fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
        };

        initMatrix();
        matrixInterval = setInterval(draw, 33);
        window.addEventListener('resize', () => {
            clearInterval(matrixInterval);
            initMatrix();
            matrixInterval = setInterval(draw, 33);
        });
    }

    // --- 5. ANALYZE & PREDICT ---
    const resultContainer = document.getElementById('resultContainer');
    const loader = document.getElementById('loader');

    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            const text = jobInput.value.trim();
            if (text.length < 5) { alert("DATA EMPTY"); return; }

            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<span>SCANNING...</span>';
            resultContainer.classList.add('hidden');
            loader.classList.remove('hidden');
            
            scanStatus.innerText = ">> ANALYZING PACKETS...";
            scanStatus.style.color = "#00f3ff";
            
            fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            })
            .then(response => response.json())
            .then(data => {
                loader.classList.add('hidden');
                if (data.system_logs) updateLogs(data.system_logs);
                if (data.error) { 
                    alert("ERROR: " + data.error); 
                    resetScanUI();
                    return; 
                }
                displayResult(data);
            })
            .catch(error => {
                loader.classList.add('hidden');
                resetScanUI();
                alert("CONNECTION ERROR");
            });
        });
    }

    function updateLogs(logs) {
        if(!logList) return;
        logList.innerHTML = "";
        // logs is already reversed from backend 'list(reversed(trace_logs))'
        logs.forEach(log => {
            const li = document.createElement('li');
            li.style.fontFamily = "monospace"; li.style.fontSize = "0.75rem";
            li.style.listStyle = "none";
            li.style.marginBottom = "4px";
            
            if (log.includes("[ERROR]")) li.style.color = "var(--neon-pink)";
            else if (log.includes("[WARN]")) li.style.color = "var(--neon-yellow)";
            else if (log.includes("[SUCCESS]")) li.style.color = "var(--neon-green)";
            else li.style.color = "#888";
            
            li.innerText = log;
            logList.appendChild(li);
        });
    }

    function displayResult(data) {
        resultContainer.classList.remove('hidden');
        const prob = data.fraud_probability;
        const root = document.documentElement;

        let uiColor, titleText, rgbaColor, statusText;
        
        if (data.is_gibberish) {
            uiColor = "var(--neon-yellow)"; titleText = "LANGUAGE ERROR"; 
            rgbaColor = "rgba(255, 255, 0, 0.1)"; statusText = ">> GIBBERISH DETECTED";
        } else if (prob <= 30) {
            uiColor = "var(--neon-green)"; titleText = "SYSTEM CLEAN"; 
            rgbaColor = "rgba(0, 255, 157, 0.1)"; statusText = ">> CLEAN SIGNAL";
        } else if (prob <= 60) {
            uiColor = "#ffff00"; titleText = "MODERATE RISK"; 
            rgbaColor = "rgba(255, 255, 0, 0.1)"; statusText = ">> CAUTION ADVISED";
        } else if (prob < 81) {
            uiColor = "var(--neon-orange)"; titleText = "HIGH RISK"; 
            rgbaColor = "rgba(255, 165, 0, 0.1)"; statusText = ">> THREAT DETECTED";
        } else {
            uiColor = "var(--neon-pink)"; titleText = "CRITICAL THREAT"; 
            rgbaColor = "rgba(255, 0, 153, 0.1)"; statusText = ">> MALICIOUS PATTERN";
        }

        scanStatus.innerText = statusText;
        scanStatus.style.color = uiColor;
        root.style.setProperty('--state-color', uiColor);
        
        document.getElementById('verdictTitle').innerText = titleText;
        document.getElementById('verdictTitle').style.color = uiColor;
        
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = `<span>SCAN COMPLETE</span>`;
        analyzeBtn.style.border = `2px solid ${uiColor}`;
        analyzeBtn.style.backgroundColor = rgbaColor;
        analyzeBtn.style.color = uiColor; 
        analyzeBtn.style.boxShadow = `0 0 15px ${uiColor}`;

        const fill = document.getElementById('confidenceFill');
        fill.style.width = '0%'; 
        fill.style.backgroundColor = uiColor;
        setTimeout(() => { 
            fill.style.width = prob + '%'; 
            document.getElementById('confidenceScore').innerText = prob + '%';
            document.getElementById('confidenceScore').style.color = uiColor;
        }, 100);

        const msgBox = document.getElementById('verdictMessage');
        msgBox.innerHTML = "";
        if (data.reasons) {
            const ul = document.createElement("ul");
            ul.style.paddingLeft = "0"; ul.style.listStyle = "none";
            data.reasons.forEach(r => {
                const li = document.createElement("li");
                li.innerHTML = `> ${r.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}`;
                li.style.color = "rgba(255,255,255,0.9)"; 
                li.style.marginBottom = "8px";
                ul.appendChild(li);
            });
            msgBox.appendChild(ul);
        }
    }
});
