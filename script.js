/**
 * JAYDEN SUDOKU (제이든의 스도쿠)
 * script.js - 게임의 핵심 로직을 담당하는 파일입니다.
 * 
 * 목차:
 * 1. DOM 요소 & 설정 (Configuration)
 * 2. 상태 관리 (State Management)
 * 3. 사운드 매니저 (Sound Manager)
 * 4. 초기화 및 이벤트 리스너 (Initialization)
 * 5. 게임 로직 (Game Logic: 입력, 메모, 힌트)
 * 6. UI 업데이트 (UI Updates: 보드 그리기, 팝업 등)
 * 7. 유틸리티 (Utilities: 보드 생성, 알고리즘)
 */

// ==========================================
// 1. DOM 요소 & 설정 (Configuration)
// ==========================================
let DOM = {}; // 초기화는 initDOM()에서 수행

const CONFIG = {
    4: { rows: 4, cols: 4, blockW: 2, blockH: 2, remove: { easy: 6, hard: 10 } },
    6: { rows: 6, cols: 6, blockW: 3, blockH: 2, remove: { easy: 15, hard: 24 } },
    9: { rows: 9, cols: 9, blockW: 3, blockH: 3, remove: { easy: 30, hard: 50 } }
};

// ==========================================
// 2. 상태 관리 (State Management)
// ==========================================
const gameState = {
    solutionBoard: [],
    gameBoard: [],
    initialBoard: [],
    notesBoard: [],
    currentSize: 9,
    currentDifficulty: 'easy',
    selectedCell: null,
    isMemoMode: false,
    isHintMode: false
};

// ==========================================
// 3. 사운드 매니저 (Sound Manager)
// ==========================================
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.isMuted = false;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.isMuted;
    }

    playTone(freq, type, duration, volume = 0.1) {
        if (this.isMuted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playPop() {
        this.playTone(600, 'sine', 0.1, 0.1);
    }

    playErase() {
        this.playTone(200, 'triangle', 0.15, 0.1);
    }

    playError() {
        this.playTone(150, 'sawtooth', 0.2, 0.1);
    }

    playWin() {
        if (this.isMuted) return;
        // Victory Arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51, 1567.98];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.1, 0.05), i * 80);
        });
    }
}

const sounds = new SoundManager();

// ==========================================
// 4. 초기화 및 이벤트 리스너 (Initialization)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    setupEventListeners(); // Listeners first
    initGame(); // Then trigger click
});

function initDOM() {
    DOM = {
        board: document.getElementById('board'),
        printArea: document.getElementById('print-area'),
        numpad: document.getElementById('numpad'),
        inputControls: document.querySelector('.input-controls'),

        // Buttons
        btnMemo: document.getElementById('btn-memo'),
        btnHintToggle: document.getElementById('btn-hint-toggle'),
        btnErase: document.getElementById('btn-erase'),
        btnClosePad: document.getElementById('btn-close-pad'),
        btnSoundToggle: document.getElementById('btn-sound-toggle'),
        btnEasy: document.getElementById('btn-easy'),
        btnHard: document.getElementById('btn-hard'),
        btnRestartMain: document.getElementById('btn-main-restart'),
        btnPrint: document.getElementById('btn-print'),
        btnSizeControls: document.querySelectorAll('.btn-size'),

        // Modal
        gameModal: document.getElementById('game-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalMessage: document.getElementById('modal-message'),
        modalConfetti: document.getElementById('modal-confetti'),
        btnCloseModal: document.getElementById('btn-close-modal'),
        btnRestartModal: document.getElementById('btn-restart')
    };
}

function initGame() {
    // 기본 선택: 9x9
    const defaultBtn = document.querySelector(`.btn-size[data-size="${gameState.currentSize}"]`);
    if (defaultBtn) defaultBtn.click();
}

function setupEventListeners() {
    // (1) 소리 토글
    if (DOM.btnSoundToggle) {
        DOM.btnSoundToggle.addEventListener('click', () => {
            const isMuted = sounds.toggleMute();
            DOM.btnSoundToggle.textContent = isMuted ? '🔇' : '🔊';
            DOM.btnSoundToggle.classList.toggle('muted', isMuted);
        });
    }

    // (2) 크기 선택
    DOM.btnSizeControls.forEach(btn => {
        btn.addEventListener('click', (e) => {
            sounds.playPop();
            DOM.btnSizeControls.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            gameState.currentSize = parseInt(e.target.dataset.size);
            startNewGame(gameState.currentDifficulty);
        });
    });

    // (3) 난이도 및 메인 컨트롤
    if (DOM.btnEasy) DOM.btnEasy.addEventListener('click', () => { sounds.playPop(); startNewGame('easy'); });
    if (DOM.btnHard) DOM.btnHard.addEventListener('click', () => { sounds.playPop(); startNewGame('hard'); });
    if (DOM.btnRestartMain) DOM.btnRestartMain.addEventListener('click', () => { sounds.playPop(); startNewGame(gameState.currentDifficulty); });
    if (DOM.btnPrint) DOM.btnPrint.addEventListener('click', () => { sounds.playPop(); printFourPuzzles(); });

    // (4) 도구 버튼
    if (DOM.btnMemo) DOM.btnMemo.addEventListener('click', () => { sounds.playPop(); toggleMemoMode(); });
    if (DOM.btnHintToggle) {
        DOM.btnHintToggle.addEventListener('click', () => {
            sounds.playPop();
            toggleHintMode();
        });
    }
    if (DOM.btnErase) DOM.btnErase.addEventListener('click', () => { sounds.playErase(); handleInput(0); });
    if (DOM.btnClosePad) DOM.btnClosePad.addEventListener('click', closeInputPad);

    // (5) 모달 관련
    if (DOM.btnCloseModal) DOM.btnCloseModal.addEventListener('click', hideModal);
    if (DOM.btnRestartModal) DOM.btnRestartModal.addEventListener('click', () => { sounds.playPop(); startNewGame(gameState.currentDifficulty); });

    // (6) 키보드 입력
    document.addEventListener('keydown', handleKeyboardInput);

    // (7) 외부 클릭 시 팝업 닫기
    document.addEventListener('click', handleOutsideClick);
}

// ==========================================
// 5. 게임 로직 (Game Logic)
// ==========================================
function startNewGame(difficulty) {
    gameState.currentDifficulty = difficulty;
    gameState.selectedCell = null;
    gameState.isMemoMode = false;
    if (DOM.btnMemo) DOM.btnMemo.classList.remove('active');

    // 힌트 모드 초기화
    gameState.isHintMode = false;
    if (DOM.btnHintToggle) DOM.btnHintToggle.classList.remove('active');

    closeInputPad();
    hideModal();

    const result = generateSudoku(gameState.currentSize, difficulty);
    gameState.initialBoard = JSON.parse(JSON.stringify(result.game));
    gameState.gameBoard = JSON.parse(JSON.stringify(result.game));
    gameState.solutionBoard = result.solved;

    // 메모 보드 초기화
    gameState.notesBoard = Array.from({ length: gameState.currentSize }, () =>
        Array.from({ length: gameState.currentSize }, () => new Set())
    );

    drawNumpad();
    drawBoard();
}

function handleInput(num) {
    if (!gameState.selectedCell) return;
    const { row, col } = gameState.selectedCell;

    // 고정된 숫자는 수정 불가
    if (gameState.initialBoard[row][col] !== 0) return;

    if (num === 0) {
        // 지우기
        gameState.gameBoard[row][col] = 0;
        gameState.notesBoard[row][col].clear();
    } else if (gameState.isMemoMode) {
        // 메모 모드
        if (gameState.notesBoard[row][col].has(num)) {
            gameState.notesBoard[row][col].delete(num);
        } else {
            gameState.notesBoard[row][col].add(num);
        }
        sounds.playPop();
    } else {
        // 숫자 입력
        gameState.gameBoard[row][col] = num;
        gameState.notesBoard[row][col].clear();
        sounds.playPop();
    }

    drawBoard(); // 보드 갱신
    restoreSelection(); // 선택 상태 복구 (팝업 위치 유지)
    checkGameStatus(); // 승리 여부 확인
}

function checkGameStatus() {
    let isFull = true;
    let isCorrect = true;

    for (let r = 0; r < gameState.currentSize; r++) {
        for (let c = 0; c < gameState.currentSize; c++) {
            if (gameState.gameBoard[r][c] === 0) {
                isFull = false;
                break;
            }
            if (gameState.gameBoard[r][c] !== gameState.solutionBoard[r][c]) {
                isCorrect = false;
            }
        }
    }

    if (isFull) {
        if (isCorrect) {
            sounds.playWin();
            showModal(true);
        } else {
            sounds.playError();
            showModal(false);
        }
    }
}

function toggleMemoMode() {
    gameState.isMemoMode = !gameState.isMemoMode;
    if (DOM.btnMemo) DOM.btnMemo.classList.toggle('active', gameState.isMemoMode);
}

function toggleHintMode() {
    gameState.isHintMode = !gameState.isHintMode;
    if (DOM.btnHintToggle) DOM.btnHintToggle.classList.toggle('active', gameState.isHintMode);
    drawBoard();
}

function handleKeyboardInput(e) {
    if (!gameState.selectedCell) return;
    if (e.key >= '1' && e.key <= '9') {
        const num = parseInt(e.key);
        if (num <= gameState.currentSize) handleInput(num);
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
        sounds.playErase();
        handleInput(0);
    }
    if (e.key === 'Escape') {
        closeInputPad();
    }
}

function handleOutsideClick(e) {
    if (!DOM.inputControls || !DOM.inputControls.classList.contains('visible')) return;
    if (!DOM.board.contains(e.target) &&
        !DOM.inputControls.contains(e.target) &&
        !e.target.classList.contains('cell')) {
        closeInputPad();
    }
}

// ==========================================
// 6. UI 업데이트 (UI Updates)
// ==========================================
function drawBoard() {
    if (!DOM.board) return;
    DOM.board.innerHTML = '';
    DOM.board.style.gridTemplateColumns = `repeat(${gameState.currentSize}, 1fr)`;

    const { blockW, blockH } = CONFIG[gameState.currentSize];
    const totalCells = gameState.currentSize * gameState.currentSize;

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');

        const row = Math.floor(i / gameState.currentSize);
        const col = i % gameState.currentSize;
        const value = gameState.gameBoard[row][col];

        cell.dataset.row = row;
        cell.dataset.col = col;

        // 굵은 테두리 (블록 구분)
        if ((col + 1) % blockW === 0 && col < gameState.currentSize - 1) cell.classList.add('border-right-bold');
        if ((row + 1) % blockH === 0 && row < gameState.currentSize - 1) cell.classList.add('border-bottom-bold');

        // 체스판 색상
        if ((row + col) % 2 === 0) cell.classList.add('color-1');
        else cell.classList.add('color-2');

        // 내용 표시
        if (value !== 0) {
            cell.textContent = value;
            if (gameState.initialBoard[row][col] !== 0) {
                cell.classList.add('fixed'); // 초기 고정 숫자
            } else if (gameState.isHintMode) {
                // 힌트 모드: 정답 여부 표시
                if (value === gameState.solutionBoard[row][col]) {
                    cell.classList.add('success');
                } else {
                    cell.classList.add('error');
                }
            }
        } else {
            // 메모 표시
            if (gameState.notesBoard[row][col] && gameState.notesBoard[row][col].size > 0) {
                const noteGrid = document.createElement('div');
                noteGrid.classList.add('note-grid');
                for (let n = 1; n <= gameState.currentSize; n++) {
                    const noteNum = document.createElement('span');
                    noteNum.classList.add('note-num');
                    if (gameState.notesBoard[row][col].has(n)) {
                        noteNum.textContent = n;
                    }
                    noteGrid.appendChild(noteNum);
                }
                cell.appendChild(noteGrid);
            }
        }

        // 클릭 이벤트
        cell.addEventListener('click', (e) => {
            highlightCell(cell, row, col);
            if (gameState.initialBoard[row][col] !== 0) closeInputPad(); // 고정된 숫자는 패드 안 띄움 (선택만)
            e.stopPropagation();
        });

        DOM.board.appendChild(cell);
    }
}

function drawNumpad() {
    if (!DOM.numpad) return;
    DOM.numpad.innerHTML = '';
    for (let i = 1; i <= gameState.currentSize; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.classList.add('btn-num');
        btn.addEventListener('click', () => handleInput(i));
        DOM.numpad.appendChild(btn);
    }
}

function highlightCell(cell, row, col) {
    document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
    gameState.selectedCell = { row, col };
    cell.classList.add('selected');

    // 팝업 키패드 위치 계산 및 표시
    if (DOM.inputControls) {
        DOM.inputControls.classList.add('visible');

        const rect = cell.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const padWidth = 280;

        let top = rect.bottom + scrollY + 10;
        let left = rect.left + scrollX + (rect.width / 2) - (padWidth / 2);

        if (left < 10) left = 10;
        if (left + padWidth > window.innerWidth - 10) left = window.innerWidth - padWidth - 10;

        DOM.inputControls.style.top = `${top}px`;
        DOM.inputControls.style.left = `${left}px`;
    }
}

function closeInputPad() {
    if (DOM.inputControls) DOM.inputControls.classList.remove('visible');
    gameState.selectedCell = null;
    document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
}

function restoreSelection() {
    if (gameState.selectedCell) {
        const { row, col } = gameState.selectedCell;
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) highlightCell(cell, row, col);
    } else {
        closeInputPad();
    }
}

function showModal(isSuccess) {
    if (!DOM.gameModal) return;
    DOM.gameModal.classList.remove('hidden');

    if (isSuccess) {
        DOM.modalTitle.textContent = "🎉 축하합니다! 🎉";
        DOM.modalTitle.style.color = "#FFD700";
        DOM.modalMessage.textContent = "퍼즐을 모두 완성했어요!";
        if (DOM.modalConfetti) DOM.modalConfetti.style.display = "block";
    } else {
        DOM.modalTitle.textContent = "😅 아쉬워요!";
        DOM.modalTitle.style.color = "#FF6347";
        DOM.modalMessage.textContent = "틀린 숫자가 있어요. 다시 확인해보세요!";
        if (DOM.modalConfetti) DOM.modalConfetti.style.display = "none";
    }
}

function hideModal() {
    if (DOM.gameModal) DOM.gameModal.classList.add('hidden');
    sounds.playPop();
}

// ==========================================
// 7. 유틸리티 (Utilities)
// ==========================================
function printFourPuzzles() {
    if (!DOM.printArea) return;
    DOM.printArea.innerHTML = '';
    let puzzleCount = 6;
    if (gameState.currentSize === 4) puzzleCount = 12;
    if (gameState.currentSize === 6) puzzleCount = 12; // 6x6은 12개 출력

    DOM.printArea.className = 'print-hidden';
    DOM.printArea.classList.add(`count-${puzzleCount}`);
    DOM.printArea.classList.add(`p-size-${gameState.currentSize}`);

    for (let i = 0; i < puzzleCount; i++) {
        const { game } = generateSudoku(gameState.currentSize, gameState.currentDifficulty);
        const printContainer = document.createElement('div');
        printContainer.classList.add('print-board-container');

        const title = document.createElement('h3');
        const difficultyLabel = gameState.currentDifficulty === 'easy' ? 'Easy' : 'Hard';
        title.textContent = `${gameState.currentSize}x${gameState.currentSize} Sudoku (${difficultyLabel}) - ${i + 1}`;
        printContainer.appendChild(title);

        const boardDiv = document.createElement('div');
        boardDiv.classList.add('sudoku-board');
        boardDiv.classList.add(`size-${gameState.currentSize}`);
        printContainer.appendChild(boardDiv); // Container에 보드 추가

        drawStaticBoard(game, boardDiv, gameState.currentSize);
        DOM.printArea.appendChild(printContainer); // 전체 영역에 컨테이너 추가
    }
    window.print();
}

function drawStaticBoard(boardData, targetElement, size) {
    targetElement.innerHTML = '';
    targetElement.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    const { blockW, blockH } = CONFIG[size];
    const totalCells = size * size;

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        const row = Math.floor(i / size);
        const col = i % size;
        const value = boardData[row][col];
        if ((col + 1) % blockW === 0 && col < size - 1) cell.classList.add('border-right-bold');
        if ((row + 1) % blockH === 0 && row < size - 1) cell.classList.add('border-bottom-bold');
        if (value !== 0) {
            cell.textContent = value;
            cell.classList.add('fixed');
        }
        targetElement.appendChild(cell);
    }
}

// --- Sudoku Generation Algorithm ---
function generateSudoku(size, difficulty) {
    const { rows, cols, remove } = CONFIG[size];
    const solved = Array.from({ length: rows }, () => Array(cols).fill(0));
    fillBoard(solved, size);

    // Deep Copy
    const game = JSON.parse(JSON.stringify(solved));
    const holes = remove[difficulty];
    removeNumbers(game, holes, size);
    return { solved, game };
}

function fillBoard(board, size) {
    const emptyCell = findEmpty(board, size);
    if (!emptyCell) return true;
    const [row, col] = emptyCell;

    // 1부터 size까지 숫자 섞어서 시도
    const nums = Array.from({ length: size }, (_, i) => i + 1);
    const numbers = shuffle(nums);

    for (let num of numbers) {
        if (isValid(board, row, col, num, size)) {
            board[row][col] = num;
            if (fillBoard(board, size)) return true;
            board[row][col] = 0;
        }
    }
    return false;
}

function isValid(board, row, col, num, size) {
    // Check Row & Col
    for (let x = 0; x < size; x++) {
        if (board[row][x] === num) return false;
        if (board[x][col] === num) return false;
    }
    // Check Block
    const { blockW, blockH } = CONFIG[size];
    const startRow = Math.floor(row / blockH) * blockH;
    const startCol = Math.floor(col / blockW) * blockW;
    for (let i = 0; i < blockH; i++) {
        for (let j = 0; j < blockW; j++) {
            if (board[startRow + i][startCol + j] === num) return false;
        }
    }
    return true;
}

function findEmpty(board, size) {
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (board[i][j] === 0) return [i, j];
        }
    }
    return null;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function removeNumbers(board, count, size) {
    let attempts = count;
    let safety = 1000;
    while (attempts > 0 && safety > 0) {
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        if (board[row][col] !== 0) {
            board[row][col] = 0;
            attempts--;
        }
        safety--;
    }
}
