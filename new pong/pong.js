const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = (canvas.width = 700);
const H = (canvas.height = 400);
const PADDLE_W = 10;
const PADDLE_H_BASE = 70;
const PADDLE_HEIGHT_MULT = 1.5;
const BALL_RADIUS = 7;
const DIFFICULTY_PRESETS = {
  easy: { ballBase: 180, cpuAgility: 0.45 },
  normal: { ballBase: 260, cpuAgility: 0.65 },
  hard: { ballBase: 340, cpuAgility: 0.9 },
};
const BLOCK_WIDTH = 10;
const BLOCK_HEIGHT = (((100 * 2) / 3) * 3) / 4; // ~50px
const BLOCK_OFFSET = 80;
const BLOCK_EDGE_GAP = 60;
const BLOCK_GAP = 20;
const blocks = [
  {
    side: "player",
    x: PADDLE_W + BLOCK_OFFSET,
    y: BLOCK_EDGE_GAP,
    w: BLOCK_WIDTH,
    h: BLOCK_HEIGHT,
    active: true,
    bounceOnVXNeg: true,
  },
  {
    side: "player",
    x: PADDLE_W + BLOCK_OFFSET,
    y: H - BLOCK_EDGE_GAP - BLOCK_HEIGHT,
    w: BLOCK_WIDTH,
    h: BLOCK_HEIGHT,
    active: true,
    bounceOnVXNeg: true,
  },
  {
    side: "cpu",
    x: W - PADDLE_W - BLOCK_OFFSET - BLOCK_WIDTH,
    y: BLOCK_EDGE_GAP,
    w: BLOCK_WIDTH,
    h: BLOCK_HEIGHT,
    active: true,
    bounceOnVXPos: true,
  },
  {
    side: "cpu",
    x: W - PADDLE_W - BLOCK_OFFSET - BLOCK_WIDTH,
    y: H - BLOCK_EDGE_GAP - BLOCK_HEIGHT,
    w: BLOCK_WIDTH,
    h: BLOCK_HEIGHT,
    active: true,
    bounceOnVXPos: true,
  },
];
const THEMES = {
  classic: { bg1: "#001f3f", bg2: "#071a2b" },
  charcoal: { bg1: "#222222", bg2: "#0b0b0b" },
  neon: { bg1: "#071827", bg2: "#001018" },
};
let playerName = "Player";
let chosenDifficulty = "normal";
let chosenTheme = "classic";
let initialLives = 3;
let multiBallEnabled = false;
let state = {
  running: false,
  gameOver: false,
  paused: false,
  scoringLocked: false,
  livesLeft: initialLives,
  livesRight: initialLives,
  lastTime: 0,
  playerY: 0,
  cpuY: 0,
  playerPrevY: 0,
  playerPadH: PADDLE_H_BASE * PADDLE_HEIGHT_MULT,
  cpuPadH: PADDLE_H_BASE * PADDLE_HEIGHT_MULT,
  balls: [],
  longestRally: 0,
  currentRallyTime: 0,
  fastestBall: 0,
  playerSacrificedBlocks: false,
  playerSacrificedPad: false,
};

// Visual effects system
let particles = [];
let ballTrails = [];
let screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };

// Ball class
class Ball {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.spin = 0;
    this.trail = [];
  }

  update(dt) {
    this.vy += this.spin * dt;
    this.spin *= Math.pow(0.9, dt * 60);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Add to trail
    this.trail.push({ x: this.x, y: this.y, time: performance.now() });
    // Keep only recent trail points
    const now = performance.now();
    this.trail = this.trail.filter((point) => now - point.time < 200);
  }
}

// Particle system
class Particle {
  constructor(x, y, vx, vy, color, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = Math.random() * 3 + 1;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.vx *= 0.98;
    this.vy *= 0.98;
  }

  render(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Helper functions for effects
function createParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 50 + Math.random() * 100;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    particles.push(
      new Particle(x, y, vx, vy, color, 0.5 + Math.random() * 0.5)
    );
  }
}

function renderBallTrails() {
  state.balls.forEach((ball) => {
    if (ball.trail.length < 2) return;

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i < ball.trail.length; i++) {
      const point = ball.trail[i];
      const alpha = i / ball.trail.length;
      ctx.globalAlpha = alpha * 0.3;

      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function renderParticles() {
  particles.forEach((particle) => particle.render(ctx));
}

function addScreenShake(intensity, duration) {
  screenShake.intensity = Math.max(screenShake.intensity, intensity);
  screenShake.duration = Math.max(screenShake.duration, duration);
}

function updateScreenShake(dt) {
  if (screenShake.duration > 0) {
    screenShake.duration -= dt;
    const shake = screenShake.intensity * (screenShake.duration / 0.3);
    screenShake.x = (Math.random() - 0.5) * shake;
    screenShake.y = (Math.random() - 0.5) * shake;
  } else {
    screenShake.x = 0;
    screenShake.y = 0;
    screenShake.intensity = 0;
  }
}
const leftNameEl = document.getElementById("leftName");
const rightNameEl = document.getElementById("rightName");
const leftScoreEl = document.getElementById("leftScore");
const rightScoreEl = document.getElementById("rightScore");
const matchInfoEl = document.getElementById("matchInfo");
const speedInfoEl = document.getElementById("speedInfo");
const pointBanner = document.getElementById("pointBanner");
const nameOverlay = document.getElementById("nameOverlay");
const difficultyOverlay = document.getElementById("difficultyOverlay");
const roundsOverlay = document.getElementById("roundsOverlay");
const themeOverlay = document.getElementById("themeOverlay");
const sacrificeOverlay = document.getElementById("sacrificeOverlay");
const finalOverlay = document.getElementById("finalOverlay");
const nameContinueBtn = document.getElementById("nameContinue");
const diffContinueBtn = document.getElementById("diffContinue");
const roundsContinueBtn = document.getElementById("roundsContinue");
const themeContinueBtn = document.getElementById("themeContinue");
const playAgainBtn = document.getElementById("playAgain");
const resetBtn = document.getElementById("resetBtn");
const exitBtn = document.getElementById("exitBtn");
const pauseBtn = document.getElementById("pauseBtn");
const settingsBtn = document.getElementById("settingsBtn");
const audioHit = document.getElementById("sfxHit");
const audioWall = document.getElementById("sfxWall");
const audioScore = document.getElementById("sfxScore");
const audioVictory = document.getElementById("sfxVictory");
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function clearSelected(containerSelector) {
  document
    .querySelectorAll(containerSelector + " .selectable")
    .forEach((el) => el.classList.remove("selected"));
}
function selectElement(el) {
  if (!el) return;
  el.classList.add("selected");
}
nameContinueBtn.addEventListener("click", () => {
  const name = document.getElementById("playerNameInput").value.trim();
  if (name) playerName = name;
  leftNameEl.textContent = playerName;
  nameOverlay.style.display = "none";
  difficultyOverlay.style.display = "flex";
});
document.querySelectorAll("#difficultyGrid .selectable").forEach((btn) => {
  btn.addEventListener("click", () => {
    clearSelected("#difficultyGrid");
    selectElement(btn);
    chosenDifficulty = btn.dataset.level;
  });
});
diffContinueBtn.addEventListener("click", () => {
  if (!document.querySelector("#difficultyGrid .selected")) {
    document
      .querySelector('#difficultyGrid .selectable[data-level="normal"]')
      .classList.add("selected");
    chosenDifficulty = "normal";
  }
  difficultyOverlay.style.display = "none";
  roundsOverlay.style.display = "flex";
});
document.querySelectorAll("#roundGrid .selectable").forEach((btn) => {
  btn.addEventListener("click", () => {
    clearSelected("#roundGrid");
    selectElement(btn);
    initialLives = parseInt(btn.dataset.lives, 10);
  });
});
roundsContinueBtn.addEventListener("click", () => {
  const sel = document.querySelector("#roundGrid .selected");
  if (!sel) {
    document
      .querySelector('#roundGrid .selectable[data-lives="3"]')
      .classList.add("selected");
    initialLives = 3;
  }
  roundsOverlay.style.display = "none";
  multiBallOverlay.style.display = "flex";
});

// Multi-ball selection handlers
document.querySelectorAll("#multiBallGrid .selectable").forEach((btn) => {
  btn.addEventListener("click", () => {
    clearSelected("#multiBallGrid");
    selectElement(btn);
    multiBallEnabled = btn.dataset.multiball === "true";
  });
});

const multiBallOverlay = document.getElementById("multiBallOverlay");
const multiBallContinueBtn = document.getElementById("multiBallContinue");

multiBallContinueBtn.addEventListener("click", () => {
  const sel = document.querySelector("#multiBallGrid .selected");
  if (!sel) {
    document
      .querySelector('#multiBallGrid .selectable[data-multiball="false"]')
      .classList.add("selected");
    multiBallEnabled = false;
  }
  multiBallOverlay.style.display = "none";
  themeOverlay.style.display = "flex";
});
document.querySelectorAll(".themeOption").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".themeOption")
      .forEach((x) => x.classList.remove("selected"));
    btn.classList.add("selected");
    chosenTheme = btn.dataset.theme;
  });
});
themeContinueBtn.addEventListener("click", () => {
  if (!document.querySelector(".themeOption.selected")) {
    document
      .querySelector('.themeOption[data-theme="classic"]')
      .classList.add("selected");
    chosenTheme = "classic";
  }
  themeOverlay.style.display = "none";
  initAudio(); // Initialize audio when starting the game
  startMatch();
});
pauseBtn.addEventListener("click", () => togglePause());
settingsBtn.addEventListener("click", () => {
  nameOverlay.style.display = "flex";
});
playAgainBtn.addEventListener("click", () => {
  finalOverlay.style.display = "none";
  startMatch();
});
resetBtn.addEventListener("click", () => {
  finalOverlay.style.display = "none";
  nameOverlay.style.display = "flex";
  state.running = false;
  state.gameOver = false;
});
exitBtn.addEventListener("click", () => window.location.reload());
function startMatch() {
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  state.scoringLocked = false;
  state.livesLeft = initialLives;
  state.livesRight = initialLives;
  state.longestRally = 0;
  state.fastestBall = 0;
  state.playerPadH = PADDLE_H_BASE * PADDLE_HEIGHT_MULT;
  state.cpuPadH = PADDLE_H_BASE * PADDLE_HEIGHT_MULT;
  state.playerSacrificedBlocks = false;
  state.playerSacrificedPad = false;
  blocks.forEach((b) => {
    b.active = true;
  });
  matchInfoEl.textContent = `${initialLives} Lives`;
  updateLivesUI();
  resetRoundServe();
  applyTheme();
  state.lastTime = performance.now();
  requestAnimationFrame(loop);
}
function resetRoundServe() {
  state.playerY = (H - state.playerPadH) / 2;
  state.cpuY = (H - state.cpuPadH) / 2;
  state.playerPrevY = state.playerY;

  // Clear existing balls and create new ones
  state.balls = [];
  const numBalls = multiBallEnabled ? 3 : 1;

  for (let i = 0; i < numBalls; i++) {
    const base = DIFFICULTY_PRESETS[chosenDifficulty].ballBase;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const vx = dir * (base + (Math.random() * 30 - 15));
    const vy = (Math.random() * 2 - 1) * base * 0.2;

    // Spread balls vertically if multi-ball
    const yOffset = multiBallEnabled ? (i - 1) * 50 : 0;
    const ball = new Ball(W / 2, H / 2 + yOffset, vx, vy);
    state.balls.push(ball);
  }
}
let currentTheme = THEMES.classic;
function applyTheme() {
  currentTheme = THEMES[chosenTheme] || THEMES.classic;
  // Apply theme to CSS variables
  document.documentElement.style.setProperty("--canvas-bg", currentTheme.bg2);
}
const keys = {};
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    keys[e.key] = true;
    e.preventDefault();
  }
  if (e.code === "Space") {
    e.preventDefault();
    togglePause();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") keys[e.key] = false;
});
let mouseDown = false;
canvas.addEventListener("mousedown", (e) => {
  mouseDown = true;
  const r = canvas.getBoundingClientRect();
  const y = e.clientY - r.top;
  state.playerY = clamp(y - state.playerPadH / 2, 0, H - state.playerPadH);
});
window.addEventListener("mouseup", () => (mouseDown = false));
canvas.addEventListener("mousemove", (e) => {
  if (!mouseDown) return;
  const r = canvas.getBoundingClientRect();
  const y = e.clientY - r.top;
  state.playerY = clamp(y - state.playerPadH / 2, 0, H - state.playerPadH);
});
function handlePaddleCollision(dt) {
  state.balls.forEach((ball) => {
    // Player paddle collision
    if (ball.vx < 0 && ball.x - BALL_RADIUS <= PADDLE_W) {
      if (ball.y > state.playerY && ball.y < state.playerY + state.playerPadH) {
        const pv = (state.playerY - state.playerPrevY) / dt;
        const powerThreshold = 300;
        let pm = 1.0;
        if (Math.abs(pv) > powerThreshold) pm = 1.4;
        ball.vx = Math.abs(ball.vx) * pm;
        const hitPos =
          (ball.y - (state.playerY + state.playerPadH / 2)) /
          (state.playerPadH / 2);
        ball.vy += hitPos * Math.abs(ball.vx) * 0.25;
        ball.spin += hitPos * 0.05;
        ball.x = PADDLE_W + BALL_RADIUS + 0.5;
        playSfx(audioHit);
        createParticles(ball.x, ball.y, "#ff4d4d", 6);
        addScreenShake(3, 0.1);
        state.currentRallyTime = 0;
      }
    }

    // CPU paddle collision
    if (ball.vx > 0 && ball.x + BALL_RADIUS >= W - PADDLE_W) {
      if (ball.y > state.cpuY && ball.y < state.cpuY + state.cpuPadH) {
        let pm = 1.0;
        if (Math.random() < 0.08) pm = 1.15;
        ball.vx = -Math.abs(ball.vx) * pm;
        const hitPos =
          (ball.y - (state.cpuY + state.cpuPadH / 2)) / (state.cpuPadH / 2);
        ball.vy += hitPos * Math.abs(ball.vx) * 0.25;
        ball.spin += hitPos * 0.05;
        ball.x = W - PADDLE_W - BALL_RADIUS - 0.5;
        playSfx(audioHit);
        createParticles(ball.x, ball.y, "#4dff4d", 6);
        addScreenShake(3, 0.1);
        state.currentRallyTime = 0;
      }
    }
  });
}
function update(dt) {
  if (!state.running || state.gameOver || state.paused) return;

  // Update particles
  particles = particles.filter((p) => {
    p.update(dt);
    return p.life > 0;
  });

  // Update screen shake
  updateScreenShake(dt);

  state.playerPrevY = state.playerY;
  const paddleSpeed = 320 * dt;
  if (keys["ArrowUp"]) state.playerY -= paddleSpeed;
  if (keys["ArrowDown"]) state.playerY += paddleSpeed;
  state.playerY = clamp(state.playerY, 0, H - state.playerPadH);

  // CPU AI - track closest ball
  const ag = DIFFICULTY_PRESETS[chosenDifficulty].cpuAgility;
  const cpuCtr = state.cpuY + state.cpuPadH / 2;
  let closestBall = state.balls[0];
  if (state.balls.length > 1) {
    closestBall = state.balls.reduce((closest, ball) =>
      ball.x > closest.x ? ball : closest
    );
  }
  const ballCtr = closestBall ? closestBall.y : H / 2;
  const cpuMv = (ballCtr - cpuCtr) * ag * dt * 6;
  state.cpuY = clamp(state.cpuY + cpuMv, 0, H - state.cpuPadH);

  // Update balls
  state.balls.forEach((ball) => {
    ball.update(dt);

    // Wall collisions
    if (ball.y - BALL_RADIUS <= 0) {
      ball.y = BALL_RADIUS;
      ball.vy = Math.abs(ball.vy);
      playSfx(audioWall);
      createParticles(ball.x, ball.y, "#ffffff", 4);
    } else if (ball.y + BALL_RADIUS >= H) {
      ball.y = H - BALL_RADIUS;
      ball.vy = -Math.abs(ball.vy);
      playSfx(audioWall);
      createParticles(ball.x, ball.y, "#ffffff", 4);
    }
  });

  handlePaddleCollision(dt);

  // Block collisions
  state.balls.forEach((ball) => {
    blocks.forEach((b) => {
      if (!b.active) return;
      const hitX =
        ball.x + BALL_RADIUS > b.x && ball.x - BALL_RADIUS < b.x + b.w;
      const hitY =
        ball.y + BALL_RADIUS > b.y && ball.y - BALL_RADIUS < b.y + b.h;
      if (hitX && hitY) {
        if (b.bounceOnVXNeg && ball.vx < 0) {
          ball.vx = Math.abs(ball.vx);
          ball.x = b.x + b.w + BALL_RADIUS + 0.5;
          playSfx(audioWall);
          createParticles(
            ball.x,
            ball.y,
            b.side === "player" ? "#ff4d4d" : "#4dff4d",
            6
          );
        } else if (b.bounceOnVXPos && ball.vx > 0) {
          ball.vx = -Math.abs(ball.vx);
          ball.x = b.x - BALL_RADIUS - 0.5;
          playSfx(audioWall);
          createParticles(
            ball.x,
            ball.y,
            b.side === "player" ? "#ff4d4d" : "#4dff4d",
            6
          );
        }
      }
    });
  });

  // Scoring - check if any ball went off screen
  if (!state.scoringLocked) {
    const leftBalls = state.balls.filter((ball) => ball.x + BALL_RADIUS < 0);
    const rightBalls = state.balls.filter((ball) => ball.x - BALL_RADIUS > W);

    if (leftBalls.length > 0) {
      state.scoringLocked = true;
      onPoint("cpu");
    } else if (rightBalls.length > 0) {
      state.scoringLocked = true;
      onPoint("player");
    }
  }

  state.currentRallyTime += dt;
  if (state.currentRallyTime > state.longestRally)
    state.longestRally = state.currentRallyTime;

  // Track fastest ball and update speed display
  let maxSpeed = 0;
  state.balls.forEach((ball) => {
    const speedNow = Math.hypot(ball.vx, ball.vy);
    if (speedNow > state.fastestBall) state.fastestBall = Math.round(speedNow);
    if (speedNow > maxSpeed) maxSpeed = speedNow;
  });

  if (speedInfoEl && state.balls.length > 0) {
    speedInfoEl.textContent = `Speed: ${Math.round(maxSpeed)}`;
  }
}
function onPoint(winner) {
  state.roundPaused = true;
  playSfx(audioScore);
  addScreenShake(8, 0.3);
  createParticles(
    W / 2,
    H / 2,
    winner === "player" ? "#ff4d4d" : "#4dff4d",
    15
  );
  showPointBanner(`${winner === "player" ? playerName : "Optimus"} scores!`);
  if (winner === "player") {
    commitLoss("cpu", "life");
  } else {
    if (
      state.livesLeft > 1 &&
      (!state.playerSacrificedBlocks || !state.playerSacrificedPad)
    ) {
      showSacrificeOverlay();
    } else {
      commitLoss("player", "life");
    }
  }
}
function commitLoss(role, type) {
  if (role === "player") {
    if (type === "life") {
      state.livesLeft--;
      showPointBanner("Lost a Life");
    } else if (type === "blocks") {
      blocks
        .filter((b) => b.side === "player")
        .forEach((b) => (b.active = false));
      state.playerSacrificedBlocks = true;
      showPointBanner("Sacrificed Blocks");
    } else if (type === "pad") {
      state.playerPadH *= 0.5;
      state.playerSacrificedPad = true;
      showPointBanner("Sacrificed Paddle Length");
    }
  } else {
    state.livesRight--;
    showPointBanner("Optimus Lost a Life");
  }
  updateLivesUI();
  if (state.livesLeft <= 0 || state.livesRight <= 0) {
    setTimeout(() => endMatchAndShowFinal(), 1100);
  } else {
    setTimeout(() => {
      state.scoringLocked = false;
      resetRoundServe();
    }, 900);
  }
}
function showSacrificeOverlay() {
  const sacrificeGrid = document.getElementById("sacrificeGrid");
  sacrificeGrid.innerHTML = "";
  const options = [];
  if (!state.playerSacrificedBlocks) {
    options.push({ option: "blocks", text: "Remove Blocks" });
  }
  if (!state.playerSacrificedPad) {
    options.push({ option: "pad", text: "Halve Paddle Size" });
  }
  options.push({ option: "life", text: "Lose a Life" });
  options.forEach((opt) => {
    const div = document.createElement("div");
    div.className = "selectable sac-option";
    div.dataset.option = opt.option;
    div.innerHTML = `<div style="font-weight:800">${opt.text}</div>`;
    sacrificeGrid.appendChild(div);
  });
  sacrificeOverlay.style.display = "flex";
  let timeout = setTimeout(() => {
    hideSacrificeOverlay();
    commitLoss("player", "life");
  }, 3500);
  sacrificeOverlay.onclick = (e) => {
    if (!e.target.classList.contains("sac-option")) return;
    clearTimeout(timeout);
    const choice = e.target.dataset.option;
    hideSacrificeOverlay();
    commitLoss("player", choice);
  };
}
function hideSacrificeOverlay() {
  sacrificeOverlay.style.display = "none";
  sacrificeOverlay.onclick = null;
}
function showPointBanner(text) {
  pointBanner.textContent = text;
  pointBanner.classList.remove("show");
  void pointBanner.offsetWidth;
  pointBanner.classList.add("show");
}
// Audio system with Web Audio API fallback
let audioContext;
let audioEnabled = true;

function initAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    audioEnabled = false;
  }
}

function createTone(frequency, duration, type = "sine") {
  if (!audioEnabled || !audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.type = type;

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.01,
    audioContext.currentTime + duration
  );

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

function playSfx(audio) {
  // Try to play the audio file first
  if (audio && audio.src) {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Fallback to generated sounds
      playGeneratedSound(audio.id);
    });
  } else {
    playGeneratedSound(audio?.id || "unknown");
  }
}

function playGeneratedSound(soundId) {
  if (!audioEnabled) return;

  switch (soundId) {
    case "sfxHit":
      createTone(800, 0.1, "square");
      break;
    case "sfxWall":
      createTone(400, 0.15, "sawtooth");
      break;
    case "sfxScore":
      createTone(600, 0.2);
      setTimeout(() => createTone(800, 0.2), 100);
      break;
    case "sfxVictory":
      createTone(523, 0.2); // C
      setTimeout(() => createTone(659, 0.2), 200); // E
      setTimeout(() => createTone(784, 0.4), 400); // G
      break;
  }
}
function updateLivesUI() {
  leftScoreEl.innerHTML = "";
  rightScoreEl.innerHTML = "";
  for (let i = 0; i < initialLives; i++) {
    const dot = document.createElement("div");
    dot.className = "life-dot" + (i < state.livesLeft ? "" : " empty");
    leftScoreEl.appendChild(dot);
  }
  for (let i = 0; i < initialLives; i++) {
    const dot = document.createElement("div");
    dot.className = "life-dot" + (i < state.livesRight ? "" : " empty");
    rightScoreEl.appendChild(dot);
  }
}
function endMatchAndShowFinal() {
  state.gameOver = true;
  state.running = false;
  const finalTitle = document.getElementById("finalTitle");
  if (state.livesLeft > 0) {
    finalTitle.textContent = "You Won, Congratulations!";
    playSfx(audioVictory);
  } else {
    finalTitle.textContent = "You Lost";
  }
  finalOverlay.style.display = "flex";
}
function render() {
  // Apply screen shake
  ctx.save();
  ctx.translate(screenShake.x, screenShake.y);

  // Apply theme background
  ctx.fillStyle = currentTheme.bg1;
  ctx.fillRect(-screenShake.x, -screenShake.y, W, H);

  // Draw center line
  ctx.strokeStyle = "#ffffff33";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.setLineDash([5, 15]);
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw ball trails
  renderBallTrails();

  // Draw paddles with glow effect
  const playerSpeed = Math.abs(state.playerY - state.playerPrevY);
  if (playerSpeed > 2) {
    ctx.shadowColor = "#ff4d4d";
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = "#ff4d4d";
  ctx.fillRect(0, state.playerY, PADDLE_W, state.playerPadH);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#4dff4d";
  ctx.fillRect(W - PADDLE_W, state.cpuY, PADDLE_W, state.cpuPadH);

  // Draw blocks
  blocks.forEach((b) => {
    if (b.active) {
      ctx.fillStyle = b.side === "player" ? "#ff4d4d99" : "#4dff4d99";
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  });

  // Draw balls with glow
  state.balls.forEach((ball) => {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 300) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // Draw visual effects
  renderParticles();

  ctx.restore();
}
function togglePause() {
  if (state.gameOver) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  if (!state.paused) {
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}
function loop(now) {
  if (!state.running || state.paused || state.gameOver) return;
  const dt = (now - state.lastTime) / 1000;
  state.lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
// Initialize the game
updateLivesUI();
applyTheme();
