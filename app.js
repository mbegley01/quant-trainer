const OPS = ['+', '-', '×', '÷'];
const FRAC_DENOMS = [2, 3, 4, 5, 6, 8, 10, 12];
const WILDCARD_WEIGHTS = [
  { kind: 'frac', weight: 2 },
  { kind: 'pow', weight: 2 },
  { kind: 'arith', weight: 1 },
];
const STORAGE_PREFIX = 'quant-trainer-highscore';

const $ = (id) => document.getElementById(id);

const screens = {
  setup: $('screen-setup'),
  play: $('screen-play'),
  results: $('screen-results'),
};

const els = {
  timeSlider: $('time-slider'),
  timeLabel: $('time-label'),
  highScoreDisplay: $('high-score-display'),
  startBtn: $('start-btn'),
  timer: $('timer'),
  score: $('score'),
  problem: $('problem'),
  answerForm: $('answer-form'),
  answerInput: $('answer-input'),
  feedback: $('feedback'),
  finalScore: $('final-score'),
  newRecord: $('new-record'),
  resultsHighScore: $('results-high-score'),
  againBtn: $('again-btn'),
  quitBtn: $('quit-btn'),
  themeToggle: $('theme-toggle'),
};

let state = {
  difficulty: 'easy',
  minutes: 2,
  score: 0,
  endsAt: 0,
  current: null,
  timerId: null,
  wrongTimeoutId: null,
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** @type {Record<string, { add: [number, number]; mult: [number, number]; div: [number, number]; quotient: [number, number]; maxProduct: number; maxDividend: number }>} */
const LIMITS = {
  easy: {
    add: [1, 99],
    mult: [2, 12],
    div: [2, 12],
    quotient: [2, 12],
    maxProduct: 144,
    maxDividend: 144,
  },
  medium: {
    add: [10, 99],
    mult: [10, 25],
    div: [11, 50],
    quotient: [2, 15],
    maxProduct: 999,
    maxDividend: 999,
  },
  hard: {
    add: [10, 999],
    mult: [10, 99],
    div: [11, 99],
    quotient: [10, 99],
    maxProduct: 50_000,
    maxDividend: 10_000,
  },
  wildcard: {
    add: [10, 99],
    mult: [10, 99],
    div: [11, 99],
    quotient: [10, 99],
    maxProduct: 50_000,
    maxDividend: 10_000,
  },
};

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function simplifyFrac(n, d) {
  if (d === 0) return [n, 1];
  const g = gcd(n, d);
  let sn = n / g;
  let sd = d / g;
  if (sd < 0) {
    sn = -sn;
    sd = -sd;
  }
  return [sn, sd];
}

function formatFrac(n, d) {
  const [sn, sd] = simplifyFrac(n, d);
  if (sd === 1) return String(sn);
  return `${sn}/${sd}`;
}

function isIntegerValue(x) {
  return Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9;
}

function formatAnswer(x) {
  if (!Number.isFinite(x)) return String(x);
  if (isIntegerValue(x)) return String(Math.round(x));
  const rounded = Math.round(x * 100) / 100;
  return String(rounded);
}

function answersMatch(given, expected) {
  if (!Number.isFinite(given) || !Number.isFinite(expected)) return false;
  if (isIntegerValue(expected)) return given === Math.round(expected);
  return Math.abs(given - expected) < 0.01;
}

function randomFraction() {
  const d = pick(FRAC_DENOMS);
  const n = randInt(1, d * 2);
  return simplifyFrac(n, d);
}

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.kind;
  }
  return items[items.length - 1].kind;
}

/** Build fractions with a guaranteed whole-number answer (no random rejection). */
function buildFractionProblem() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const style = pick(['same-denom', 'mul-int', 'div-frac', 'sub-same']);

    if (style === 'same-denom') {
      const d = pick(FRAC_DENOMS);
      const answer = randInt(2, 20);
      const maxN1 = answer * d - 1;
      if (maxN1 < 1) continue;
      const n1 = randInt(1, Math.min(d * 2, maxN1));
      const n2 = answer * d - n1;
      if (n2 < 1) continue;
      const text = `${formatFrac(n1, d)} + ${formatFrac(n2, d)} = ?`;
      return { text, answer, op: 'frac' };
    }

    if (style === 'sub-same') {
      const d = pick(FRAC_DENOMS);
      const n1 = randInt(2, d * 2);
      if (n1 < 2) continue;
      const n2 = randInt(1, n1 - 1);
      const answer = (n1 - n2) / d;
      if (!isIntegerValue(answer) || answer < 1) continue;
      const text = `${formatFrac(n1, d)} - ${formatFrac(n2, d)} = ?`;
      return { text, answer: Math.round(answer), op: 'frac' };
    }

    if (style === 'mul-int') {
      const d = pick(FRAC_DENOMS);
      const n = randInt(1, d * 2);
      const [sn, sd] = simplifyFrac(n, d);
      const answer = randInt(2, 40);
      if ((answer * sd) % sn !== 0) continue;
      const mult = (answer * sd) / sn;
      if (mult < 2 || mult > 24) continue;
      const text = `${formatFrac(sn, sd)} × ${mult} = ?`;
      return { text, answer, op: 'frac' };
    }

    const answer = randInt(2, 24);
    const [n2, d2] = randomFraction();
    const [sn2, sd2] = simplifyFrac(n2, d2);
    const [n1, d1] = simplifyFrac(answer * sn2, sd2);
    if (d1 > 99 || n1 > 99) continue;
    const text = `${formatFrac(n1, d1)} ÷ ${formatFrac(sn2, sd2)} = ?`;
    return { text, answer, op: 'frac' };
  }

  const d = 4;
  return { text: `1/2 + 1/2 = ?`, answer: 1, op: 'frac' };
}

function buildExponentProblem() {
  const base = randInt(2, 12);
  const exp = randInt(2, 4);
  const answer = base ** exp;
  return { text: `${base}^${exp} = ?`, answer, op: 'pow' };
}

function buildWildcardProblem() {
  const limits = LIMITS.wildcard;
  const kind = pickWeighted(WILDCARD_WEIGHTS);

  if (kind === 'frac') {
    const problem = buildFractionProblem();
    return { text: problem.text, answer: problem.answer };
  }

  if (kind === 'pow') {
    const problem = buildExponentProblem();
    return { text: problem.text, answer: problem.answer };
  }

  for (let i = 0; i < 20; i++) {
    const problem = buildProblem('wildcard', pick(OPS));
    if (withinLimits(problem, limits)) {
      return { text: problem.text, answer: problem.answer };
    }
  }

  const problem = buildFractionProblem();
  return { text: problem.text, answer: problem.answer };
}

function easyAddSubOperand() {
  return Math.random() < 0.5 ? randInt(1, 9) : randInt(10, 99);
}

function operandInRange([min, max], difficulty) {
  if (difficulty === 'hard' && Math.random() < 0.35) {
    return randInt(10, 99);
  }
  return randInt(min, max);
}

function buildProblem(difficulty, op) {
  const limits = LIMITS[difficulty] ?? LIMITS.easy;
  let a;
  let b;
  let answer;

  switch (op) {
    case '+':
      if (difficulty === 'easy') {
        a = easyAddSubOperand();
        b = easyAddSubOperand();
      } else {
        a = operandInRange(limits.add, difficulty);
        b = operandInRange(limits.add, difficulty);
      }
      answer = a + b;
      break;
    case '-':
      if (difficulty === 'easy') {
        a = easyAddSubOperand();
        b = easyAddSubOperand();
      } else {
        a = operandInRange(limits.add, difficulty);
        b = operandInRange(limits.add, difficulty);
      }
      if (b > a) [a, b] = [b, a];
      answer = a - b;
      break;
    case '×': {
      const [min, max] = limits.mult;
      a = randInt(min, max);
      b = randInt(min, max);
      answer = a * b;
      break;
    }
    case '÷': {
      const [divMin, divMax] = limits.div;
      const [quotMin, quotMax] = limits.quotient;
      b = randInt(divMin, divMax);
      answer = randInt(quotMin, quotMax);
      a = b * answer;
      break;
    }
    default:
      a = 1;
      b = 1;
      answer = 2;
  }

  return { text: `${a} ${op} ${b} = ?`, answer, a, b, op };
}

function withinLimits({ a, b, op, answer }, limits) {
  if (op === '×') return answer <= limits.maxProduct;
  if (op === '÷') return a <= limits.maxDividend;
  return true;
}

function normalizeProblem(problem) {
  const answer = Number(problem?.answer);
  const text = typeof problem?.text === 'string' ? problem.text : '2 + 2 = ?';
  if (!Number.isFinite(answer)) {
    return { text: '2 + 2 = ?', answer: 4 };
  }
  return { text, answer };
}

function generateProblem(difficulty) {
  try {
    if (difficulty === 'wildcard') {
      return normalizeProblem(generateWildcardProblem());
    }

    const limits = LIMITS[difficulty] ?? LIMITS.easy;

    for (let i = 0; i < 40; i++) {
      const problem = buildProblem(difficulty, pick(OPS));
      if (withinLimits(problem, limits)) {
        return normalizeProblem(problem);
      }
    }

    return normalizeProblem(buildProblem(difficulty, '+'));
  } catch {
    return { text: '2 + 2 = ?', answer: 4 };
  }
}

function scoreKey(difficulty, minutes) {
  return `${STORAGE_PREFIX}:${difficulty}:${minutes}`;
}

function getHighScore(difficulty, minutes) {
  const raw = localStorage.getItem(scoreKey(difficulty, minutes));
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function setHighScore(difficulty, minutes, score) {
  localStorage.setItem(scoreKey(difficulty, minutes), String(score));
}

function selectedDifficulty() {
  const checked = document.querySelector('input[name="difficulty"]:checked');
  return checked ? checked.value : 'easy';
}

function updateHighScoreDisplay() {
  const difficulty = selectedDifficulty();
  const minutes = Number(els.timeSlider.value);
  els.highScoreDisplay.textContent = String(getHighScore(difficulty, minutes));
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
}

function clearFeedback() {
  els.feedback.textContent = '';
  els.feedback.className = 'feedback';
}

function enableAnswerInput() {
  els.answerInput.disabled = false;
  els.answerInput.readOnly = false;
}

function stopTimers() {
  cancelAnimationFrame(state.timerId);
  state.timerId = null;
  if (state.wrongTimeoutId !== null) {
    clearTimeout(state.wrongTimeoutId);
    state.wrongTimeoutId = null;
  }
  enableAnswerInput();
}

function nextProblem() {
  state.current = generateProblem(state.difficulty);
  els.problem.textContent = state.current.text;
  els.answerInput.value = '';
  enableAnswerInput();
  clearFeedback();
}

function tickTimer() {
  const left = state.endsAt - Date.now();
  els.timer.textContent = formatTime(left);

  if (left <= 0) {
    endGame();
    return;
  }
  state.timerId = requestAnimationFrame(tickTimer);
}

function startGame() {
  stopTimers();
  state.difficulty = selectedDifficulty();
  state.minutes = Number(els.timeSlider.value);
  state.score = 0;
  state.endsAt = Date.now() + state.minutes * 60 * 1000;

  els.score.textContent = '0';
  els.timer.textContent = formatTime(state.minutes * 60 * 1000);
  clearFeedback();
  enableAnswerInput();

  showScreen('play');
  nextProblem();
  els.answerInput.focus({ preventScroll: true });

  state.timerId = requestAnimationFrame(tickTimer);
}

function quitGame() {
  if (!confirm('Quit this round? Your score will not be saved.')) return;
  stopTimers();
  state.current = null;
  state.endsAt = 0;
  updateHighScoreDisplay();
  showScreen('setup');
}

function endGame() {
  stopTimers();

  const prevHigh = getHighScore(state.difficulty, state.minutes);
  const isRecord = state.score > prevHigh;

  if (isRecord) {
    setHighScore(state.difficulty, state.minutes, state.score);
  }

  els.finalScore.textContent = String(state.score);
  els.resultsHighScore.textContent = String(
    isRecord ? state.score : prevHigh,
  );
  els.newRecord.classList.toggle('hidden', !isRecord);

  showScreen('results');
}

function checkAnswer(raw) {
  if (!state.current || Date.now() >= state.endsAt) return;

  const trimmed = String(raw).trim();
  if (trimmed === '') return;

  const given = Number(trimmed);
  if (!Number.isFinite(given)) {
    els.feedback.textContent = 'Enter a number';
    els.feedback.className = 'feedback bad';
    return;
  }

  if (answersMatch(given, state.current.answer)) {
    state.score += 1;
    els.score.textContent = String(state.score);
    nextProblem();
    els.answerInput.focus();
  } else {
    const correct = state.current.answer;
    els.feedback.textContent = `Wrong — answer was ${formatAnswer(correct)}`;
    els.feedback.className = 'feedback bad';
    enableAnswerInput();
    if (state.wrongTimeoutId !== null) clearTimeout(state.wrongTimeoutId);
    state.wrongTimeoutId = setTimeout(() => {
      state.wrongTimeoutId = null;
      if (Date.now() < state.endsAt) {
        nextProblem();
        els.answerInput.focus({ preventScroll: true });
      }
    }, 800);
  }
}

function initTheme() {
  const stored = localStorage.getItem('quant-trainer-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = stored === 'dark' || (!stored && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

function toggleTheme() {
  const dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('quant-trainer-theme', dark ? 'dark' : 'light');
}

els.timeSlider.addEventListener('input', () => {
  els.timeLabel.textContent = els.timeSlider.value;
  updateHighScoreDisplay();
});

document.querySelectorAll('input[name="difficulty"]').forEach((input) => {
  input.addEventListener('change', updateHighScoreDisplay);
});

els.startBtn.addEventListener('click', startGame);

els.answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  checkAnswer(els.answerInput.value);
});

els.againBtn.addEventListener('click', () => {
  updateHighScoreDisplay();
  showScreen('setup');
});

els.quitBtn.addEventListener('click', quitGame);

els.themeToggle.addEventListener('click', toggleTheme);

initTheme();
updateHighScoreDisplay();
