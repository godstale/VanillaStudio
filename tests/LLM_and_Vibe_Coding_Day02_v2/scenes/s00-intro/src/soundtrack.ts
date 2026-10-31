// Background music written as code (no generative AI, no external audio files): the whole 15 s track
// is rendered once with an OfflineAudioContext from a fixed seed, so it is identical on every run, and
// played from the clock's current time. Hits are placed from `timing.ts` so they land on the picture.
import { useEffect, useRef } from 'react';
import { mulberry32, useClock } from '@vanilla/runtime';
import { BAR, BEAT, CHECKS, DURATION, GEAR_START, GEAR_TEETH, SEND_PRESS, SHOT, TYPE_RATE, TYPE_START, TYPE_TOTAL, gearAngle } from './timing';

const SR = 44100;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// D – Bm – G – A – Em – D, one chord per shot.
const CHORDS = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 61, 62],
  [43, 50, 54, 57, 59],
  [45, 52, 57, 61, 64],
  [52, 55, 59, 62, 66],
  [50, 57, 62, 66, 69, 73],
] as const;
const ROOTS = [38, 35, 31, 33, 40, 38] as const;
const CUTOFF = [650, 850, 1050, 1350, 1750, 2400] as const;
const ARP = [0, 2, 4, 1, 3, 4, 2, 3] as const;

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const rand = mulberry32(seed);
  const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
  return buf;
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number, seed: number): AudioBuffer {
  const rand = mulberry32(seed);
  const len = Math.ceil(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

export function renderSoundtrack(): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(DURATION * SR), sampleRate: SR });
  const rand = mulberry32(2026);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(1, 0.08);
  master.gain.setValueAtTime(1, DURATION - 1.1);
  master.gain.linearRampToValueAtTime(0, DURATION);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.attack.value = 0.008;
  comp.release.value = 0.2;
  // Headroom: the title impact stacks kick, sub and crash.
  const out = ctx.createGain();
  out.gain.value = 0.75;
  master.connect(comp).connect(out).connect(ctx.destination);

  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 3, 2.6, 11);
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.3;
  verb.connect(verbOut).connect(master);

  const delay = ctx.createDelay(1);
  delay.delayTime.value = BEAT * 0.75;
  const delayTone = ctx.createBiquadFilter();
  delayTone.type = 'lowpass';
  delayTone.frequency.value = 2800;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.33;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.24;
  delay.connect(delayTone).connect(feedback).connect(delay);
  delayTone.connect(delayOut).connect(master);

  const noise = noiseBuffer(ctx, 2, 5);
  const send = (node: AudioNode, dry = 1, wet = 0, echo = 0) => {
    const d = ctx.createGain();
    d.gain.value = dry;
    node.connect(d).connect(master);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      node.connect(w).connect(verb);
    }
    if (echo > 0) {
      const e = ctx.createGain();
      e.gain.value = echo;
      node.connect(e).connect(delay);
    }
  };

  function noiseHit(t: number, len: number, type: BiquadFilterType, freq: number, q: number, gain: number, wet = 0, pan = 0) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p);
    send(p, 1, wet);
    src.start(t, rand() * 1.4);
    src.stop(t + len + 0.02);
  }

  function pad(t: number, notes: readonly number[], len: number, cutoff: number, level: number) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.35);
    g.gain.setValueAtTime(level, t + len - 0.15);
    g.gain.linearRampToValueAtTime(0, t + len + 0.9);
    lp.connect(g);
    send(g, 1, 0.8);
    for (const n of notes) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = detune;
        o.connect(lp);
        o.start(t);
        o.stop(t + len + 1);
      }
    }
  }

  function pluck(t: number, midi: number, gain: number, pan: number) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3600;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    for (const [type, mul, lvl] of [['triangle', 1, 1], ['sine', 2, 0.35]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi) * mul;
      const og = ctx.createGain();
      og.gain.value = lvl;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + 0.55);
    }
    lp.connect(g).connect(p);
    send(p, 1, 0.35, 0.8);
  }

  function bell(t: number, midi: number, gain: number, len = 1.8, pan = 0) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    for (const [mul, lvl, decay] of [[1, 1, len], [2.76, 0.28, len * 0.5], [5.4, 0.1, len * 0.25]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(midi) * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * lvl, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
    send(p, 1, 0.6, 0.4);
  }

  function bass(t: number, midi: number, len: number, gain: number) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    for (const type of ['sine', 'triangle'] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi);
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.05);
    }
    lp.connect(g);
    send(g);
  }

  function kick(t: number, gain: number, from = 130, to = 42, len = 0.4) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g);
    send(g);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  function whoosh(center: number, gain: number) {
    const t = center - 0.32;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3200, center);
    f.frequency.exponentialRampToValueAtTime(500, center + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, center);
    g.gain.exponentialRampToValueAtTime(0.0001, center + 0.32);
    src.connect(f).connect(g);
    send(g, 1, 0.4);
    src.start(t, rand() * 1.2);
    src.stop(center + 0.35);
  }

  // Harmony: pad every shot, bass from shot 2.
  CHORDS.forEach((notes, i) => {
    const t = SHOT[i];
    const last = i === CHORDS.length - 1;
    pad(t, notes, last ? DURATION - t : BAR, CUTOFF[i], last ? 0.03 : 0.022);
    if (i >= 1 && !last) {
      bass(t, ROOTS[i], BEAT * 1.4, 0.3);
      bass(t + BEAT * 1.5, ROOTS[i], BEAT * 1.2, 0.22);
      if (i >= 3) bass(t + BEAT * 3, ROOTS[i] + 12, BEAT * 0.8, 0.16);
    }
  });

  // Shot 1: spark chime, then a small rising motif while the prompt is written.
  bell(0.05, 81, 0.12, 2.2, -0.1);
  bell(0.09, 88, 0.05, 1.6, 0.2);
  [69, 73, 76, 78].forEach((m, i) => pluck(0.7 + i * 0.3125, m + 12, 0.07, i % 2 ? 0.3 : -0.3));
  pluck(SEND_PRESS, 81, 0.09, 0);
  bell(SEND_PRESS + 0.02, 93, 0.04, 0.8);

  // Shots 2–5: eighth-note arpeggio, drums building up.
  for (let bar = 1; bar <= 4; bar++) {
    const chord = CHORDS[bar];
    for (let k = 0; k < 8; k++) {
      const t = SHOT[bar] + k * (BEAT / 2);
      if (bar === 4 && k >= 6) break;
      pluck(t, chord[ARP[k] % chord.length] + 12, k % 2 ? 0.045 : 0.065, k % 2 ? 0.35 : -0.35);
    }
    for (let b = 0; b < 4; b++) {
      const t = SHOT[bar] + b * BEAT;
      if (bar === 4 && b >= 2) break;
      if (b % 2 === 0 || bar >= 3) kick(t, 0.5);
      if (bar >= 2) noiseHit(t + BEAT / 2, 0.05, 'highpass', 7500, 0.7, 0.05, 0, 0.25);
      if (bar >= 3 && b % 2 === 1) noiseHit(t, 0.14, 'bandpass', 1500, 0.8, 0.12, 0.5, -0.1);
    }
  }

  // Transition whooshes on every cut into the next shot.
  [SHOT[1], SHOT[2], SHOT[3], SHOT[4]].forEach((t) => whoosh(t, 0.09));

  // Shot 2: key clicks while the code types itself.
  for (let c = 0; c < TYPE_TOTAL; c += 2) {
    const t = SHOT[1] + TYPE_START + c / TYPE_RATE;
    noiseHit(t, 0.025, 'bandpass', 3200 + (c % 3) * 400, 1.2, 0.05, 0, ((c % 7) - 3) * 0.1);
  }

  // Shot 4: a ratchet tick on every tooth of the driving gear.
  const step = 360 / GEAR_TEETH[0];
  let lastTooth = 0;
  for (let t = GEAR_START; t < SHOT[4]; t += 1 / 400) {
    const tooth = Math.floor(gearAngle(t) / step);
    if (tooth > lastTooth) {
      lastTooth = tooth;
      noiseHit(t, 0.03, 'bandpass', 1900, 3, 0.05, 0.1, 0.15);
    }
  }

  // Shot 5: chimes for passing tests, a low buzz for the failure, scratch for the eraser.
  CHECKS.pass.forEach((u, i) => bell(SHOT[4] + u, [86, 88, 90, 93][i], 0.07, 0.9, i % 2 ? 0.25 : -0.25));
  {
    const t = SHOT[4] + CHECKS.fail;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 98;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(lp).connect(g);
    send(g);
    o.start(t);
    o.stop(t + 0.25);
  }
  for (let i = 0; i < 4; i++) noiseHit(SHOT[4] + CHECKS.erase + i * 0.05, 0.06, 'bandpass', 900, 1.5, 0.05);
  bell(SHOT[4] + CHECKS.done, 98, 0.05, 1.2);

  // Riser into the title, then the impact and a closing melody that resolves on D.
  {
    const t0 = SHOT[4] + BEAT * 2;
    const t1 = SHOT[5];
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t0);
    f.frequency.exponentialRampToValueAtTime(7000, t1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.13, t1 - 0.02);
    g.gain.linearRampToValueAtTime(0, t1);
    src.connect(f).connect(g);
    send(g, 1, 0.3);
    src.start(t0);
    src.stop(t1);
  }
  const hit = SHOT[5];
  kick(hit, 0.85, 110, 32, 1.1);
  bass(hit, 26, 2.2, 0.32);
  noiseHit(hit, 2.0, 'highpass', 2600, 0.6, 0.15, 0.9);
  bell(hit, 74, 0.09, 2.6, -0.2);
  bell(hit + 0.01, 81, 0.07, 2.6, 0.2);
  [[0.625, 78], [0.9375, 81], [1.25, 85], [1.5625, 86]].forEach(([dt, m], i) => bell(hit + dt, m, i === 3 ? 0.09 : 0.06, i === 3 ? 2.4 : 1.4, i % 2 ? 0.2 : -0.2));

  return ctx.startRendering();
}

let track: Promise<AudioBuffer> | null = null;
const getTrack = () => (track ??= renderSoundtrack());

/**
 * Play the track in step with the scene clock: start at the clock's time on play, stop on pause, and
 * restart from the new position after a seek. Silent while rendering frames for export.
 * Browsers may keep audio suspended until the user interacts with the page; the first click or key
 * press inside the scene unlocks it.
 */
export function useSoundtrack(enabled: boolean, volume: number): void {
  const clock = useClock();
  const gainRef = useRef<GainNode | null>(null);
  const volumeRef = useRef(volume);

  useEffect(() => {
    volumeRef.current = volume;
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    if (!enabled || clock.mode === 'render' || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = volumeRef.current;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    let buffer: AudioBuffer | null = null;
    let src: AudioBufferSourceNode | null = null;
    let anchorCtx = 0;
    let anchorT = 0;
    let disposed = false;

    const stop = () => {
      if (!src) return;
      try {
        src.stop();
      } catch {
        // already stopped
      }
      src.disconnect();
      src = null;
    };
    const start = () => {
      stop();
      if (!buffer || ctx.state !== 'running') return;
      const offset = clock.getTime();
      if (offset >= buffer.duration - 0.02) return;
      src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain);
      src.start(0, offset);
      anchorCtx = ctx.currentTime;
      anchorT = offset;
    };
    const sync = () => {
      if (disposed || !buffer) return;
      if (!clock.isPlaying()) return stop();
      if (ctx.state === 'suspended') {
        void ctx.resume();
        return;
      }
      if (!src) return start();
      const expected = anchorT + (ctx.currentTime - anchorCtx);
      if (Math.abs(expected - clock.getTime()) > 0.2) start();
    };
    const unlock = () => {
      if (ctx.state === 'suspended') void ctx.resume();
    };

    ctx.addEventListener('statechange', sync);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const offTime = clock.subscribe(sync);
    const offPlaying = clock.subscribePlaying(sync);
    getTrack()
      .then((b) => {
        buffer = b;
        sync();
      })
      .catch((e: unknown) => console.warn('[intro] soundtrack unavailable', e));

    return () => {
      disposed = true;
      stop();
      offTime();
      offPlaying();
      ctx.removeEventListener('statechange', sync);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      gainRef.current = null;
      void ctx.close();
    };
  }, [enabled, clock]);
}
