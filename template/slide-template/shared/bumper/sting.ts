// Bumper sting written as code (no generative AI, no audio files), same sound palette as the intro:
// rendered once per chapter with an OfflineAudioContext from a fixed seed and played from the clock's time.
// Each chapter takes the next chord of the intro progression, and the last chapter resolves on D.
import { useEffect, useRef } from 'react';
import { mulberry32, useClock } from '@vanilla/runtime';
import { BEAT, DOT, DURATION, EXIT, HIT, KICKER_RATE, KICKER_START, RAIL_SPARK } from './timing';

const SR = 44100;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// Indexed by chapter position (ch01…ch05): D – Bm – G – A – D.
const CHORDS = [
  [50, 57, 62, 66, 69],
  [47, 54, 57, 61, 62],
  [43, 50, 54, 57, 59],
  [45, 52, 57, 61, 64],
  [50, 57, 62, 66, 69, 73],
] as const;
const ROOTS = [38, 35, 31, 33, 38] as const;
const ARP = [0, 2, 4, 3] as const;

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

export function renderSting(chapterIndex: number, kickerLength: number): Promise<AudioBuffer> {
  const k = Math.max(0, Math.min(CHORDS.length - 1, chapterIndex));
  const chord = CHORDS[k];
  const root = ROOTS[k];
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(DURATION * SR), sampleRate: SR });
  const rand = mulberry32(2026 + k);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(1, 0.05);
  master.gain.setValueAtTime(1, DURATION - 0.5);
  master.gain.linearRampToValueAtTime(0, DURATION);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  const out = ctx.createGain();
  out.gain.value = 0.75;
  master.connect(comp).connect(out).connect(ctx.destination);

  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 2.5, 2.6, 11);
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.3;
  verb.connect(verbOut).connect(master);

  const delay = ctx.createDelay(1);
  delay.delayTime.value = BEAT * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.22;
  delay.connect(feedback).connect(delay);
  delay.connect(delayOut).connect(master);

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

  function pad(t: number, len: number, cutoff: number, level: number) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.3);
    g.gain.setValueAtTime(level, t + len - 0.6);
    g.gain.linearRampToValueAtTime(0, t + len);
    lp.connect(g);
    send(g, 1, 0.8);
    for (const n of chord) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = detune;
        o.connect(lp);
        o.start(t);
        o.stop(t + len + 0.05);
      }
    }
  }

  function pluck(t: number, midi: number, gain: number, pan: number) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    for (const [type, mul, lvl] of [['triangle', 1, 1], ['sine', 2, 0.35]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi) * mul;
      const og = ctx.createGain();
      og.gain.value = lvl;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 0.55);
    }
    g.connect(p);
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

  function whoosh(center: number, gain: number, up = true) {
    const t = center - 0.32;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(up ? 300 : 2400, t);
    f.frequency.exponentialRampToValueAtTime(up ? 3200 : 5200, center);
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

  // Spark chime and the ring drawing in.
  bell(0.04, chord[chord.length - 1] + 12, 0.11, 2.0, -0.15);
  bell(0.08, chord[2] + 24, 0.045, 1.4, 0.2);
  whoosh(0.42, 0.08);
  pad(0, DURATION, 1600, 0.024);

  // Kicker key clicks.
  for (let c = 0; c < kickerLength; c++) noiseHit(KICKER_START + c / KICKER_RATE, 0.025, 'bandpass', 3200 + (c % 3) * 400, 1.2, 0.05, 0, ((c % 5) - 2) * 0.12);

  // The number lands: impact, then a short rising arpeggio under the label.
  kick(HIT, 0.75, 110, 34, 0.9);
  bass(HIT, root, 2.0, 0.3);
  noiseHit(HIT, 1.2, 'highpass', 2600, 0.6, 0.1, 0.9);
  bell(HIT, chord[1] + 12, 0.07, 2.0, -0.2);
  for (let i = 0; i < 4; i++) pluck(HIT + BEAT * 0.5 * (i + 1), chord[ARP[i] % chord.length] + 12, i % 2 ? 0.05 : 0.065, i % 2 ? 0.3 : -0.3);
  bell(DOT, chord[chord.length - 1] + 12, 0.06, 1.2, 0.25);
  bell(RAIL_SPARK, chord[2] + 24, 0.05, 1.0, 0);

  // Zoom-through exit.
  whoosh(EXIT + 0.35, 0.1, false);

  return ctx.startRendering();
}

const tracks = new Map<string, Promise<AudioBuffer>>();
function getTrack(chapterIndex: number, kickerLength: number): Promise<AudioBuffer> {
  const key = `${chapterIndex}|${kickerLength}`;
  let track = tracks.get(key);
  if (!track) {
    track = renderSting(chapterIndex, kickerLength);
    tracks.set(key, track);
  }
  return track;
}

/**
 * Play the sting in step with the scene clock (same contract as the intro soundtrack): start at the
 * clock's time on play, stop on pause, restart after a seek, silent while rendering frames for export.
 */
export function useSting(chapterIndex: number, kickerLength: number, enabled: boolean, volume: number): void {
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
    getTrack(chapterIndex, kickerLength)
      .then((b) => {
        buffer = b;
        sync();
      })
      .catch((e: unknown) => console.warn('[bumper] sting unavailable', e));

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
  }, [enabled, clock, chapterIndex, kickerLength]);
}
