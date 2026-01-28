// ── Emoji pool ──────────────────────────────────────────────────────
const EMOJIS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅',
  '🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌',
  '🐞','🐜','🪲','🐢','🐍','🦎','🦂','🐙','🦑','🦐',
  '🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅',
  '🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒',
  '🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙',
  '🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦤','🕊️',
  '🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🦔',
  '🌸','🌺','🌻','🌼','🌷','🍄','🌵','🎄','🌲','🌳',
];

// ── Difficulty config ───────────────────────────────────────────────
// Copies = how many of each emoji appear on the board.
// More copies → fewer unique emojis → easier to find matches.
// decoyRatio = fraction of cards that are unique (no match possible).
const DIFFICULTY = {
  easy:   { copies: 4, decoyRatio: 0 },
  medium: { copies: 2, decoyRatio: 0 },
  hard:   { copies: 2, decoyRatio: 0.25 },
};

// ── DOM references ──────────────────────────────────────────────────
const gridEl        = document.getElementById('grid');
const scoreEl       = document.getElementById('score');
const flipsEl       = document.getElementById('flips');
const timerEl       = document.getElementById('timer');
const gridSizeSel   = document.getElementById('grid-size');
const difficultySel = document.getElementById('difficulty');
const resetBtn      = document.getElementById('reset-btn');
const gameOverEl    = document.getElementById('game-over');
const finalScoreEl  = document.getElementById('final-score');
const finalTimeEl   = document.getElementById('final-time');
const finalFlipsEl  = document.getElementById('final-flips');
const playAgainBtn  = document.getElementById('play-again-btn');

// ── Audio helpers ───────────────────────────────────────────────────
const playSound = (name) => {
  const audio = new Audio(`assets/sounds/${name}`);
  audio.play().catch(() => {});
};

// ── Game state ──────────────────────────────────────────────────────
let cards       = [];
let firstCard   = null;
let secondCard  = null;
let lockBoard   = false;
let score       = 0;
let flipCount   = 0;
let matchedCount = 0;
let totalPairs  = 0;
let timerInterval = null;
let seconds     = 0;
let gameStarted = false;

// ── Utility functions ───────────────────────────────────────────────
const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const formatTime = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ── Timer ───────────────────────────────────────────────────────────
const startTimer = () => {
  if (gameStarted) return;
  gameStarted = true;
  timerInterval = setInterval(() => {
    seconds++;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
};

const stopTimer = () => {
  clearInterval(timerInterval);
  timerInterval = null;
};

// ── Build card data ─────────────────────────────────────────────────
const buildCardData = (gridSize, difficulty) => {
  const totalCards = gridSize * gridSize;
  const { copies, decoyRatio } = DIFFICULTY[difficulty];

  // Calculate decoy count (round down to nearest even for clean grid)
  let decoyCount = Math.floor(totalCards * decoyRatio);
  let pairedCount = totalCards - decoyCount;
  // Ensure paired portion is divisible by copies
  pairedCount = pairedCount - (pairedCount % copies);
  decoyCount = totalCards - pairedCount;

  const shuffledEmojis = shuffle(EMOJIS);
  const uniquePaired = pairedCount / copies;
  const pairedEmojis = shuffledEmojis.slice(0, uniquePaired);
  const decoyEmojis = shuffledEmojis.slice(uniquePaired, uniquePaired + decoyCount);

  const pool = [
    ...pairedEmojis.flatMap((emoji) => Array(copies).fill(emoji)),
    ...decoyEmojis,
  ];

  return { cards: shuffle(pool), pairedCount };
};

// ── Compute card size based on grid ─────────────────────────────────
const getCardSize = (gridSize) => {
  if (gridSize <= 4)  return 80;
  if (gridSize <= 8)  return 60;
  return 44;
};

// ── Create a card element ───────────────────────────────────────────
const createCardElement = (emoji, index) => {
  const card = document.createElement('div');
  card.classList.add('card');
  card.dataset.index = index;
  card.dataset.emoji = emoji;

  card.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-front"></div>
      <div class="card-face card-back">${emoji}</div>
    </div>`;

  card.addEventListener('click', () => handleCardClick(card));
  return card;
};

// ── Card click handler ──────────────────────────────────────────────
const handleCardClick = (card) => {
  if (lockBoard) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;

  startTimer();

  card.classList.add('flipped');
  playSound('flip-card.mp3');
  flipCount++;
  flipsEl.textContent = flipCount;

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  lockBoard = true;

  // Wait for the flip animation (0.4s) to finish before checking
  setTimeout(checkForMatch, 400);
};

// ── Match checking ──────────────────────────────────────────────────
const checkForMatch = () => {
  const isMatch = firstCard.dataset.emoji === secondCard.dataset.emoji;

  if (isMatch) {
    handleMatch();
  } else {
    handleMismatch();
  }
};

const handleMatch = () => {
  firstCard.classList.add('matched');
  secondCard.classList.add('matched');
  playSound('matched.mp3');

  score++;
  matchedCount++;
  scoreEl.textContent = score;

  resetTurn();

  if (matchedCount === totalPairs) {
    endGame();
  }
};

const handleMismatch = () => {
  playSound('not-matched.mp3');

  setTimeout(() => {
    firstCard.classList.remove('flipped');
    secondCard.classList.remove('flipped');
    playSound('flip-card-back.mp3');
    resetTurn();
  }, 500);
};

const resetTurn = () => {
  firstCard = null;
  secondCard = null;
  lockBoard = false;
};

// ── End game ────────────────────────────────────────────────────────
const endGame = () => {
  stopTimer();
  finalScoreEl.textContent = score;
  finalTimeEl.textContent = formatTime(seconds);
  finalFlipsEl.textContent = flipCount;
  gameOverEl.classList.remove('hidden');
};

// ── Initialize / Reset game ─────────────────────────────────────────
const initGame = () => {
  // Stop any running timer
  stopTimer();
  gameStarted = false;

  // Hide game-over overlay
  gameOverEl.classList.add('hidden');

  // Reset state
  score = 0;
  flipCount = 0;
  matchedCount = 0;
  seconds = 0;
  firstCard = null;
  secondCard = null;
  lockBoard = false;

  // Update UI counters
  scoreEl.textContent = '0';
  flipsEl.textContent = '0';
  timerEl.textContent = '0:00';

  // Read settings
  const gridSize = parseInt(gridSizeSel.value, 10);
  const difficulty = difficultySel.value;
  const cardSize = getCardSize(gridSize);

  // Build cards
  const { cards: cardData, pairedCount } = buildCardData(gridSize, difficulty);
  cards = cardData;
  totalPairs = pairedCount / 2;

  // Configure grid CSS
  gridEl.style.gridTemplateColumns = `repeat(${gridSize}, ${cardSize}px)`;
  gridEl.style.gridTemplateRows    = `repeat(${gridSize}, ${cardSize}px)`;

  // Render cards
  gridEl.innerHTML = '';
  cardData.forEach((emoji, i) => {
    gridEl.appendChild(createCardElement(emoji, i));
  });
};

// ── Event listeners ─────────────────────────────────────────────────
resetBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', initGame);
gridSizeSel.addEventListener('change', initGame);
difficultySel.addEventListener('change', initGame);

// ── Start on load ───────────────────────────────────────────────────
initGame();
