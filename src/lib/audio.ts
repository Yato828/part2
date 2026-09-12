let ctx: AudioContext | null = null;
let enabled = false;
let drone: { stop: () => void } | null = null;

function ac() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function armAudio() {
  enabled = true;
  void ac().resume();
}

function beep(freq: number, dur = 0.06, type: OscillatorType = "square", gain = 0.04, at = 0) {
  if (!enabled) return;
  const c = ac();
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noiseBurst(dur = 0.35, gain = 0.045, at = 0) {
  if (!enabled) return;
  const c = ac();
  const t0 = c.currentTime + at;
  const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = n.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1800;
  src.buffer = n;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

function startDrone() {
  if (!enabled || drone) return;
  const c = ac();
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  o1.type = "sine";
  o2.type = "sawtooth";
  o1.frequency.value = 55;
  o2.frequency.value = 110.5;
  g.gain.value = 0.018;
  o1.connect(g);
  o2.connect(g);
  g.connect(c.destination);
  o1.start();
  o2.start();
  drone = {
    stop() {
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
      o1.stop(c.currentTime + 0.45);
      o2.stop(c.currentTime + 0.45);
      drone = null;
    },
  };
}

export function stopDrone() {
  drone?.stop();
}

export function playBootScore() {
  armAudio();
  startDrone();
  noiseBurst(0.45, 0.06, 0);
  const notes = [110, 147, 196, 247, 330, 392, 523, 659];
  notes.forEach((f, i) => beep(f, 0.16, "square", 0.045, 0.12 + i * 0.11));
  beep(82, 0.5, "sine", 0.05, 1.05);
  beep(164, 0.4, "triangle", 0.04, 1.15);
  noiseBurst(0.22, 0.04, 1.9);
  [523, 659, 784].forEach((f, i) => beep(f, 0.28, "square", 0.05, 2.1 + i * 0.08));
}

export const sfx = {
  tick: () => beep(920, 0.03, "square", 0.022),
  key: () => beep(420, 0.025, "square", 0.02),
  ok: () => {
    beep(520, 0.06);
    beep(780, 0.1, "square", 0.04, 0.05);
    beep(1040, 0.12, "triangle", 0.03, 0.12);
  },
  err: () => beep(140, 0.16, "sawtooth", 0.05),
  boot: () => playBootScore(),
  select: () => beep(1100, 0.045, "triangle", 0.032),
  pulse: () => beep(90, 0.08, "sine", 0.02),
  found: () => {
    beep(880, 0.05, "square", 0.03);
    beep(1320, 0.08, "triangle", 0.03, 0.05);
  },
};
