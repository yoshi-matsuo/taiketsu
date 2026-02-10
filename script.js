// Game Constants
const ROOM_PARAM = 'room';

// Global State
let state = {
    roomId: null,
    playerId: null, // UUID from Supabase or random
    playerName: null,
    playerNumber: null, // Player number (1, 2, 3...)
    role: 'host', // 'host' or 'player'
    players: {}, // Map of presence state
    questions: [],
    shuffledQuestions: [], // Shuffled copy of questions
    usedQuestionIds: [], // Track used question IDs (persisted in localStorage)
    currentQuestionIndex: -1,
    currentQuestion: null, // Track current question object {text, answer}
    scores: {}, // Map of playerId -> score
    isBuzzed: false, // Local state to disable buzzer
    buzzedPlayerId: null, // Id of who buzzed first for current Q
    lockedPlayerId: null, // Player who got wrong answer and must skip next question
    timerId: null, // Timer interval ID
    timeLeft: 20 // Seconds remaining
};

// UI Elements
const ui = {
    waitingScreen: document.getElementById('waiting-screen'),
    gameScreen: document.getElementById('game-screen'),
    playerList: document.querySelector('.player-list'),
    roomUrl: document.getElementById('room-url'),
    startBtn: document.getElementById('start-btn'),
    statusBar: document.querySelector('.status-bar'),
    questionNumber: document.querySelector('.question-number'),
    questionText: document.querySelector('.question-text'),
    answerText: document.querySelector('.answer-text'),
    buzzerBtn: document.getElementById('buzzer-btn'),
    buzzerMessage: document.getElementById('buzzer-message'),
    controlPanel: document.querySelector('.control-panel'),
    btnStartQ: document.querySelector('.control-btn.start'),
    btnShowAns: document.querySelector('.control-btn.answer'),
    btnCorrect: document.querySelector('.control-btn.correct'),
    btnWrong: document.querySelector('.control-btn.wrong'),
    timer: document.getElementById('timer'),
};

// --- Audio Context for Sound Effects ---
let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Buzzer sound - short sharp beep
function playBuzzerSound() {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
}

// Correct answer sound - happy ascending tones
function playCorrectSound() {
    const ctx = getAudioContext();
    const frequencies = [523, 659, 784]; // C5, E5, G5

    frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + i * 0.1;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.2);
    });
}

// Wrong answer sound - descending buzz
function playWrongSound() {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
}

// Start question sound - dramatic quiz show "ダダッ！" style
function playStartSound() {
    const ctx = getAudioContext();

    // First hit
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(200, ctx.currentTime);
    gain1.gain.setValueAtTime(0.5, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.1);

    // Second hit (slightly higher, louder)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(300, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.6, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.25);

    // Add a bass thump for impact
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.connect(bassGain);
    bassGain.connect(ctx.destination);
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(80, ctx.currentTime);
    bassGain.gain.setValueAtTime(0.4, ctx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    bassOsc.start(ctx.currentTime);
    bassOsc.stop(ctx.currentTime + 0.2);
}

// Timeout sound - low warning tone
function playTimeoutSound() {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
}

// --- Initialization ---

async function init() {
    console.log("Initializing Game...");

    // 4. Setup Event Listeners (Setup UI first so buttons work even if network fails)
    setupUIControls();

    // 1. Load QA Data
    try {
        const response = await fetch('QA.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        state.questions = await response.json();
        console.log("Questions Loaded:", state.questions.length);
    } catch (e) {
        console.error("Failed to load QA.json", e);
        alert("Failed to load questions: " + e.message);
    }

    // 2. Identify Player & Room
    state.playerId = crypto.randomUUID();

    const urlParams = new URLSearchParams(window.location.search);
    state.roomId = urlParams.get(ROOM_PARAM);

    if (!state.roomId) {
        // Create new room if none exists
        state.roomId = generateRoomId();
        const newUrl = new URL(window.location);
        newUrl.searchParams.set(ROOM_PARAM, state.roomId);
        window.history.pushState({}, '', newUrl);

        state.role = 'host'; // Creator is host
        state.playerNumber = 1;
        state.playerName = "Player 1";

        // Persist Host status for this room
        sessionStorage.setItem(`is_host_${state.roomId}`, 'true');
        sessionStorage.setItem(`player_number_${state.roomId}`, '1');
    } else {
        // Check if I was the host of this room previously
        const savedPlayerNumber = sessionStorage.getItem(`player_number_${state.roomId}`);
        if (sessionStorage.getItem(`is_host_${state.roomId}`) === 'true') {
            state.role = 'host';
            state.playerNumber = parseInt(savedPlayerNumber) || 1;
            state.playerName = `Player ${state.playerNumber}`;
        } else {
            state.role = 'player';
            // Assign a new player number if not already assigned
            state.playerNumber = parseInt(savedPlayerNumber) || (Math.floor(Math.random() * 2) + 2);
            state.playerName = `Player ${state.playerNumber}`;
            sessionStorage.setItem(`player_number_${state.roomId}`, state.playerNumber.toString());
        }
    }

    // Update UI for Room URL
    ui.roomUrl.textContent = window.location.href;

    // 3. Connect to Supabase
    try {
        setupSupabase();
    } catch (e) {
        console.error("Supabase Setup Failed:", e);
        alert("Connection Error: Check Console");
    }
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// --- Supabase Realtime ---

let channel;
// Global supabase client variable (initialized in setupSupabase)
// Global supabase client variable (initialized in setupSupabase)
let supabaseClient;

function setupSupabase() {
    if (!window.supabase) {
        throw new Error("Supabase library not loaded. Check your internet connection.");
    }
    const { createClient } = window.supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    channel = supabaseClient.channel(`quiz_room_${state.roomId}`, {
        config: {
            presence: {
                key: state.playerId,
            },
        },
    });

    channel
        .on('presence', { event: 'sync' }, () => {
            const newState = channel.presenceState();
            updatePlayersList(newState);
        })
        .on('broadcast', { event: 'game_event' }, ({ payload }) => {
            handleGameEvent(payload);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({
                    id: state.playerId,
                    name: state.playerName,
                    role: state.role, // Initial role
                    score: 0
                });
            }
        });
}

// --- Presence & Player Management ---

function updatePlayersList(presenceState) {
    state.players = {};
    ui.playerList.innerHTML = '';
    ui.statusBar.innerHTML = '';

    // Sort keys to maintain order? Or just iterate.
    // Presence state is object: { "playerId": [ { meta } ] }

    Object.values(presenceState).forEach(presences => {
        const player = presences[0]; // Take latest if multiple
        if (!player) return;

        state.players[player.id] = player;

        // Update Waiting Screen List
        const div = document.createElement('div');
        div.className = 'player-item';
        const isMe = player.id === state.playerId;
        const youLabel = isMe ? '(You)' : '';
        const displayName = `${player.name} ${youLabel}`.trim();
        div.innerHTML = `
            <span class="avatar">${GetAvatar(player.id)}</span>
            <span class="name">${displayName}</span>
        `;
        ui.playerList.appendChild(div);

        // Update Game Screen Status Bar
        // Re-render all for simplicity
        const statusDiv = document.createElement('div');
        statusDiv.className = `player-status ${state.buzzedPlayerId === player.id ? 'active' : ''}`;
        statusDiv.id = `status-${player.id}`;
        statusDiv.innerHTML = `
             <div class="player-info">
                <span class="avatar">${GetAvatar(player.id)}</span>
                <span class="name">${player.name}</span>
            </div>
            <span class="score">${player.score || 0} pts</span>
        `;
        ui.statusBar.appendChild(statusDiv);
    });

    // If I am host, show control panel
    if (state.role === 'host') {
        ui.controlPanel.style.display = 'flex';
        ui.startBtn.style.display = 'block'; // Only host can start
    } else {
        ui.controlPanel.style.display = 'none';
        ui.startBtn.style.display = 'none';
        // Check if there is a host in the room?
    }
}

function GetAvatar(seed) {
    const avatars = ['🐱', '🐶', '🦊', '🐼', '🐨', '🐯'];
    // Simple hash to pick avatar
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash += seed.charCodeAt(i);
    return avatars[hash % avatars.length];
}

// --- Game Logic Broadcasts (Host) ---

function broadcast(type, data) {
    console.log("Broadcasting:", type, data);
    if (!channel) {
        console.error("Channel not initialized!");
        return;
    }
    channel.send({
        type: 'broadcast',
        event: 'game_event',
        payload: { type, ...data }
    }).catch(err => console.error("Broadcast Error:", err));
}

function hostStartGame() {
    // Shuffle questions at game start for variety
    state.shuffledQuestions = shuffleArray(state.questions);
    broadcast('start_game', { shuffledOrder: state.shuffledQuestions.map((q, i) => state.questions.indexOf(q)) });
    // Also handle locally since broadcast doesn't reach sender
    handleGameEvent({ type: 'start_game', shuffledOrder: state.shuffledQuestions.map((q, i) => state.questions.indexOf(q)) });
    setTimeout(hostNextQuestion, 1000);
}

function hostNextQuestion() {
    // Load used question history from localStorage (by question ID for persistence across updates)
    const storedHistory = localStorage.getItem('usedQuestionIds');
    if (storedHistory) {
        state.usedQuestionIds = JSON.parse(storedHistory);
    }

    // Find questions whose ID is not in the used list
    let availableQuestions = state.questions.filter(q => !state.usedQuestionIds.includes(q.id));

    // If all questions have been used, remove oldest entries until one becomes available
    while (availableQuestions.length === 0 && state.usedQuestionIds.length > 0) {
        state.usedQuestionIds.shift();
        availableQuestions = state.questions.filter(q => !state.usedQuestionIds.includes(q.id));
    }

    // Pick a random question from available
    const question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    const randomIndex = state.questions.indexOf(question);

    // Add to used questions list
    state.usedQuestionIds.push(question.id);

    // Persist to localStorage
    localStorage.setItem('usedQuestionIds', JSON.stringify(state.usedQuestionIds));

    state.currentQuestionIndex++;

    // Reset Host State
    state.isBuzzed = false;
    state.buzzedPlayerId = null;
    // Keep lockedPlayerId - will be cleared after this question

    const payload = {
        type: 'next_question',
        questionIndex: randomIndex, // The actual question index
        text: question.question,
        answer: question.answer,
        number: state.currentQuestionIndex + 1,
        lockedPlayerId: state.lockedPlayerId // Send who is locked for this question
    };
    broadcast('next_question', payload);
    // Handle locally for host
    handleGameEvent(payload);

    // Clear locked player for host after broadcasting
    state.lockedPlayerId = null;
}

function hostShowAnswer() {
    // Use the tracked current question answer
    if (!state.currentQuestion) {
        console.error("No current question to show answer for");
        return;
    }
    const payload = { type: 'show_answer', answer: state.currentQuestion.answer };
    broadcast('show_answer', payload);
    handleGameEvent(payload);
}
function hostJudge(correct) {
    if (!state.buzzedPlayerId) return;

    const points = correct ? 1 : -1;
    const wrongPlayerId = correct ? null : state.buzzedPlayerId;

    // Host updates the score of the buzzed player
    const payload = {
        type: 'judge_result',
        playerId: state.buzzedPlayerId,
        delta: points,
        correct: correct,
        lockedPlayerId: wrongPlayerId // Player to lock for next question
    };
    broadcast('judge_result', payload);
    handleGameEvent(payload);

    // Store who should be locked for next question
    state.lockedPlayerId = wrongPlayerId;

    if (correct) {
        // Do NOT auto-advance - host must manually click Start Q
        // Just reset buzz state
        state.isBuzzed = false;
        state.buzzedPlayerId = null;
    } else {
        // Reset local host state for buzz, let others try
        state.isBuzzed = false;
        state.buzzedPlayerId = null;
        const resumePayload = { type: 'resume_question', lockedPlayerId: wrongPlayerId };
        broadcast('resume_question', resumePayload);
        handleGameEvent(resumePayload);
    }
}

// --- Event Handling (Client) ---

function handleGameEvent(payload) {
    // console.log("Event:", payload);
    switch (payload.type) {
        case 'start_game':
            ui.waitingScreen.classList.add('hidden');
            ui.gameScreen.classList.remove('hidden');
            break;

        case 'next_question':
            // Clear previous timer
            if (state.timerId) {
                clearInterval(state.timerId);
                state.timerId = null;
            }

            // Store current question for answer lookup
            state.currentQuestion = {
                text: payload.text,
                answer: payload.answer
            };

            ui.questionText.textContent = payload.text;
            ui.questionNumber.textContent = `Q. ${payload.number}`;
            ui.answerText.classList.add('hidden');
            ui.buzzerMessage.classList.add('hidden');

            // Reset Client State
            state.isBuzzed = false;
            state.buzzedPlayerId = null;
            state.lockedPlayerId = payload.lockedPlayerId || null;
            updateActivePlayerUI();

            // Enable buzzer (unless I am the locked player)
            if (state.lockedPlayerId === state.playerId) {
                ui.buzzerBtn.disabled = true;
                ui.buzzerBtn.style.opacity = 0.5;
                ui.buzzerMessage.textContent = '1回休み';
                ui.buzzerMessage.classList.remove('hidden');
            } else {
                ui.buzzerBtn.disabled = false;
                ui.buzzerBtn.style.opacity = 1;
                ui.buzzerBtn.style.transform = 'scale(1)';
            }

            // Start 20-second timer
            state.timeLeft = 20;
            ui.timer.textContent = state.timeLeft;
            ui.timer.classList.remove('hidden');
            state.timerId = setInterval(() => {
                state.timeLeft--;
                ui.timer.textContent = state.timeLeft;
                if (state.timeLeft <= 5) {
                    ui.timer.classList.add('warning');
                }
                if (state.timeLeft <= 0) {
                    clearInterval(state.timerId);
                    state.timerId = null;
                    ui.timer.classList.add('hidden');
                    ui.timer.classList.remove('warning');
                    // Timeout - disable buzzer and show timeout message
                    playTimeoutSound();
                    state.isBuzzed = true;
                    ui.buzzerBtn.disabled = true;
                    ui.buzzerBtn.style.opacity = 0.5;
                    ui.buzzerMessage.textContent = 'Time Up!';
                    ui.buzzerMessage.classList.remove('hidden');
                    // Host shows answer on timeout
                    if (state.role === 'host') {
                        setTimeout(hostShowAnswer, 1000);
                    }
                }
            }, 1000);
            break;

        case 'buzz_request':
            // HOST ONLY logic
            if (state.role === 'host') {
                if (!state.isBuzzed) {
                    state.isBuzzed = true;
                    state.buzzedPlayerId = payload.playerId;
                    // Stop timer
                    if (state.timerId) {
                        clearInterval(state.timerId);
                        state.timerId = null;
                    }
                    ui.timer.classList.add('hidden');
                    ui.timer.classList.remove('warning');
                    // Broadcast Winner
                    const winnerPayload = { type: 'buzz_winner', playerId: payload.playerId };
                    broadcast('buzz_winner', winnerPayload);
                    handleGameEvent(winnerPayload);
                }
            }
            break;

        case 'buzz_winner':
            // All clients handle who won the buzz
            playBuzzerSound(); // Play buzzer sound for everyone
            // Stop timer on all clients
            if (state.timerId) {
                clearInterval(state.timerId);
                state.timerId = null;
            }
            ui.timer.classList.add('hidden');
            ui.timer.classList.remove('warning');
            state.buzzedPlayerId = payload.playerId;
            state.isBuzzed = true;
            ui.buzzerBtn.disabled = true; // Lock everyone
            ui.buzzerBtn.style.opacity = 0.5;

            const player = state.players[payload.playerId];
            const name = player ? player.name : "Unknown";
            ui.buzzerMessage.textContent = `${name} Press!`;
            ui.buzzerMessage.classList.remove('hidden');
            updateActivePlayerUI();
            break;

        case 'show_answer':
            ui.answerText.textContent = `Answer: ${payload.answer}`;
            ui.answerText.classList.remove('hidden');
            break;

        case 'judge_result':
            if (payload.playerId === state.playerId) {
                // Update my score if I was the one judged
                const myCurrentScore = (state.players[state.playerId] && state.players[state.playerId].score) || 0;
                channel.track({
                    id: state.playerId,
                    name: state.playerName,
                    role: state.role,
                    score: myCurrentScore + payload.delta
                });
            }
            break;

        case 'resume_question':
            state.isBuzzed = false;
            state.buzzedPlayerId = null;
            ui.buzzerMessage.classList.add('hidden');

            // Keep the wrong player locked for the rest of this question
            if (payload.lockedPlayerId === state.playerId) {
                ui.buzzerBtn.disabled = true;
                ui.buzzerBtn.style.opacity = 0.5;
            } else {
                ui.buzzerBtn.disabled = false;
                ui.buzzerBtn.style.opacity = 1;
            }
            break;
    }
}

function updateActivePlayerUI() {
    document.querySelectorAll('.player-status').forEach(el => el.classList.remove('active'));
    if (state.buzzedPlayerId) {
        const el = document.getElementById(`status-${state.buzzedPlayerId}`);
        if (el) el.classList.add('active');
    }
}

// --- UI Controls ---

function setupUIControls() {
    // Copy URL
    document.querySelector('.copy-btn').addEventListener('click', function() {
        const url = window.location.href;
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        let success = false;
        try {
            success = document.execCommand('copy');
        } catch (err) {
            console.error('Copy failed:', err);
        }

        document.body.removeChild(textArea);

        if (success) {
            const btn = document.querySelector('.copy-btn');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        } else {
            prompt('Copy this URL:', url);
        }
    });

    // Start Game (Host)
    ui.startBtn.addEventListener('click', () => {
        console.log("Start Button Clicked");
        hostStartGame();
    });

    // Control Panel (Host)
    ui.btnStartQ.addEventListener('click', () => {
        playStartSound();
        hostNextQuestion();
    });
    ui.btnShowAns.addEventListener('click', hostShowAnswer);
    ui.btnCorrect.addEventListener('click', () => {
        playCorrectSound();
        hostJudge(true);
    });
    ui.btnWrong.addEventListener('click', () => {
        playWrongSound();
        hostJudge(false);
    });

    // Buzzer (Player)
    ui.buzzerBtn.addEventListener('click', () => {
        if (state.isBuzzed) return;
        if (ui.buzzerBtn.disabled) return;
        // Send request to host
        console.log("Buzz Request Sent");
        const payload = { type: 'buzz_request', playerId: state.playerId, timestamp: Date.now() };
        broadcast('buzz_request', payload);
        // If I am the host, also handle locally since broadcast doesn't reach self
        if (state.role === 'host') {
            handleGameEvent(payload);
        }
    });
}

// Run
// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    init();
});
