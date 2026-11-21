// All sound is synthesised with WebAudio — no audio files, so the game stays
// self-contained. A tiny synthwave loop (bass + pad chords) plays under the
// game, an engine hum follows the player's car, a two-tone siren swells with
// the nearest police car, and one-shot voices cover shots, hits and cash.
// Everything is guarded: with no AudioContext the game is simply silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenFlip = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, delay = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  // A slow I–VI–III–VII synthwave loop in A minor: soft pad chord + pulsing bass.
  const CHORDS = [
    [110.0, 220.0, 261.63, 329.63],
    [87.31, 174.61, 220.0, 261.63],
    [130.81, 261.63, 329.63, 392.0],
    [98.0, 196.0, 246.94, 293.66],
  ];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const chord = CHORDS[musicStep % CHORDS.length];
      musicStep += 1;
      for (let i = 1; i < chord.length; i += 1) tone(chord[i], 1.9, 'triangle', 0.028);
      tone(chord[0], 0.5, 'square', 0.05);
      tone(chord[0], 0.5, 'square', 0.04, null, 0.5);
      tone(chord[0] * 2, 0.4, 'square', 0.025, null, 1.0);
      tone(chord[0], 0.5, 'square', 0.04, null, 1.5);
    }, 2000);
  }

  return {
    unlock() {
      ensure();
    },
    shot() {
      noise(0.14, 0.5, 3200);
      tone(140, 0.1, 'square', 0.22, 45);
    },
    punch() {
      noise(0.08, 0.35, 700);
      tone(90, 0.09, 'sine', 0.3, 50);
    },
    cash() {
      tone(880, 0.09, 'square', 0.12);
      tone(1318, 0.14, 'square', 0.12, null, 0.07);
    },
    blip() {
      tone(660, 0.07, 'sine', 0.12);
    },
    phone() {
      tone(1046, 0.1, 'sine', 0.14);
      tone(1046, 0.1, 'sine', 0.14, null, 0.16);
    },
    missionPass() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, i) => tone(n, 0.22, 'triangle', 0.16, null, i * 0.09));
    },
    missionFail() {
      tone(392, 0.25, 'sawtooth', 0.1, 380);
      tone(311, 0.4, 'sawtooth', 0.1, 290, 0.18);
    },
    sting() {
      tone(233, 0.5, 'sawtooth', 0.14, 220);
      tone(220, 0.6, 'sawtooth', 0.14, 200, 0.3);
    },
    crash(strength) {
      noise(0.2, Math.min(0.6, 0.2 + strength * 0.05), 900);
    },
    door() {
      tone(180, 0.08, 'square', 0.15, 120);
      noise(0.05, 0.12, 1200);
    },
    /** Engine hum while driving; speed in [0, 1]. Call with null to stop. */
    engine(speed) {
      if (!ensure()) return;
      if (speed === null) {
        if (engineOsc) {
          engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          const osc = engineOsc;
          window.setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 300);
          engineOsc = null;
        }
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter).connect(engineGain).connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(55 + speed * 165, ctx.currentTime, 0.06);
      engineGain.gain.setTargetAtTime(0.05 + speed * 0.05, ctx.currentTime, 0.1);
    },
    /** Siren loudness follows the nearest police car; 0 silences it. */
    siren(level) {
      if (!ctx) return;
      if (level <= 0.01) {
        if (sirenOsc) {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          const osc = sirenOsc;
          window.clearInterval(sirenFlip);
          window.setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 300);
          sirenOsc = null;
        }
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 720;
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(master);
        sirenOsc.start();
        let high = false;
        sirenFlip = window.setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 950 : 700, ctx.currentTime, 0.05);
        }, 420);
      }
      sirenGain.gain.setTargetAtTime(0.028 * level, ctx.currentTime, 0.15);
    },
  };
}
