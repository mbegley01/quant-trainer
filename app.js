const OPS = ['+', '-', '×', '÷'];
const FRAC_DENOMS = [2, 3, 4, 5, 6, 8, 10, 12];
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
    maxProduct: 50000,
    maxDividend: 10000,
  },
  wildcard: {
    add: [10, 99],
    mult: [10, 99],
    div: [11, 99],
    quotient: [10, 99],
    maxProduct: 50000,
    maxDividend: 10000,
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

function focusAnswerInput() {
  if (!els.answerInput) return;
  try {
    els.answerInput.focus({ preventScroll: true });
  } catch {
    els.answerInput.focus();
  }
}

function pickWeightedBuilder(builders) {
  const total = builders.reduce((sum, b) => sum + b.weight, 0);
  let roll = Math.random() * total;
  for (const entry of builders) {
    roll -= entry.weight;
    if (roll <= 0) return entry.fn;
  }
  return builders[builders.length - 1].fn;
}

function buildFracSameDenomAdd() {
  const d = pick(FRAC_DENOMS);
  const answer = randInt(1, 15);
  const n1 = randInt(1, answer * d - 1);
  const n2 = answer * d - n1;
  return {
    text: `${formatFrac(n1, d)} + ${formatFrac(n2, d)} = ?`,
    answer,
  };
}

function buildFracDiffDenomAdd() {
  for (let i = 0; i < 50; i++) {
    const d1 = pick(FRAC_DENOMS);
    let d2 = pick(FRAC_DENOMS);
    if (d1 === d2) d2 = pick(FRAC_DENOMS.filter((d) => d !== d1));
    const n1 = randInt(1, d1);
    const n2 = randInt(1, d2);
    const sum = (n1 * d2 + n2 * d1) / (d1 * d2);
    if (isIntegerValue(sum) && sum >= 1 && sum <= 40) {
      return {
        text: `${formatFrac(n1, d1)} + ${formatFrac(n2, d2)} = ?`,
        answer: Math.round(sum),
      };
    }
  }
  return buildFracSameDenomAdd();
}

function buildFracSameDenomSub() {
  const d = pick(FRAC_DENOMS);
  const answer = randInt(1, 12);
  const n2 = randInt(1, d - 1);
  const n1 = answer * d + n2;
  return {
    text: `${formatFrac(n1, d)} - ${formatFrac(n2, d)} = ?`,
    answer,
  };
}

function buildFracMulInt() {
  for (let i = 0; i < 40; i++) {
    const d = pick(FRAC_DENOMS);
    const n = randInt(1, d * 2);
    const [sn, sd] = simplifyFrac(n, d);
    const answer = randInt(2, 36);
    if ((answer * sd) % sn !== 0) continue;
    const mult = (answer * sd) / sn;
    if (mult < 2 || mult > 24) continue;
    return {
      text: `${formatFrac(sn, sd)} × ${mult} = ?`,
      answer,
    };
  }
  return buildFracSameDenomAdd();
}

function buildFracDiv() {
  const answer = randInt(2, 20);
  const d2 = pick(FRAC_DENOMS);
  const n2 = randInt(1, d2);
  const [sn2, sd2] = simplifyFrac(n2, d2);
  const [n1, d1] = simplifyFrac(answer * sn2, sd2);
  return {
    text: `${formatFrac(n1, d1)} ÷ ${formatFrac(sn2, sd2)} = ?`,
    answer,
  };
}

function buildFracTimesFrac() {
  for (let i = 0; i < 50; i++) {
    const d1 = pick(FRAC_DENOMS);
    const d2 = pick(FRAC_DENOMS);
    const n1 = randInt(1, d1);
    const n2 = randInt(1, d2);
    const product = (n1 * n2) / (d1 * d2);
    if (isIntegerValue(product) && product >= 1 && product <= 40) {
      return {
        text: `${formatFrac(n1, d1)} × ${formatFrac(n2, d2)} = ?`,
        answer: Math.round(product),
      };
    }
  }
  return buildFracMulInt();
}

function buildWildcardExponent() {
  const base = randInt(2, 12);
  const exp = randInt(2, 5);
  return {
    text: `${base}^${exp} = ?`,
    answer: Math.pow(base, exp),
  };
}

function buildWildcardArith() {
  for (let i = 0; i < 20; i++) {
    const problem = buildProblem('hard', pick(OPS));
    if (withinLimits(problem, LIMITS.hard)) {
      return { text: problem.text, answer: problem.answer };
    }
  }
  return buildWildcardExponent();
}

const WILDCARD_BUILDERS = [
  { weight: 2, fn: buildFracSameDenomAdd },
  { weight: 3, fn: buildFracDiffDenomAdd },
  { weight: 2, fn: buildFracSameDenomSub },
  { weight: 2, fn: buildFracMulInt },
  { weight: 2, fn: buildFracTimesFrac },
  { weight: 2, fn: buildFracDiv },
  { weight: 4, fn: buildWildcardExponent },
  { weight: 1, fn: buildWildcardArith },
];

function generateWildcardProblem() {
  const builder = pickWeightedBuilder(WILDCARD_BUILDERS);
  return builder();
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

function generateProblem(difficulty) {
  if (difficulty === 'wildcard') {
    return generateWildcardProblem();
  }

  const limits = LIMITS[difficulty] ?? LIMITS.easy;

  for (let i = 0; i < 40; i++) {
    const problem = buildProblem(difficulty, pick(OPS));
    if (withinLimits(problem, limits)) {
      return { text: problem.text, answer: problem.answer };
    }
  }

  const fallback = buildProblem(difficulty, '+');
  return { text: fallback.text, answer: fallback.answer };
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
    if (!el) return;
    const active = key === name;
    el.classList.toggle('hidden', !active);
    if ('inert' in el) {
      el.inert = !active;
    }
  });
}

function clearFeedback() {
  els.feedback.textContent = '';
  els.feedback.className = 'feedback';
}

function enableAnswerInput() {
  if (!els.answerInput) return;
  els.answerInput.disabled = false;
  els.answerInput.readOnly = false;
  els.answerInput.removeAttribute('aria-disabled');
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
  const mins = Number(els.timeSlider?.value);
  state.minutes = Number.isFinite(mins) && mins >= 1 ? mins : 2;
  state.score = 0;
  state.endsAt = Date.now() + state.minutes * 60 * 1000;

  els.score.textContent = '0';
  els.timer.textContent = formatTime(state.minutes * 60 * 1000);
  clearFeedback();
  enableAnswerInput();

  showScreen('play');
  nextProblem();
  focusAnswerInput();

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
    if (state.wrongTimeoutId !== null) {
      clearTimeout(state.wrongTimeoutId);
      state.wrongTimeoutId = null;
    }
    state.score += 1;
    els.score.textContent = String(state.score);
    nextProblem();
    focusAnswerInput();
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
        focusAnswerInput();
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
  stopTimers();
  state.current = null;
  state.endsAt = 0;
  enableAnswerInput();
  updateHighScoreDisplay();
  showScreen('setup');
});

els.quitBtn.addEventListener('click', quitGame);

els.themeToggle.addEventListener('click', toggleTheme);

initTheme();
updateHighScoreDisplay();
