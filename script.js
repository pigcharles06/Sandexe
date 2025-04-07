// Wrap the entire script in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const waveNumberInput = document.getElementById('waveNumber');
    const maxWaveNumberInput = document.getElementById('maxWaveNumber');
    const stepsInput = document.getElementById('steps');
    const stepDelayInput = document.getElementById('stepDelay');
    const xOffsetInput = document.getElementById('xOffset');
    const yOffsetInput = document.getElementById('yOffset');
    const gammaInput = document.getElementById('gamma');
    const runBtn = document.getElementById('runBtn');
    const runLotBtn = document.getElementById('runLotBtn');
    const stopBtn = document.getElementById('stopBtn');
    const continueBtn = document.getElementById('continueBtn');
    const resetBtn = document.getElementById('resetBtn');
    const sandAmountInput = document.getElementById('sandAmount');
    const sandSpeedInput = document.getElementById('sandSpeed');
    const generateSandBtn = document.getElementById('generateSandBtn');
    const clearSandBtn = document.getElementById('clearSandBtn');
    const startContinuousSandBtn = document.getElementById('startContinuousSandBtn');
    const stopContinuousSandBtn = document.getElementById('stopContinuousSandBtn');
    const currentSandCountSpan = document.getElementById('currentSandCount');
    const enableSoundCheckbox = document.getElementById('enableSound');
    const amplitudeInput = document.getElementById('amplitude');
    const soundConstantCInput = document.getElementById('soundConstantC');
    const updateSoundBtn = document.getElementById('updateSoundBtn');
    const currentFrequencySpan = document.getElementById('currentFrequency');
    const showBackgroundIntensityCheckbox = document.getElementById('showBackgroundIntensity');
    const plotKBtn = document.getElementById('plotKBtn');
    const screenshotBtn = document.getElementById('screenshotBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const loadSettingsBtn = document.getElementById('loadSettingsBtn');
    const chladniCanvas = document.getElementById('chladniCanvas');
    const chladniCtx = chladniCanvas.getContext('2d');
    const kPlotCanvas = document.getElementById('kPlotCanvas');
    const kPlotCtx = kPlotCanvas.getContext('2d');
    const highPeaksList = document.getElementById('highPeaksList');
    const lowPeaksList = document.getElementById('lowPeaksList');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const setApiKeyBtn = document.getElementById('setApiKeyBtn');
    const chatbotContainer = document.getElementById('chatbotContainer');
    const toggleChatbotBtn = document.getElementById('toggleChatbotBtn');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const chatMessages = document.getElementById('chatMessages');
    const analyzeScreenBtn = document.getElementById('analyzeScreenBtn');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const enableTtsCheckbox = document.getElementById('enableTts');
    const aiStatus = document.getElementById('aiStatus');

    // --- Simulation State ---
    let sandParticles = [];
    let intensityGrid = null;
    let isPaused = false;
    let isRunningContinuous = false;
    let animationFrameId = null;
    let isAddingSandContinuously = false;
    let continuousSandIntervalId = null;
    const CONTINUOUS_SAND_BATCH_SIZE = 20;
    const CONTINUOUS_SAND_INTERVAL = 100;
    let showIntensityBackground = false;
    let isSoundGloballyEnabled = false; // Default off

    let currentWaveNumber = 5.0;
    let x0 = 0.5;
    let y0 = 0.5;
    let L = 1.0;
    let gridSize = 100;
    let gamma = 0.01;
    let S = 15;
    let S0_k = 50;

    // --- OpenAI State ---
    let openaiApiKey = null; // Session only
    let isAiThinking = false;
    let isTtsEnabled = false;
    let chatHistory = []; // Store conversation history

    // --- Web Audio API Setup ---
    let audioCtx = null;
    let oscillator = null;
    let gainNode = null;
    let soundAmplitude = 0.5;
    let soundConstantC = 2.1977;
    let currentFrequency = 0;
    let ttsAudioPlayer = null; // For TTS playback

    // --- OpenAI API Constants ---
    const OPENAI_API_URL_BASE = "https://api.openai.com/v1"; // Base URL
    const OPENAI_API_URL_CHAT = `${OPENAI_API_URL_BASE}/chat/completions`;
    const OPENAI_API_URL_TTS = `${OPENAI_API_URL_BASE}/audio/speech`;
    const OPENAI_API_URL_EMBEDDINGS = `${OPENAI_API_URL_BASE}/embeddings`; // Embedding endpoint
    const VISION_MODEL = "gpt-4o";
    const CHAT_MODEL = "gpt-4o"; // Use gpt-4o for RAG chat
    const EMBEDDING_MODEL = "text-embedding-3-small"; // Embedding model
    const TTS_MODEL = "tts-1";
    const TTS_VOICE = "alloy";

    // --- RAG Constants ---
    const MAX_CONTEXT_CHUNKS = 3; // How many knowledge chunks to retrieve
    const MIN_SIMILARITY_SCORE = 0.3; // Cosine similarity threshold (adjust as needed)

    // --- Function Definitions ---

    function initAudio() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                gainNode = audioCtx.createGain();
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime); // Start muted
                gainNode.connect(audioCtx.destination);
                console.log("AudioContext and GainNode created.");
                resumeAudioContext(); // Try to resume if suspended
            } catch (e) {
                console.error("Failed to create AudioContext:", e);
                enableSoundCheckbox.disabled = true;
                amplitudeInput.disabled = true;
                soundConstantCInput.disabled = true;
                updateSoundBtn.disabled = true;
                return false; // Indicate failure
            }
        }
        if (!oscillator && audioCtx) {
            startOscillator(); // Create oscillator if context exists
        }
        return true; // Indicate success or already initialized
    }

    function resumeAudioContext() {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                console.log("AudioContext resumed successfully.");
            }).catch(e => console.error("Error resuming AudioContext:", e));
        }
    }

    function startOscillator() {
        if (!audioCtx) {
            if (!initAudio()) return; // Attempt init, exit if failed
        }
        if (oscillator) { // Stop and disconnect existing one first
            try { oscillator.stop(); } catch (e) { /* Ignore errors if already stopped */ }
            oscillator.disconnect();
        }
        oscillator = audioCtx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1, audioCtx.currentTime); // Start low
        oscillator.connect(gainNode);
        try {
            oscillator.start();
            // console.log("Oscillator (re)started."); // Less verbose
        } catch (e) {
            console.warn("Audio oscillator start failed (might already be running):", e);
        }
    }

    function startSound() {
        if (!isSoundGloballyEnabled) {
            return; // Respect global toggle
        }
        if (!audioCtx || !oscillator) {
            if (!initAudio()) return; // Init failed
            if (!oscillator) startOscillator(); // Ensure oscillator exists
        }
        resumeAudioContext(); // Ensure context is running

        // console.log("Starting sound (ramping gain up)..."); // Less verbose
        if (gainNode) {
            gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(soundAmplitude, audioCtx.currentTime + 0.1);
        }
        updateSoundParameters(); // Set frequency immediately
    }

    function stopSound() {
        // console.log("Stopping sound (ramping gain down)..."); // Less verbose
        if (gainNode) {
            gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime); // Hold current value before ramping
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1); // Ramp down gain
        }
        if (oscillator) { // Ramp frequency down to near zero as well
            oscillator.frequency.cancelScheduledValues(audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(oscillator.frequency.value, audioCtx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(1, audioCtx.currentTime + 0.1);
        }
        currentFrequency = 0; // Update internal state
        currentFrequencySpan.textContent = "0.00"; // Update display explicitly
    }

    function updateSoundParameters() {
        if (!audioCtx) { // Handle case where audio context might fail/not init
            soundAmplitude = parseFloat(amplitudeInput.value);
            soundConstantC = parseFloat(soundConstantCInput.value);
            currentFrequency = currentWaveNumber * currentWaveNumber * soundConstantC;
            currentFrequencySpan.textContent = isSoundGloballyEnabled ? currentFrequency.toFixed(2) : "0.00";
            return;
        }

        if (!oscillator) startOscillator(); // Ensure oscillator exists

        soundAmplitude = parseFloat(amplitudeInput.value);
        soundConstantC = parseFloat(soundConstantCInput.value);
        currentFrequency = currentWaveNumber * currentWaveNumber * soundConstantC; // Calculate target freq

        let displayFrequency = "0.00";

        if (isSoundGloballyEnabled && oscillator && gainNode) {
            let targetFrequency = Math.max(20, Math.min(20000, currentFrequency)); // Clamp audible range

            oscillator.frequency.cancelScheduledValues(audioCtx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(targetFrequency, audioCtx.currentTime + 0.05);

            gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(soundAmplitude, audioCtx.currentTime + 0.05);

            displayFrequency = targetFrequency.toFixed(2);

        } else if (gainNode) { // If sound disabled, ensure gain is 0
            gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
        }

        currentFrequencySpan.textContent = displayFrequency;
    }

    const PI = Math.PI;
    function calculateFunc(m, n, x, y) {
        return (2 / L) * Math.cos(m * PI * x / L) * Math.cos(n * PI * y / L);
    }
    function calculateKmn(m, n) {
        return (PI / L) * Math.sqrt(n * n + m * m);
    }
    function calculatePsi(x, y, k_val) {
        let psi_sum = new Complex(0, 0);
        const k_sq = k_val * k_val;
        const term3_base = new Complex(0, 2 * gamma * k_val); // 2*i*gamma*k
        for (let n = 0; n < S; n++) {
            for (let m = 0; m < S; m++) {
                const fn_xy = calculateFunc(m, n, x, y);
                const fn_x0y0 = calculateFunc(m, n, x0, y0);
                const kmn_sq = Math.pow(calculateKmn(m, n), 2);
                const denominator = (new Complex(k_sq - kmn_sq)).add(term3_base);
                if (denominator.abs() < 1e-9) continue;
                const term = (new Complex(fn_xy * fn_x0y0)).div(denominator);
                psi_sum = psi_sum.add(term);
            }
        }
        return psi_sum;
    }
    async function calculateIntensityGrid(k) {
        return new Promise(resolve => {
            intensityGrid = [];
            let maxIntensity = 0, minIntensity = Infinity;
            for (let i = 0; i < gridSize; i++) {
                intensityGrid[i] = [];
                const x = L * i / gridSize;
                for (let j = 0; j < gridSize; j++) {
                    const y = L * j / gridSize;
                    const psi = calculatePsi(x, y, k);
                    const intensitySq = Math.pow(psi.magnitude(), 2);
                    intensityGrid[i][j] = intensitySq;
                    if (intensitySq > maxIntensity) maxIntensity = intensitySq;
                    if (intensitySq < minIntensity) minIntensity = intensitySq;
                }
            }
            const range = maxIntensity - minIntensity;
            if (range > 1e-9) {
                for (let i = 0; i < gridSize; i++) {
                    for (let j = 0; j < gridSize; j++) {
                        intensityGrid[i][j] = (intensityGrid[i][j] - minIntensity) / range;
                    }
                }
            } else {
                const constantValue = (maxIntensity > 1e-9) ? 0.5 : 0;
                for (let i = 0; i < gridSize; i++) {
                    intensityGrid[i].fill(constantValue); // Use fill for efficiency
                }
            }
            resolve();
        });
    }

    function drawChladniPattern() {
        chladniCtx.clearRect(0, 0, chladniCanvas.width, chladniCanvas.height);
        if (showIntensityBackground && intensityGrid) {
            const cellWidth = chladniCanvas.width / gridSize;
            const cellHeight = chladniCanvas.height / gridSize;
            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    const intensity = intensityGrid[i][j];
                    const grayValue = Math.floor((1 - intensity) * 255);
                    chladniCtx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
                    chladniCtx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);
                }
            }
        }
        chladniCtx.fillStyle = 'saddlebrown';
        const particleSize = 2;
        sandParticles.forEach(p => {
            chladniCtx.beginPath();
            chladniCtx.arc(p.x * chladniCanvas.width, p.y * chladniCanvas.height, particleSize / 2, 0, 2 * Math.PI);
            chladniCtx.fill();
        });
        currentSandCountSpan.textContent = sandParticles.length;
    }

    function generateSand() {
        const amount = parseInt(sandAmountInput.value);
        const newSand = [];
        for (let i = 0; i < amount; i++) {
            newSand.push({ x: Math.random(), y: Math.random() });
        }
        sandParticles = sandParticles.concat(newSand); // Append
        // console.log(`Added ${amount} sand. Total: ${sandParticles.length}`);
        if (!isPaused && intensityGrid && !animationFrameId) {
            startSandAnimation();
        } else if (!animationFrameId) {
            drawChladniPattern(); // Update display if not animating
        }
    }

    function addSmallSandBatch() {
        const newSand = [];
        for (let i = 0; i < CONTINUOUS_SAND_BATCH_SIZE; i++) {
            newSand.push({ x: Math.random(), y: Math.random() });
        }
        sandParticles = sandParticles.concat(newSand);
        if (!isPaused && intensityGrid && !animationFrameId) {
            startSandAnimation();
        }
    }

    function handleStartContinuousSand() {
        if (!isAddingSandContinuously) {
            isAddingSandContinuously = true;
            continuousSandIntervalId = setInterval(addSmallSandBatch, CONTINUOUS_SAND_INTERVAL);
            startContinuousSandBtn.disabled = true;
            startContinuousSandBtn.style.display = 'none';
            stopContinuousSandBtn.disabled = false;
            stopContinuousSandBtn.style.display = 'inline-block';
            console.log("Started continuous sand generation.");
        }
    }

    function handleStopContinuousSand() {
        if (isAddingSandContinuously) {
            isAddingSandContinuously = false;
            clearInterval(continuousSandIntervalId);
            continuousSandIntervalId = null;
            startContinuousSandBtn.disabled = false;
            startContinuousSandBtn.style.display = 'inline-block';
            stopContinuousSandBtn.disabled = true;
            stopContinuousSandBtn.style.display = 'none';
            console.log("Stopped continuous sand generation.");
        }
    }

    function clearSand() {
        sandParticles = [];
        stopSandAnimation();
        handleStopContinuousSand();
        chladniCtx.clearRect(0, 0, chladniCanvas.width, chladniCanvas.height);
        if (showIntensityBackground && intensityGrid) {
            drawChladniPattern(); // Redraw empty background if needed
        }
        currentSandCountSpan.textContent = 0;
        console.log("All sand cleared.");
    }

    function getIntensityAt(x_norm, y_norm) {
        if (!intensityGrid) return 0.5; // Default intensity if grid not calculated
        const i = Math.max(0, Math.min(gridSize - 1, Math.floor(x_norm * gridSize)));
        const j = Math.max(0, Math.min(gridSize - 1, Math.floor(y_norm * gridSize)));
        return intensityGrid[i][j];
    }

    function moveSandParticles() {
        if (!intensityGrid || sandParticles.length === 0) return;
        const speedFactor = 0.005;
        const step = 1.5 / gridSize;
        for (let p_idx = 0; p_idx < sandParticles.length; ++p_idx) {
            const p = sandParticles[p_idx];
            const currentIntensity = getIntensityAt(p.x, p.y);
            let minIntensity = currentIntensity, moveX = 0, moveY = 0;
            // Check 8 neighbors
            for (let dx = -step; dx <= step; dx += step) {
                for (let dy = -step; dy <= step; dy += step) {
                    if (dx === 0 && dy === 0) continue;
                    const nextX = p.x + dx, nextY = p.y + dy;
                    if (nextX < 0 || nextX > 1 || nextY < 0 || nextY > 1) continue; // Boundary check
                    const neighborIntensity = getIntensityAt(nextX, nextY);
                    if (neighborIntensity < minIntensity) {
                        minIntensity = neighborIntensity;
                        moveX = dx;
                        moveY = dy;
                    }
                }
            }
            // Move particle
            if (moveX !== 0 || moveY !== 0) {
                p.x += moveX * speedFactor + (Math.random() - 0.5) * 0.001; // Add noise
                p.y += moveY * speedFactor + (Math.random() - 0.5) * 0.001;
                p.x = Math.max(0, Math.min(1, p.x)); // Clamp position
                p.y = Math.max(0, Math.min(1, p.y));
            }
        }
    }

    let lastSandUpdateTime = 0;
    function animationLoop(timestamp) {
        if (isPaused || !animationFrameId) {
            if (isPaused) animationFrameId = requestAnimationFrame(animationLoop); // Keep checking if paused
            return;
        }
        const sandSpeedMs = parseInt(sandSpeedInput.value);
        const now = performance.now();
        const elapsed = now - lastSandUpdateTime;
        if (elapsed >= sandSpeedMs) {
            moveSandParticles();
            lastSandUpdateTime = now - (elapsed % sandSpeedMs); // Adjust for precision
        }
        drawChladniPattern();
        animationFrameId = requestAnimationFrame(animationLoop); // Continue loop
    }

    function startSandAnimation() {
        if (animationFrameId === null && sandParticles.length > 0) {
            lastSandUpdateTime = performance.now();
            animationFrameId = requestAnimationFrame(animationLoop);
            if (isSoundGloballyEnabled) startSound(); // Start sound only if enabled
            stopBtn.disabled = false;
            continueBtn.disabled = true;
        } else if (sandParticles.length === 0) {
            stopBtn.disabled = true; // Can't stop if not running
        }
    }

    function stopSandAnimation() {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null; // Mark as stopped
            stopSound(); // Stop associated sound
        }
    }

    function countk(k_complex) {
        let psi0_sum = new Complex(0, 0);
        const k_sq = Complex.pow(k_complex, 2);
        const term3_base = (new Complex(0, 2 * gamma)).mul(k_complex);
        for (let n = 0; n < S0_k; n++) {
            for (let m = 0; m < S0_k; m++) {
                const func_sq = Math.pow(calculateFunc(m, n, x0, y0), 2);
                const kmn_sq = Math.pow(calculateKmn(m, n), 2);
                const denominator = k_sq.sub(kmn_sq).add(term3_base);
                if (denominator.abs() < 1e-9) continue;
                const term = new Complex(func_sq).div(denominator);
                psi0_sum = psi0_sum.add(term);
            }
        }
        const numerator = psi0_sum;
        const denominator_k0 = (new Complex(1)).add(psi0_sum.mul(3.3));
        if (denominator_k0.abs() < 1e-9) return 0;
        const result_complex = numerator.div(denominator_k0);
        return result_complex.magnitude();
    }

    function plotKGraph() {
        const k_min = 1.0, k_max = 30.0, k_step = 0.1;
        const kValues = [], fValues = [];
        for (let k = k_min; k <= k_max; k += k_step) {
            kValues.push(k);
            fValues.push(countk(new Complex(k)));
        }
        const peaks = [], troughs = [];
        for (let i = 1; i < fValues.length - 1; i++) {
            if (fValues[i] > fValues[i - 1] && fValues[i] > fValues[i + 1]) peaks.push({ k: kValues[i], val: fValues[i] });
            else if (fValues[i] < fValues[i - 1] && fValues[i] < fValues[i + 1] && fValues[i] > 1e-6) troughs.push({ k: kValues[i], val: fValues[i] });
        }
        kPlotCtx.clearRect(0, 0, kPlotCanvas.width, kPlotCanvas.height);
        const padding = 30;
        const plotWidth = kPlotCanvas.width - 2 * padding, plotHeight = kPlotCanvas.height - 2 * padding;
        const logFValues = fValues.map(v => v > 1e-9 ? Math.log10(v) : -9);
        const finiteLogF = logFValues.filter(v => isFinite(v));
        const minLogF = finiteLogF.length > 0 ? Math.min(...finiteLogF) : -9;
        const maxLogF = finiteLogF.length > 0 ? Math.max(...finiteLogF) : -8;
        const yRange = (maxLogF > minLogF) ? maxLogF - minLogF : 1;
        const kRange = k_max - k_min;
        // Draw Axes
        kPlotCtx.strokeStyle = '#000'; kPlotCtx.lineWidth = 1; kPlotCtx.beginPath();
        kPlotCtx.moveTo(padding, padding); kPlotCtx.lineTo(padding, kPlotCanvas.height - padding); kPlotCtx.lineTo(kPlotCanvas.width - padding, kPlotCanvas.height - padding); kPlotCtx.stroke();
        // Draw Labels
        kPlotCtx.fillStyle = '#000'; kPlotCtx.textAlign = 'center'; kPlotCtx.fillText('k', kPlotCanvas.width / 2, kPlotCanvas.height - padding / 2);
        kPlotCtx.textAlign = 'right'; kPlotCtx.textBaseline = 'middle'; kPlotCtx.fillText('log10(f(k))', padding - 5, padding + plotHeight / 2);
        // Draw Ticks
        kPlotCtx.textAlign = 'center'; kPlotCtx.textBaseline = 'top'; kPlotCtx.fillText(k_min.toFixed(1), padding, kPlotCanvas.height - padding + 5); kPlotCtx.fillText(k_max.toFixed(1), kPlotCanvas.width - padding, kPlotCanvas.height - padding + 5);
        kPlotCtx.textAlign = 'right'; kPlotCtx.textBaseline = 'middle';
        if (isFinite(minLogF)) kPlotCtx.fillText(minLogF.toFixed(1), padding - 5, kPlotCanvas.height - padding);
        if (isFinite(maxLogF)) kPlotCtx.fillText(maxLogF.toFixed(1), padding - 5, padding);
        // Draw Plot Line
        kPlotCtx.strokeStyle = 'red'; kPlotCtx.lineWidth = 2; kPlotCtx.beginPath(); let firstPoint = true;
        for (let i = 0; i < kValues.length; i++) {
            if (!isFinite(logFValues[i])) { firstPoint = true; continue; }
            const x = padding + ((kValues[i] - k_min) / kRange) * plotWidth;
            let y = kPlotCanvas.height - padding - 0.5 * plotHeight;
            if (yRange > 1e-9) y = kPlotCanvas.height - padding - ((logFValues[i] - minLogF) / yRange) * plotHeight;
            y = Math.max(padding, Math.min(kPlotCanvas.height - padding, y)); // Clamp y
            if (firstPoint) { kPlotCtx.moveTo(x, y); firstPoint = false; } else { kPlotCtx.lineTo(x, y); }
        }
        kPlotCtx.stroke();
        updatePeakTroughLists(peaks, troughs);
    }

    function updatePeakTroughLists(peaks, troughs) {
        highPeaksList.innerHTML = '';
        lowPeaksList.innerHTML = '';
        peaks.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `k=${p.k.toFixed(2)}`;
            li.dataset.kValue = p.k;
            li.addEventListener('click', () => {
                waveNumberInput.value = p.k.toFixed(2);
                handleRun();
            });
            highPeaksList.appendChild(li);
        });
        troughs.forEach(t => {
            const li = document.createElement('li');
            li.textContent = `k=${t.k.toFixed(2)}`;
            li.dataset.kValue = t.k;
            li.addEventListener('click', () => {
                waveNumberInput.value = t.k.toFixed(2);
                handleRun();
            });
            lowPeaksList.appendChild(li);
        });
    }

    function handleRun() {
        if (isRunningContinuous) return;
        isPaused = false;
        stopSandAnimation();
        currentWaveNumber = parseFloat(waveNumberInput.value);
        x0 = parseFloat(xOffsetInput.value);
        y0 = parseFloat(yOffsetInput.value);
        gamma = parseFloat(gammaInput.value);

        runBtn.disabled = true; runLotBtn.disabled = true; stopBtn.disabled = false; continueBtn.disabled = true;
        updateSoundParameters();

        calculateIntensityGrid(currentWaveNumber).then(() => {
            runBtn.disabled = false; runLotBtn.disabled = false; stopBtn.disabled = false;
            if (sandParticles.length > 0) startSandAnimation();
            else { drawChladniPattern(); stopBtn.disabled = true; }
        }).catch(error => {
            console.error("Error:", error); runBtn.disabled = false; runLotBtn.disabled = false; stopBtn.disabled = true;
        });
    }

    async function handleRunLot() {
        if (isRunningContinuous) return;
        isRunningContinuous = true; isPaused = false; runBtn.disabled = true; runLotBtn.disabled = true; stopBtn.disabled = false; continueBtn.disabled = true;
        const startK = parseFloat(waveNumberInput.value); const endK = parseFloat(maxWaveNumberInput.value);
        const numSteps = parseInt(stepsInput.value); const stepDelaySeconds = parseFloat(stepDelayInput.value);
        const stepDelayMs = Math.max(100, stepDelaySeconds * 1000);
        const stepSize = (numSteps > 1) ? (endK - startK) / (numSteps - 1) : 0; const calculationDelay = 500;
        console.log(`Starting continuous run: k=${startK} to ${endK}, ${numSteps} steps, ${stepDelaySeconds}s delay.`);
        for (let i = 0; i < numSteps; i++) {
            if (!isRunningContinuous) break;
            while (isPaused && isRunningContinuous) { await new Promise(resolve => setTimeout(resolve, 500)); }
            if (!isRunningContinuous) break;
            currentWaveNumber = startK + i * stepSize; waveNumberInput.value = currentWaveNumber.toFixed(2);
            x0 = parseFloat(xOffsetInput.value); y0 = parseFloat(yOffsetInput.value); gamma = parseFloat(gammaInput.value);
            console.log(`Step ${i + 1}/${numSteps}: k=${currentWaveNumber.toFixed(2)}`);
            stopSandAnimation(); updateSoundParameters();
            try {
                await calculateIntensityGrid(currentWaveNumber);
                await new Promise(resolve => setTimeout(resolve, calculationDelay));
                if (!isRunningContinuous) break; while (isPaused && isRunningContinuous) { await new Promise(resolve => setTimeout(resolve, 500)); } if (!isRunningContinuous) break;
                 if (sandParticles.length > 0) startSandAnimation();
                 else { drawChladniPattern(); if(isSoundGloballyEnabled) startSound(); }
                await new Promise(resolve => setTimeout(resolve, stepDelayMs));
            } catch (error) { console.error(`Error step ${i + 1}:`, error); isRunningContinuous = false; break; }
        }
        console.log("Continuous run finished/stopped.");
        if (!isPaused) { stopSandAnimation(); stopBtn.disabled = true; }
        else { stopBtn.disabled = true; continueBtn.disabled = false; }
        isRunningContinuous = false; runBtn.disabled = false; runLotBtn.disabled = false;
    }

    function handleStop() {
        if (!isPaused) {
            isPaused = true; stopSandAnimation(); if(isAddingSandContinuously) clearInterval(continuousSandIntervalId);
            stopBtn.disabled = true; continueBtn.disabled = false; console.log("Simulation paused.");
        }
    }

    function handleContinue() {
        if (isPaused) {
            isPaused = false; stopBtn.disabled = false; continueBtn.disabled = true;
            if (isAddingSandContinuously) continuousSandIntervalId = setInterval(addSmallSandBatch, CONTINUOUS_SAND_INTERVAL);
            if (!isRunningContinuous && intensityGrid && sandParticles.length > 0) { startSandAnimation(); }
            console.log("Simulation continued.");
        }
    }

    function handleReset() {
        if (isRunningContinuous) { isRunningContinuous = false; console.log("Continuous run stopped."); } stopSandAnimation(); handleStopContinuousSand();
        waveNumberInput.value = "5"; maxWaveNumberInput.value = "10"; stepsInput.value = "5"; stepDelayInput.value = "7"; xOffsetInput.value = "0.5"; yOffsetInput.value = "0.5"; gammaInput.value = "0.01"; sandAmountInput.value = "2000"; sandSpeedInput.value = "50"; amplitudeInput.value = "0.5"; soundConstantCInput.value = "2.1977"; showBackgroundIntensityCheckbox.checked = false; enableSoundCheckbox.checked = false; enableTtsCheckbox.checked = false;
        showIntensityBackground = false; isSoundGloballyEnabled = false; isTtsEnabled = false; clearSand(); kPlotCtx.clearRect(0, 0, kPlotCanvas.width, kPlotCanvas.height); highPeaksList.innerHTML = ''; lowPeaksList.innerHTML = ''; intensityGrid = null; isPaused = false; chatHistory = [];
        stopBtn.disabled = true; continueBtn.disabled = true; runBtn.disabled = false; runLotBtn.disabled = false;
        currentWaveNumber = parseFloat(waveNumberInput.value); x0 = parseFloat(xOffsetInput.value); y0 = parseFloat(yOffsetInput.value); gamma = parseFloat(gammaInput.value); updateSoundParameters(); stopSound();
        apiKeyInput.value = ""; openaiApiKey = null; updateAiStatus("請先設定 API Key"); analyzeScreenBtn.disabled = true; sendChatBtn.disabled = true; chatInput.disabled = true; chatMessages.innerHTML = '<div class="message bot">您好！請先設定 API Key 或重新載入設定。</div>';
        console.log("Parameters, simulation, chat, and API Key reset.");
    }

    function handleScreenshot() { const dataUrl = chladniCanvas.toDataURL('image/jpeg', 0.9); const link = document.createElement('a'); link.href = dataUrl; const k = currentWaveNumber.toFixed(2).replace('.', '_'); link.download = `chladni_k${k}_${Date.now()}.jpg`; document.body.appendChild(link); link.click(); document.body.removeChild(link); console.log("Screenshot saved."); }
    function saveSettings() { const settings = { waveNumber: waveNumberInput.value, maxWaveNumber: maxWaveNumberInput.value, steps: stepsInput.value, stepDelay: stepDelayInput.value, xOffset: xOffsetInput.value, yOffset: yOffsetInput.value, gamma: gammaInput.value, sandAmount: sandAmountInput.value, sandSpeed: sandSpeedInput.value, amplitude: amplitudeInput.value, soundConstantC: soundConstantCInput.value, showBg: showBackgroundIntensityCheckbox.checked, soundEnabled: enableSoundCheckbox.checked, ttsEnabled: enableTtsCheckbox.checked }; try { localStorage.setItem('chladniSettings', JSON.stringify(settings)); console.log("Settings saved."); } catch (e) { console.error("Failed to save settings:", e); } }
    function loadSettings() { const savedSettings = localStorage.getItem('chladniSettings'); if (savedSettings) { try { const settings = JSON.parse(savedSettings); waveNumberInput.value = settings.waveNumber || "5"; maxWaveNumberInput.value = settings.maxWaveNumber || "10"; stepsInput.value = settings.steps || "5"; stepDelayInput.value = settings.stepDelay || "7"; xOffsetInput.value = settings.xOffset || "0.5"; yOffsetInput.value = settings.yOffset || "0.5"; gammaInput.value = settings.gamma || "0.01"; sandAmountInput.value = settings.sandAmount || "2000"; sandSpeedInput.value = settings.sandSpeed || "50"; amplitudeInput.value = settings.amplitude || "0.5"; soundConstantCInput.value = settings.soundConstantC || "2.1977"; showBackgroundIntensityCheckbox.checked = settings.showBg || false; enableSoundCheckbox.checked = settings.soundEnabled || false; enableTtsCheckbox.checked = settings.ttsEnabled || false; currentWaveNumber = parseFloat(waveNumberInput.value); x0 = parseFloat(xOffsetInput.value); y0 = parseFloat(yOffsetInput.value); gamma = parseFloat(gammaInput.value); showIntensityBackground = showBackgroundIntensityCheckbox.checked; isSoundGloballyEnabled = enableSoundCheckbox.checked; isTtsEnabled = enableTtsCheckbox.checked; updateSoundParameters(); console.log("Settings loaded."); } catch (e) { console.error("Failed to parse settings:", e); handleReset(); } } else { console.log("No saved settings."); showIntensityBackground = showBackgroundIntensityCheckbox.checked; isSoundGloballyEnabled = enableSoundCheckbox.checked; isTtsEnabled = enableTtsCheckbox.checked; } }
    function handleBackgroundToggle() { showIntensityBackground = showBackgroundIntensityCheckbox.checked; if (!animationFrameId) drawChladniPattern(); console.log("Show background:", showIntensityBackground); }
    function handleSoundToggle() { isSoundGloballyEnabled = enableSoundCheckbox.checked; console.log("Sound Enabled:", isSoundGloballyEnabled); if (isSoundGloballyEnabled) { resumeAudioContext(); updateSoundParameters(); if (!isPaused && (animationFrameId !== null || isRunningContinuous)) startSound(); } else { stopSound(); } }

    // --- RAG Functions --- NEW/REVISED ---
    function cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0.0, normA = 0.0, normB = 0.0;
        for (let i = 0; i < vecA.length; i++) { dotProduct += vecA[i] * vecB[i]; normA += vecA[i] * vecA[i]; normB += vecB[i] * vecB[i]; }
        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    async function getEmbeddingForQuery(query, apiKey) {
        console.log("Getting embedding for query:", query);
        if (!apiKey) throw new Error("OpenAI API Key needed for query embedding.");
        const data = { input: query, model: EMBEDDING_MODEL };
        try {
            const result = await callOpenAI(OPENAI_API_URL_EMBEDDINGS, data, apiKey);
            if (result.data && result.data.length > 0) { console.log("Query embedding received."); return result.data[0].embedding; }
            else throw new Error("No embedding data returned from API.");
        } catch(error) { console.error("Error getting query embedding:", error); throw error; }
    }

    function retrieveContextWithEmbeddings(queryEmbedding, topN = MAX_CONTEXT_CHUNKS) {
        console.log(`Retrieving context using embedding similarity...`);
        // Use the correct variable name 'knowledgeBaseWithEmbeddings'
        if (typeof knowledgeBaseWithEmbeddings === 'undefined' || !Array.isArray(knowledgeBaseWithEmbeddings) || knowledgeBaseWithEmbeddings.length === 0) {
            console.warn("Knowledge base with embeddings is empty or not loaded correctly."); return [];
        }

        const scores = knowledgeBaseWithEmbeddings.map(item => {
            if (!item.embedding || !Array.isArray(item.embedding)) { console.warn(`Item ${item.id} missing embedding.`); return { ...item, score: -1 }; }
            const similarity = cosineSimilarity(queryEmbedding, item.embedding);
            // --- DEBUG LOG: Show individual similarity scores ---
            console.log(`   Sim(${item.id || 'N/A'}, query): ${similarity.toFixed(4)}`);
            // ----------------------------------------------------
            return { ...item, score: similarity };
        });

        scores.sort((a, b) => b.score - a.score);
        const relevantChunks = scores.filter(item => item.score >= MIN_SIMILARITY_SCORE).slice(0, topN);

        console.log(`Found ${relevantChunks.length} relevant chunks (Similarity >= ${MIN_SIMILARITY_SCORE}):`, relevantChunks.map(c => ({id: c.id, score: c.score.toFixed(4)})));
        return relevantChunks.map(item => item.text); // Return text only
    }


    // --- OpenAI API Functions ---
    async function callOpenAI(apiUrl, data, apiKey, responseType = 'json') {
        if (!apiKey) throw new Error("OpenAI API Key is not set.");
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(data) });
            if (!response.ok) { const errorData = await response.json().catch(() => ({ message: response.statusText })); console.error("OpenAI API Error:", response.status, errorData); throw new Error(`API Error ${response.status}: ${errorData.error?.message || errorData.message || 'Unknown error'}`); }
            if (responseType === 'json') return await response.json(); else if (responseType === 'blob') return await response.blob(); else return response;
        } catch (error) { console.error("Error calling OpenAI API:", error); throw error; }
    }

    // MODIFIED: Integrates Embedding RAG
    async function callOpenAIChatCompletion(messages, apiKey, originalQuery) {
        if (isAiThinking) return;
        setAiThinking(true);
        updateAiStatus("AI 正在思考 (Embedding RAG)...");

        let retrievedContextText = "（無法從本地知識庫檢索相關內容）";
        let queryEmbedding = null;

        if (originalQuery) {
             try {
                 updateAiStatus("正在生成查詢向量...");
                 queryEmbedding = await getEmbeddingForQuery(originalQuery, apiKey);
             } catch (error) { console.error("Query Embedding failed:", error); displayBotMessage(`無法生成查詢向量: ${error.message}`, true); updateAiStatus("警告：無法獲取查詢向量"); /* Proceed without RAG */ }
        }

        if (queryEmbedding) {
            updateAiStatus("正在檢索相關知識...");
            try {
                const contextChunks = retrieveContextWithEmbeddings(queryEmbedding); // Use embedding function
                if (contextChunks.length > 0) { retrievedContextText = contextChunks.join("\n\n---\n\n"); }
            } catch (e) { console.error("Error retrieving context with embeddings:", e); }
        }
        console.log("Retrieved Context for Prompt:\n", retrievedContextText.substring(0, 300) + "...");

        const ragSystemPrompt = `你是關於克拉尼圖形模擬器的助手。請根據以下提供的相關知識片段（如果有）、對話歷史和使用者最新的問題來回答。請優先利用提供的知識片段來回答問題。如果知識片段與問題無關或不足，請結合對話歷史和你自己的知識來回答。請回答得詳細且有條理。

[相關知識片段開始]
${retrievedContextText}
[相關知識片段結束]`;

        const recentHistory = messages.filter(m => m.role !== 'system').slice(0, -1);
        const currentUserMessage = messages[messages.length - 1];

        if (!currentUserMessage || currentUserMessage.role !== 'user') { console.error("Error: Could not identify user message for RAG."); setAiThinking(false); updateAiStatus("錯誤：無法處理請求"); return; }

         const messagesToSend = [ { role: "system", content: ragSystemPrompt }, ...recentHistory.slice(-6), currentUserMessage ];
         const data = { model: CHAT_MODEL, messages: messagesToSend, max_tokens: 1000 };
         console.log("Sending RAG Prompt to Chat API:", messagesToSend);

        try {
            updateAiStatus("正在請求 AI 回應...");
            const result = await callOpenAI(OPENAI_API_URL_CHAT, data, apiKey);
            console.log("Received from Chat API (RAG):", result);
            const responseText = result.choices[0]?.message?.content || "抱歉，我無法回應。";
            chatHistory.push({ role: "assistant", content: responseText });
            displayBotMessage(responseText);
            if (isTtsEnabled) await speakText(responseText);
            updateAiStatus("回應完成");
        } catch (error) { displayBotMessage(`發生錯誤: ${error.message}`, true); updateAiStatus("錯誤");
        } finally { setAiThinking(false); }
    }

    // MODIFIED: Integrates Embedding RAG for Vision analysis based on params
    async function getVisionAnalysis(base64ImageChladni, base64ImageKPlot, paramsText) {
        if (isAiThinking) return; setAiThinking(true); updateAiStatus("檢索知識並分析影像...");

        let retrievedContextText = "（未找到與參數相關的本地知識）";
        let queryEmbeddingForVision = null;
        try {
             updateAiStatus("生成參數向量...");
             queryEmbeddingForVision = await getEmbeddingForQuery(paramsText, openaiApiKey); // Embed the parameters text
             if(queryEmbeddingForVision){
                 updateAiStatus("檢索知識(Vision)...");
                 const contextChunks = retrieveContextWithEmbeddings(queryEmbeddingForVision); // Retrieve based on params embedding
                 if (contextChunks.length > 0) { retrievedContextText = contextChunks.join("\n\n---\n\n"); }
             }
        } catch (e) { console.error("Error retrieving context for vision:", e); updateAiStatus("警告：無法檢索知識(Vision)"); }
        console.log("Retrieved Context for Vision Prompt:\n", retrievedContextText.substring(0, 300) + "...");

        const userVisionPrompt = `請分析以下克拉尼模擬結果。\n當前參數：\n${paramsText}`;
        const visionSystemPrompt = `你是一位專業領域是克拉尼圖形的物理學教授。使用者會提供兩個畫面截圖（第一個是克拉尼圖形(Chladni pattern)的沙子分佈，第二個是K值分析圖）以及當前的模擬參數。請參考下方提供的背景知識，結合圖像和參數，用中文詳細地解釋：
1. 克拉尼圖形所呈現的節線(nodal lines)特徵。
2. K值分析圖中的高峰和低峰代表的意義。
3. 當前參數（特別是波數k、中心點x0,y0）如何影響了這個圖形。
4. 總結你利用畫面上的結果和背景知識分析出了什麼。

[背景知識開始]
${retrievedContextText}
[背景知識結束]`;

        chatHistory.push({ role: "user", content: `(使用者請求分析畫面，參數為: ${paramsText})` });
        const messages = [ { role: "system", content: visionSystemPrompt }, { role: "user", content: [ { type: "text", text: userVisionPrompt }, { type: "image_url", image_url: { url: base64ImageChladni, detail: "low" } }, { type: "image_url", image_url: { url: base64ImageKPlot, detail: "low" } } ] } ];

        try {
            updateAiStatus("請求 AI 分析影像...");
            const data = { model: VISION_MODEL, messages: messages, max_tokens: 1000 };
            console.log("Sending Augmented Prompt to Vision API:", messages);
            const result = await callOpenAI(OPENAI_API_URL_CHAT, data, openaiApiKey);
            console.log("Received from Vision API:", result);
            const analysisText = result.choices[0]?.message?.content || "無法取得分析結果。";
            chatHistory.push({ role: "assistant", content: analysisText });
            displayBotMessage(analysisText);
            if (isTtsEnabled) await speakText(analysisText);
            updateAiStatus("分析完成");
        } catch (error) { displayBotMessage(`分析時發生錯誤: ${error.message}`, true); chatHistory.push({ role: "assistant", content: `(分析錯誤: ${error.message})` }); updateAiStatus("分析錯誤");
        } finally { setAiThinking(false); }
    }


    async function speakText(text) { if (!isSoundGloballyEnabled || !isTtsEnabled || !openaiApiKey) { console.log("TTS skipped."); return; } if (!text || text.trim().length === 0) { console.log("TTS skipped: No text."); return; } setAiThinking(true); updateAiStatus("正在生成語音..."); const data = { model: TTS_MODEL, input: text, voice: TTS_VOICE, response_format: "mp3" }; try { const audioBlob = await callOpenAI(OPENAI_API_URL_TTS, data, openaiApiKey, 'blob'); await playAudioBlob(audioBlob); } catch (error) { console.error("TTS Error:", error); displayBotMessage(`語音生成/播放失敗: ${error.message}`, true); updateAiStatus("語音錯誤"); } finally { setAiThinking(false); } }
    async function playAudioBlob(blob) { if (!audioCtx) initAudio(); if (!audioCtx) return Promise.reject("AudioContext not available"); await resumeAudioContext(); return new Promise(async (resolve, reject) => { if (audioCtx.state !== 'running') { console.error('AudioContext not running, cannot play TTS.'); updateAiStatus("音訊錯誤"); reject(new Error("AudioContext not running.")); return; } try { if (ttsAudioPlayer && ttsAudioPlayer.context) { try { ttsAudioPlayer.stop(); } catch (e) { } } const arrayBuffer = await blob.arrayBuffer(); await audioCtx.decodeAudioData(arrayBuffer, (buffer) => { ttsAudioPlayer = audioCtx.createBufferSource(); ttsAudioPlayer.buffer = buffer; ttsAudioPlayer.connect(audioCtx.destination); ttsAudioPlayer.onended = () => { console.log("TTS playback finished."); updateAiStatus("語音播放完畢"); resolve(); }; ttsAudioPlayer.start(0); updateAiStatus("正在播放語音..."); }, (e) => { console.error("Error decoding audio data:", e); updateAiStatus("語音解碼錯誤"); reject(new Error("無法解碼語音資料")); }); } catch (error) { console.error("Error playing audio blob:", error); updateAiStatus("語音播放錯誤"); reject(error); } }); }
    function displayUserMessage(message) { const messageEl = document.createElement('div'); messageEl.classList.add('message', 'user'); messageEl.textContent = message; chatMessages.appendChild(messageEl); chatMessages.scrollTop = chatMessages.scrollHeight; }
    function displayBotMessage(message, isError = false) { const messageEl = document.createElement('div'); messageEl.classList.add('message', 'bot'); if (isError) { messageEl.classList.add('error'); messageEl.textContent = message; } else { try { if (typeof marked !== 'undefined') { messageEl.innerHTML = marked.parse(message); } else { console.warn("Marked library not loaded."); messageEl.textContent = message; } } catch (e) { console.error("Markdown parsing error:", e); messageEl.textContent = message; } } chatMessages.appendChild(messageEl); chatMessages.scrollTop = chatMessages.scrollHeight; }
    function updateAiStatus(text) { aiStatus.textContent = `狀態：${text}`; aiStatus.className = text.includes("錯誤") ? 'status error' : (text.includes("...") || text.includes("生成") || text.includes("分析") || text.includes("播放") || text.includes("檢索") || text.includes("向量")) ? 'status thinking' : 'status'; }
    function setAiThinking(thinking) { isAiThinking = thinking; analyzeScreenBtn.disabled = thinking || !openaiApiKey; sendChatBtn.disabled = thinking || !openaiApiKey; chatInput.disabled = thinking || !openaiApiKey; }
    function handleSetApiKey() { const key = apiKeyInput.value.trim(); if (key) { openaiApiKey = key; apiKeyInput.value = ""; console.warn("OpenAI API Key set. Keep it secure!"); updateAiStatus("API Key 已設定"); setAiThinking(false); } else { openaiApiKey = null; updateAiStatus("API Key 為空"); setAiThinking(true); } }
    function handleToggleChatbot() { chatbotWindow.classList.toggle('hidden'); }
    async function handleAnalyzeScreen() { if (!openaiApiKey) { displayBotMessage("錯誤：請先設定 API Key。", true); updateAiStatus("錯誤：未設定 API Key"); return; } if (isAiThinking) return; updateAiStatus("正在擷取畫面..."); await new Promise(resolve => setTimeout(resolve, 50)); try { const chladniImg = chladniCanvas.toDataURL('image/png'); const kPlotImg = kPlotCanvas.toDataURL('image/png'); const params = `- 波數 (k): ${waveNumberInput.value}\n- 中心點 (x0, y0): (${xOffsetInput.value}, ${yOffsetInput.value})\n- Gamma (阻尼): ${gammaInput.value}\n- 沙子數量: ${sandParticles.length}\n- 背景圖顯示: ${showIntensityBackground ? '是' : '否'}`.trim(); await getVisionAnalysis(chladniImg, kPlotImg, params); } catch (error) { console.error("Error during screen analysis prep:", error); displayBotMessage(`擷取失敗: ${error.message}`, true); updateAiStatus("分析準備錯誤"); setAiThinking(false); } }
    function handleTtsToggle() { isTtsEnabled = enableTtsCheckbox.checked; console.log("TTS Enabled:", isTtsEnabled); if (!isTtsEnabled && ttsAudioPlayer) { try { ttsAudioPlayer.stop(); } catch (e) { } updateAiStatus("語音已禁用"); } }

    // MODIFIED: Calls RAG-enhanced chat completion using embeddings
    async function handleSendChatMessage() {
        const userMessage = chatInput.value.trim();
        if (!userMessage || isAiThinking || !openaiApiKey) { if (!openaiApiKey) { displayBotMessage("錯誤：請先設定 API Key。", true); updateAiStatus("錯誤：未設定 API Key"); } return; }
        displayUserMessage(userMessage); chatInput.value = "";
        chatHistory.push({ role: "user", content: userMessage });
        const messagesForApi = [...chatHistory.slice(-8)];
        // Pass userMessage to callOpenAIChatCompletion, which handles getting embedding etc.
        await callOpenAIChatCompletion(messagesForApi, openaiApiKey, userMessage);
    }

    // --- Initialization Function ---
    function init() {
        loadSettings(); initAudio(); handleStopContinuousSand(); stopBtn.disabled = true; continueBtn.disabled = true;
        drawChladniPattern(); updateSoundParameters();
        updateAiStatus("請先設定 API Key"); analyzeScreenBtn.disabled = true; sendChatBtn.disabled = true; chatInput.disabled = true;
        chatHistory = [];
        // Check for the correct knowledge base variable
        if (typeof knowledgeBaseWithEmbeddings === 'undefined' || !Array.isArray(knowledgeBaseWithEmbeddings)) {
            console.error("Knowledge base 'knowledgeBaseWithEmbeddings' is not defined. Check knowledge_embeddings.js.");
            displayBotMessage("錯誤：本地知識庫(Embeddings)載入失敗。", true);
        } else if (knowledgeBaseWithEmbeddings.length === 0) {
            console.warn("Knowledge base with embeddings is empty.");
        } else {
             console.log("Knowledge base with embeddings loaded successfully.");
        }
    }

    // --- ATTACH EVENT LISTENERS ---
    runBtn.addEventListener('click', handleRun); runLotBtn.addEventListener('click', handleRunLot);
    stopBtn.addEventListener('click', handleStop); continueBtn.addEventListener('click', handleContinue);
    resetBtn.addEventListener('click', handleReset); generateSandBtn.addEventListener('click', generateSand);
    clearSandBtn.addEventListener('click', clearSand); startContinuousSandBtn.addEventListener('click', handleStartContinuousSand);
    stopContinuousSandBtn.addEventListener('click', handleStopContinuousSand); enableSoundCheckbox.addEventListener('change', handleSoundToggle);
    updateSoundBtn.addEventListener('click', updateSoundParameters); showBackgroundIntensityCheckbox.addEventListener('change', handleBackgroundToggle);
    plotKBtn.addEventListener('click', plotKGraph); screenshotBtn.addEventListener('click', handleScreenshot);
    saveSettingsBtn.addEventListener('click', saveSettings); loadSettingsBtn.addEventListener('click', loadSettings);
    setApiKeyBtn.addEventListener('click', handleSetApiKey); apiKeyInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSetApiKey(); });
    toggleChatbotBtn.addEventListener('click', handleToggleChatbot); analyzeScreenBtn.addEventListener('click', handleAnalyzeScreen);
    enableTtsCheckbox.addEventListener('change', handleTtsToggle); sendChatBtn.addEventListener('click', handleSendChatMessage);
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChatMessage(); } });

    // --- Initial Setup Call ---
    init();

}); // End DOMContentLoaded