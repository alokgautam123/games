"use strict";

const FOODS = [
  { name: "apple", plural: "apples", emoji: "🍎" },
  { name: "banana", plural: "bananas", emoji: "🍌" },
  { name: "strawberry", plural: "strawberries", emoji: "🍓" },
  { name: "carrot", plural: "carrots", emoji: "🥕" },
  { name: "grape", plural: "grapes", emoji: "🍇" },
  { name: "orange", plural: "oranges", emoji: "🍊" },
  { name: "watermelon", plural: "watermelons", emoji: "🍉" },
  { name: "corn", plural: "corn cobs", emoji: "🌽" }
];

const TOTAL_ROUNDS = 6;
const state = { round: 1, score: 0, collected: 0, targetCount: 2, target: FOODS[0], locked: true, sound: true };

const el = Object.fromEntries([
  "score", "roundLabel", "progressBar", "targetCount", "targetName", "targetEmoji", "countDots",
  "monster", "feedback", "foodTray", "celebration", "welcomeModal", "finishModal",
  "startButton", "playAgainButton", "finalScore", "soundButton"
].map(id => [id, document.getElementById(id)]));

let audioContext;

function tone(frequency, duration, type = "sine", delay = 0) {
  if (!state.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, audioContext.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + delay + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(audioContext.currentTime + delay);
    oscillator.stop(audioContext.currentTime + delay + duration + 0.03);
  } catch (_) { /* Sound is optional. */ }
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function updateDots() {
  el.countDots.replaceChildren();
  for (let index = 0; index < state.targetCount; index += 1) {
    const dot = document.createElement("span");
    dot.className = `count-dot${index < state.collected ? " filled" : ""}`;
    el.countDots.append(dot);
  }
  el.countDots.setAttribute("aria-label", `${state.collected} of ${state.targetCount} collected`);
}

function createFoodButton(food) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "food-button";
  button.dataset.food = food.name;
  button.setAttribute("aria-label", food.name);
  button.innerHTML = `<span class="food-emoji" aria-hidden="true">${food.emoji}</span>`;
  button.addEventListener("click", () => feed(food, button));
  return button;
}

function startRound() {
  state.locked = false;
  state.collected = 0;
  state.targetCount = Math.min(1 + Math.ceil(state.round / 2), 4);
  state.target = FOODS[Math.floor(Math.random() * FOODS.length)];

  el.roundLabel.textContent = `Round ${state.round} of ${TOTAL_ROUNDS}`;
  el.progressBar.style.width = `${((state.round - 1) / TOTAL_ROUNDS) * 100}%`;
  el.targetCount.textContent = state.targetCount;
  el.targetName.textContent = state.targetCount === 1 ? state.target.name : state.target.plural;
  el.targetEmoji.textContent = state.target.emoji;
  el.feedback.className = "feedback";
  el.feedback.textContent = "Pick the right snacks!";
  updateDots();

  const otherFoods = shuffle(FOODS.filter(food => food.name !== state.target.name)).slice(0, 5);
  const choices = shuffle([state.target, ...otherFoods]);
  el.foodTray.replaceChildren(...choices.map(createFoodButton));
}

function feed(food, button) {
  if (state.locked) return;

  if (food.name !== state.target.name) {
    el.feedback.textContent = `Oops! Munchy wants ${state.target.plural}. Try again!`;
    el.feedback.className = "feedback try";
    el.monster.classList.remove("oops");
    void el.monster.offsetWidth;
    el.monster.classList.add("oops");
    tone(180, 0.18, "triangle");
    return;
  }

  state.collected += 1;
  state.score += 1;
  el.score.textContent = state.score;
  updateDots();
  el.feedback.textContent = state.collected === state.targetCount ? "Yummy! You did it!" : "Yum! One more!";
  el.feedback.className = "feedback good";
  button.animate([
    { transform: "scale(1)", opacity: 1 },
    { transform: "translateY(-145px) scale(.25)", opacity: 0 }
  ], { duration: 360, easing: "ease-in", fill: "none" });
  el.monster.classList.add("chomp");
  setTimeout(() => el.monster.classList.remove("chomp"), 180);
  tone(420 + state.collected * 80, 0.12, "sine");

  if (state.collected >= state.targetCount) completeRound();
}

function completeRound() {
  state.locked = true;
  state.score += 2;
  el.score.textContent = state.score;
  el.monster.classList.add("happy");
  tone(523, 0.15, "sine", 0);
  tone(659, 0.15, "sine", 0.14);
  tone(784, 0.25, "sine", 0.28);
  launchConfetti(14);

  setTimeout(() => {
    el.monster.classList.remove("happy");
    if (state.round >= TOTAL_ROUNDS) finishGame();
    else { state.round += 1; startRound(); }
  }, 1150);
}

function launchConfetti(count) {
  const shapes = ["⭐", "✨", "●", "■"];
  for (let index = 0; index < count; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.textContent = shapes[index % shapes.length];
    piece.style.left = `${5 + Math.random() * 90}%`;
    piece.style.color = ["#ff5c94", "#ffb52e", "#43bd75", "#7046d9"][index % 4];
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    el.celebration.append(piece);
    setTimeout(() => piece.remove(), 1900);
  }
}

function resetGame() {
  state.round = 1;
  state.score = 0;
  el.score.textContent = "0";
  el.finishModal.classList.remove("open");
  startRound();
}

function finishGame() {
  el.progressBar.style.width = "100%";
  el.finalScore.textContent = state.score;
  el.finishModal.classList.add("open");
  launchConfetti(28);
  el.playAgainButton.focus();
}

el.startButton.addEventListener("click", () => {
  el.welcomeModal.classList.remove("open");
  resetGame();
});
el.playAgainButton.addEventListener("click", resetGame);
el.soundButton.addEventListener("click", () => {
  state.sound = !state.sound;
  el.soundButton.textContent = state.sound ? "🔊" : "🔇";
  el.soundButton.setAttribute("aria-label", state.sound ? "Turn sound off" : "Turn sound on");
  if (state.sound) tone(520, 0.12);
});

updateDots();
