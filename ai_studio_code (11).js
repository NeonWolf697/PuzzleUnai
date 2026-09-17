/**
 * UNAI PUZZLE - Lógica del Juego
 * Separado en su propio archivo para mayor limpieza y estabilidad.
 */

// --- CONFIGURACIÓN ---
const GRID_SIZE = 8;
const TOTAL_PIECES = GRID_SIZE * GRID_SIZE;
const IMAGE_SRC = 'Unai.png';

// El mensaje exacto, palabra por palabra, para la cara trasera
const FINAL_MESSAGE_TEXT = "Eres suficiente, eres inteligente, eres un sobresaliente, y lo único que tienes que hacer para creértelo es ser paciente, ser valiente requiere estar triste de vez en cuando, pero al fin y al cabo, cuando mires el pasado, recuerda que vivir el futuro es el verdadero regalo.";

// --- ESTADO GLOBAL ---
const state = {
    pieces: [], // Array con el orden actual de las piezas
    selectedPieceIndex: null, // Índice (0-63) en el DOM de la pieza seleccionada
    isCompleting: false, // Bloquea controles durante la animación final
    isSolved: false,
    soundEnabled: true,
    cuacCount: 0,
    imageLoaded: false,
    animationsAllowed: window.matchMedia('(prefers-reduced-motion: no-preference)').matches
};

// --- REFERENCIAS A DOM ---
const board = document.getElementById('puzzle-board');
const shuffleBtn = document.getElementById('shuffle-btn');
const resetBtn = document.getElementById('reset-btn');
const soundToggleBtn = document.getElementById('sound-toggle');
const antistressBtn = document.getElementById('antistress-btn');
const duckHead = document.getElementById('duck-head');
const cuacsCounter = document.getElementById('cuacs-counter');
const antistressMsg = document.getElementById('antistress-msg');
const loadingOverlay = document.getElementById('loading-overlay');
const victoryMessage = document.getElementById('victory-message');

// --- AUDIO (Web Audio API) ---
let audioCtx = null;
let messageTimer = null; // Para controlar la desaparición del mensaje del pato

function initAudio() {
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (error) {
        console.warn("No se pudo inicializar el audio:", error);
    }
}

// Sonido suave genérico para interacciones
function playTone(frequency, duration = 0.12, type = 'sine', volume = 0.05, delay = 0) {
    if (!state.soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);

    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + delay);
    // Envolvente exponencial suave (ataque y caída)
    gain.gain.exponentialRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + delay + duration);

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime + delay);
    oscillator.stop(audioCtx.currentTime + delay + duration + 0.02);
}

function playSelectSound() { playTone(520, 0.08, 'sine', 0.035); }
function playSwapSound() {
    playTone(620, 0.07, 'sine', 0.04);
    playTone(780, 0.1, 'sine', 0.035, 0.06);
}
function playVictorySound() {
    playTone(523.25, 0.16, 'sine', 0.045);
    playTone(659.25, 0.16, 'sine', 0.045, 0.13);
    playTone(783.99, 0.22, 'sine', 0.05, 0.26);
}

// Sonido de pato más complejo
function playDuckSound() {
    if (!state.soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    // Primer "cuac"
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(420, now);
    osc1.frequency.exponentialRampToValueAtTime(180, now + 0.13);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.09, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Segundo pequeño "cuac"
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(380, now + 0.13);
    osc2.frequency.exponentialRampToValueAtTime(160, now + 0.25);
    gain2.gain.setValueAtTime(0.0001, now + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.07, now + 0.145);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.13);
    osc2.stop(now + 0.3);
}

// --- LÓGICA DEL PUZZLE ---

// Crea el estado inicial ordenado
function createPieces() {
    state.pieces = [];
    for (let i = 0; i < TOTAL_PIECES; i++) {
        state.pieces.push({ id: i }); // id es su posición correcta
    }
}

// Mezcla Fisher-Yates
function shufflePieces() {
    if (!state.animationsAllowed) return; // No mezclar si el usuario no quiere animaciones
    for (let i = state.pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.pieces[i], state.pieces[j]] = [state.pieces[j], state.pieces[i]];
    }
    // Evitar que accidentalmente quede resuelto
    if (isSolvedPosition()) {
        shufflePieces();
    }
}

// Comprueba lógicamente si está resuelto
function isSolvedPosition() {
    return state.pieces.every((piece, index) => piece.id === index);
}

// Renderiza el tablero en el DOM
function renderPuzzle() {
    // Limpia el tablero actual
    board.querySelectorAll('.piece').forEach(p => p.remove());

    state.pieces.forEach((piece, position) => {
        const element = document.createElement('div');
        element.className = 'piece';
        element.dataset.id = piece.id;
        element.dataset.position = position; // Posición actual en el array

        const inner = document.createElement('div');
        inner.className = 'piece-inner';

        const front = document.createElement('div');
        front.className = 'piece-front';
        const back = document.createElement('div');
        back.className = 'piece-back';

        // Cara delantera: Sección de Unai.png
        const row = Math.floor(piece.id / GRID_SIZE);
        const col = piece.id % GRID_SIZE;
        front.style.backgroundImage = `url("${IMAGE_SRC}")`;
        front.style.backgroundSize = `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`;
        const x = (col / (GRID_SIZE - 1)) * 100;
        const y = (row / (GRID_SIZE - 1)) * 100;
        front.style.backgroundPosition = `${x}% ${y}%`;

        // Cara trasera: Bloque de texto
        const textBlock = document.createElement('div');
        textBlock.className = 'text-block';
        // El texto se divide lógicamente entre las 64 piezas.
        // La clase CSS #puzzle-board.text-mode .text-block se asegura de que se compongan correctamente.
        textBlock.textContent = FINAL_MESSAGE_TEXT;
        back.appendChild(textBlock);

        inner.appendChild(front);
        inner.appendChild(back);
        element.appendChild(inner);

        // Eventos táctiles y de ratón
        addPieceEvents(element);

        board.appendChild(element);
    });
}

// --- INTERACCIÓN DE PIEZAS ---

function addPieceEvents(element) {
    // Sistema de Selección por Toque (especialmente para móvil)
    element.addEventListener('click', (event) => {
        if (state.isCompleting || state.isSolved) return;
        initAudio();

        const clickedPos = Number(element.dataset.position);

        if (state.selectedPieceIndex === null) {
            // Primera selección
            state.selectedPieceIndex = clickedPos;
            element.classList.add('selected');
            playSelectSound();
        } else {
            // Segunda selección
            const firstPos = state.selectedPieceIndex;
            if (firstPos === clickedPos) {
                // Clic en la misma pieza: deseleccionar
                element.classList.remove('selected');
                state.selectedPieceIndex = null;
                return;
            }
            // Intercambiar
            swapPieces(firstPos, clickedPos);
            clearSelection();
            playSwapSound();
            checkVictory();
        }
    });

    // Sistema de Arrastrar y Soltar (Mouse y Touch)
    element.setAttribute('draggable', 'true');

    element.addEventListener('dragstart', (event) => {
        if (state.isCompleting || state.isSolved) {
            event.preventDefault();
            return;
        }
        initAudio();
        element.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', element.dataset.position);
    });

    element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
    });

    element.addEventListener('dragover', (event) => {
        if (state.isCompleting || state.isSolved) return;
        event.preventDefault(); // Necesario para permitir el drop
        element.classList.add('over');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('over');
    });

    element.addEventListener('drop', (event) => {
        if (state.isCompleting || state.isSolved) return;
        event.preventDefault();
        element.classList.remove('over');

        const fromPos = Number(event.dataTransfer.getData('text/plain'));
        const toPos = Number(element.dataset.position);

        if (Number.isInteger(fromPos) && Number.isInteger(toPos) && fromPos !== toPos) {
            swapPieces(fromPos, toPos);
            clearSelection();
            playSwapSound();
            checkVictory();
        }
    });
}

function swapPieces(posA, posB) {
    [state.pieces[posA], state.pieces[posB]] = [state.pieces[posB], state.pieces[posA]];
    renderPuzzle(); // Vuelve a renderizar el tablero con el nuevo orden
}

function clearSelection() {
    state.selectedPieceIndex = null;
    board.querySelectorAll('.piece.selected').forEach(p => p.classList.remove('selected'));
}

// --- LÓGICA DE VICTORIA Y REVELACIÓN ---

function checkVictory() {
    if (state.isCompleting || state.isSolved) return;
    if (!isSolvedPosition()) return;
    completePuzzle();
}

async function completePuzzle() {
    state.isCompleting = true;
    clearSelection();

    // Bloquear controles
    shuffleBtn.disabled = true;
    resetBtn.disabled = true;
    soundToggleBtn.disabled = true;

    // Efecto visual en el tablero
    board.classList.add('completed');
    victoryMessage.classList.add('show');

    playVictorySound();

    // Esperar a que termine el sonido y el mensaje de éxito
    await new Promise(resolve => setTimeout(resolve, 900));
    victoryMessage.classList.remove('show');

    // Iniciar la animación de revelación (giro 3D)
    const pieces = [...board.querySelectorAll('.piece')];

    // Marcar todas como "girando"
    pieces.forEach(piece => piece.classList.add('flipping'));

    // Efecto cascada: girar progresivamente cada pieza
    for (let i = 0; i < pieces.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 45)); // Pequeño intervalo
        pieces[i].classList.add('flipped');
        // Sonido suave por cada pieza que gira
        playTone(500 + (i * 3), 0.07, 'sine', 0.018);
    }

    // Esperar a que termine el último giro
    await new Promise(resolve => setTimeout(resolve, 700));

    // Activar modo de texto final (donde el texto se agranda para ser legible)
    board.classList.add('text-mode');

    state.isSolved = true;
    state.isCompleting = false;
}

// --- CONTROL DE CONTROLES ---

function startNewGame() {
    state.isCompleting = false;
    state.isSolved = false;
    state.selectedPieceIndex = null;
    board.classList.remove('completed', 'text-mode');
    victoryMessage.classList.remove('show');
    shuffleBtn.disabled = false;
    resetBtn.disabled = false;
    soundToggleBtn.disabled = false;
    createPieces();
    shufflePieces();
    renderPuzzle();
}

shuffleBtn.addEventListener('click', () => {
    initAudio();
    startNewGame();
});

resetBtn.addEventListener('click', () => {
    initAudio();
    startNewGame();
});

// --- SONIDO ON/OFF ---

soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    if (state.soundEnabled) {
        initAudio();
        soundToggleBtn.textContent = "🔊 Sonido: ON";
        playTone(660, 0.1, 'sine', 0.04); // Sonido de confirmación
    } else {
        soundToggleBtn.textContent = "🔇 Sonido: OFF";
    }
});

// --- BOTÓN ANTIESTRÉS (Pato) ---

// Mensajes aleatorios del pato
const duckMessages = [
    "CUAC.",
    "Cuac terapéutico.",
    "Unai aprueba este cuac.",
    "Todo bajo control.",
    "Respira. 🐤",
    "Un cuac y seguimos.",
    "🐤"
];

function showDuckMessage() {
    const message = duckMessages[Math.floor(Math.random() * duckMessages.length)];
    antistressMsg.textContent = message;
    antistressMsg.classList.remove('show');
    // Forzar reflow para reiniciar la animación CSS
    void antistressMsg.offsetWidth;
    antistressMsg.classList.add('show');

    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
        antistressMsg.classList.remove('show');
    }, 1400);
}

antistressBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault(); // Prevenir focus y scroll
    initAudio();

    // Contador
    state.cuacCount++;
    cuacsCounter.textContent = `Cuacs: ${state.cuacCount}`;

    // Son