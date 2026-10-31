// Reel sound written as code (no samples, no generative AI): a small drum-machine/synth kit rendered
// once with an OfflineAudioContext from a fixed seed, then played from the scene clock's time so every
// hit lands on the frame it belongs to. 120 BPM, like the cut grid of the intro and the bumpers.
import { useEffect, useRef } from 'react';
import { mulberry32, useClock } from '@vanilla/runtime';

export const BPM = 120;
export const BEAT = 60 / BPM;
const SR = 44100;
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export interface Kit {
  kick(t: number, gain?: number): void;
  clap(t: number, gain?: number): void;
  hat(t: number, gain?: number, open?: boolean): void;
  click(t: number, gain?: number): void;
  blip(t: number, midi: number, gain?: number, len?: number): void;
  bass(t: number, midi: number, len: number, gain?: number): void;
  stab(t: number, chord: readonly number[], gain?: number): void;
  pad(t0: number, t1: number, chord: readonly number[], gain?: number): void;
  whoosh(t: number, len: number, up?: boolean, gain?: number): void;
  riser(t0: number, t1: number, gain?: number): void;
  impact(t: number, gain?: number): void;
}

function makeKit(ctx: OfflineAudioContext, out: AudioNode, verb: AudioNode, seed: number): Kit {
  const rand = mulberry32(seed);
  const noise = ctx.createBuffer(1, SR * 2, SR);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;

  const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  const noiseSrc = (t: number, len: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.start(t, rand() * 0.5, len);
    return s;
  };
  const send = (node: AudioNode, wet = 0) => {
    node.connect(out);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      node.connect(w).connect(verb);
    }
  };

  return {
    kick(t, gain = 1) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      const g = ctx.createGain();
      env(g, t, gain, 0.003, 0.4);
      o.connect(g);
      send(g);
      o.start(t);
      o.stop(t + 0.5);
    },
    clap(t, gain = 0.6) {
      for (let i = 0; i < 3; i++) {
        const s = noiseSrc(t + i * 0.011, 0.25);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1600;
        f.Q.value = 1.2;
        const g = ctx.createGain();
        env(g, t + i * 0.011, gain * (i === 2 ? 1 : 0.6), 0.002, i === 2 ? 0.2 : 0.02);
        s.connect(f).connect(g);
        send(g, 0.35);
      }
    },
    hat(t, gain = 0.18, open = false) {
      const s = noiseSrc(t, open ? 0.3 : 0.08);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7500;
      const g = ctx.createGain();
      env(g, t, gain, 0.001, open ? 0.22 : 0.045);
      s.connect(f).connect(g);
      send(g);
    },
    click(t, gain = 0.35) {
      const s = noiseSrc(t, 0.03);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 3000;
      const g = ctx.createGain();
      env(g, t, gain, 0.0005, 0.014);
      s.connect(f).connect(g);
      send(g, 0.15);
    },
    blip(t, midi, gain = 0.22, len = 0.25) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(midi);
      const g = ctx.createGain();
      env(g, t, gain, 0.004, len);
      o.connect(g);
      send(g, 0.4);
      o.start(t);
      o.stop(t + len + 0.05);
    },
    bass(t, midi, len, gain = 0.32) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(midi);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(180, t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.setValueAtTime(gain, t + len * 0.7);
      g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(f).connect(g);
      send(g);
      o.start(t);
      o.stop(t + len + 0.02);
    },
    stab(t, chord, gain = 0.1) {
      for (const m of chord) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = hz(m);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(3200, t);
        f.frequency.exponentialRampToValueAtTime(500, t + 0.25);
        const g = ctx.createGain();
        env(g, t, gain, 0.003, 0.3);
        o.connect(f).connect(g);
        send(g, 0.45);
        o.start(t);
        o.stop(t + 0.35);
      }
    },
    pad(t0, t1, chord, gain = 0.05) {
      for (const m of chord)
        for (const det of [-7, 7]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = hz(m);
          o.detune.value = det;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 1100;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(gain, t0 + 0.4);
          g.gain.setValueAtTime(gain, Math.max(t0 + 0.4, t1 - 0.6));
          g.gain.linearRampToValueAtTime(0, t1);
          o.connect(f).connect(g);
          send(g, 0.5);
          o.start(t0);
          o.stop(t1 + 0.05);
        }
    },
    whoosh(t, len, up = true, gain = 0.32) {
      const s = noiseSrc(t, len + 0.05);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 2.2;
      f.frequency.setValueAtTime(up ? 400 : 4200, t);
      f.frequency.exponentialRampToValueAtTime(up ? 4200 : 300, t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + len * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f).connect(g);
      send(g, 0.25);
    },
    riser(t0, t1, gain = 0.18) {
      const s = noiseSrc(t0, t1 - t0 + 0.05);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 4;
      f.frequency.setValueAtTime(300, t0);
      f.frequency.exponentialRampToValueAtTime(6000, t1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t1);
      g.gain.linearRampToValueAtTime(0, t1 + 0.03);
      s.connect(f).connect(g);
      send(g, 0.3);
    },
    impact(t, gain = 1) {
      this.kick(t, gain);
      const sub = ctx.createOscillator();
      sub.frequency.value = 48;
      const sg = ctx.createGain();
      env(sg, t, 0.5 * gain, 0.005, 1.1);
      sub.connect(sg);
      send(sg);
      sub.start(t);
      sub.stop(t + 1.2);
      const s = noiseSrc(t, 1.5);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(5000, t);
      f.frequency.exponentialRampToValueAtTime(400, t + 1.2);
      const g = ctx.createGain();
      env(g, t, 0.25 * gain, 0.002, 1.2);
      s.connect(f).connect(g);
      send(g, 0.5);
    },
  };
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

export function renderTrack(duration: number, seed: number, compose: (kit: Kit) => void): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(duration * SR), sampleRate: SR });
  const master = ctx.createGain();
  master.gain.setValueAtTime(1, 0);
  master.gain.setValueAtTime(1, Math.max(0, duration - 0.4));
  master.gain.linearRampToValueAtTime(0, duration);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.15;
  const out = ctx.createGain();
  out.gain.value = 0.8;
  master.connect(comp).connect(out).connect(ctx.destination);
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 1.8, 3, seed + 1);
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.35;
  verb.connect(verbOut).connect(master);
  compose(makeKit(ctx, master, verb, seed));
  return ctx.startRendering();
}

const cache = new Map<string, Promise<AudioBuffer>>();

/** Plays a rendered track in sync with the scene clock (seek, pause, scrub); silent while rendering frames. */
export function useTrack(key: string, render: () => Promise<AudioBuffer>, enabled: boolean, volume: number): void {
  const clock = useClock();
  const gainRef = useRef<GainNode | null>(null);
  const volumeRef = useRef(volume);
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    volumeRef.current = volume;
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => {
    if (!enabled || clock.mode === 'render' || typeof AudioContext === 'undefined' || typeof OfflineAudioContext === 'undefined') return;
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
    let track = cache.get(key);
    if (!track) {
      track = renderRef.current();
      cache.set(key, track);
    }
    track
      .then((b) => {
        buffer = b;
        sync();
      })
      .catch((e: unknown) => console.warn(`[reel] ${key} sound unavailable`, e));

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
  }, [enabled, clock, key]);
}
