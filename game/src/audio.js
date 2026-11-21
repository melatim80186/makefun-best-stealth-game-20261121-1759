// Tiny WebAudio synth: every sound is generated, no audio files. The context
// is created lazily on the first user gesture so browsers never block it.
let audioContext = null;
let muted = false;
let humNodes = null;

function context() {
  // No window (a Node check, a dossier run): there is simply no sound.
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioContext = new AC();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function tone(freq, duration, type, volume, slideTo) {
  if (muted) return;
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ac.currentTime + duration);
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.02);
}

function noiseBurst(duration, volume, lowpass) {
  if (muted) return;
  const ac = context();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

/** A soft footstep; pitch alternates left/right so walking reads as steps. */
export function playFootstep(sneaking, alternate) {
  if (sneaking) noiseBurst(0.05, 0.05, 500);
  else noiseBurst(0.07, 0.12, alternate ? 700 : 550);
}

/** Two-note chime when a relic is lifted. */
export function playPickup() {
  tone(660, 0.12, 'sine', 0.16);
  setTimeout(() => tone(990, 0.22, 'sine', 0.16), 90);
}

/** Rising sting when a guard raises the alarm. */
export function playAlert() {
  tone(220, 0.35, 'sawtooth', 0.14, 440);
  setTimeout(() => tone(330, 0.3, 'sawtooth', 0.12, 494), 120);
}

/** A low thud when the thief is caught. */
export function playCaught() {
  tone(160, 0.5, 'triangle', 0.22, 55);
  noiseBurst(0.25, 0.18, 300);
}

/** Little major arpeggio for clearing a wing. */
export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.15), i * 110));
}

export function playClick() {
  tone(520, 0.06, 'sine', 0.1);
}

/** A barely-there room tone under the title screen; off during play. */
export function startRoomTone() {
  const ac = context();
  if (!ac || humNodes) return;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55;
  const gain = ac.createGain();
  gain.gain.value = muted ? 0 : 0.03;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.2;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain).connect(gain.gain);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  lfo.start();
  humNodes = { osc, lfo, gain };
}

export function toggleMute() {
  muted = !muted;
  if (humNodes) humNodes.gain.gain.value = muted ? 0 : 0.03;
  return muted;
}
export function isMuted() {
  return muted;
}
