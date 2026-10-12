/*
 * eggyyy · 音效
 * 全部用 WebAudio 现场合成，不下载任何音频文件，也就不依赖外部资源。
 * 浏览器要求必须先有一次用户交互才能出声，所以第一次点击时才创建 AudioContext。
 */
window.sfx = (() => {
  "use strict";

  let ac = null;
  let master = null;
  let muted = false;

  function unlock() {
    try {
      if (!ac) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        ac = new Ctx();
        master = ac.createGain();
        master.gain.value = 0.9;
        master.connect(ac.destination);
      }
      if (ac.state === "suspended") ac.resume();
      return true;
    } catch (err) {
      return false;
    }
  }

  function ready() {
    return ac && master && !muted && ac.state !== "closed";
  }

  function noiseSource(dur) {
    const n = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    return src;
  }

  function tone(type, from, to, dur, gain, delay = 0) {
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, freq, q, gain, delay = 0) {
    const t = ac.currentTime + delay;
    const src = noiseSource(dur);
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const api = {
    unlock,
    get muted() {
      return muted;
    },
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.9;
    },
    // 敲壳
    crack() {
      if (!ready()) return;
      noise(0.07, 2400, 0.8, 0.5);
      tone("square", 900, 320, 0.06, 0.16);
    },
    // 蛋液落锅
    drop() {
      if (!ready()) return;
      noise(0.06, 700, 0.7, 0.24);
      tone("sine", 240, 70, 0.22, 0.28);
    },
    // 坏蛋
    bad() {
      if (!ready()) return;
      tone("sawtooth", 180, 60, 0.34, 0.16);
      noise(0.16, 300, 0.6, 0.18);
    },
    // 油锅
    sizzle() {
      if (!ready()) return;
      const t = ac.currentTime;
      const src = noiseSource(1.5);
      const f = ac.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 2600;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.18);
      g.gain.linearRampToValueAtTime(0.05, t + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + 1.6);
    },
    // 翻勺
    stir() {
      if (!ready()) return;
      noise(0.12, 1800, 1.2, 0.2);
      noise(0.12, 1200, 1.2, 0.18, 0.16);
      tone("triangle", 520, 300, 0.16, 0.07);
    },
    // 打蛋：一串快速的刮擦
    whisk() {
      if (!ready()) return;
      for (let i = 0; i < 7; i += 1) {
        noise(0.08, 1300 + i * 130, 1.1, 0.15, i * 0.085);
      }
      tone("triangle", 300, 520, 0.5, 0.045);
    },
    // 把蛋液倒进锅里
    pour() {
      if (!ready()) return;
      const t = ac.currentTime;
      const src = noiseSource(0.85);
      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(480, t);
      f.frequency.linearRampToValueAtTime(1500, t + 0.35);
      f.frequency.linearRampToValueAtTime(620, t + 0.8);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.17, t + 0.12);
      g.gain.linearRampToValueAtTime(0.1, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.86);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + 0.9);
      tone("sine", 330, 170, 0.7, 0.06);
    },
    // 刷碗：一阵水声
    wash() {
      if (!ready()) return;
      const t = ac.currentTime;
      const src = noiseSource(1.1);
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.setValueAtTime(900, t);
      f.frequency.linearRampToValueAtTime(2600, t + 0.5);
      f.frequency.linearRampToValueAtTime(700, t + 1.05);
      f.Q.value = 1.4;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.15);
      g.gain.linearRampToValueAtTime(0.1, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + 1.15);
      tone("sine", 420, 260, 0.9, 0.05);
    },
    // 印章
    stamp() {
      if (!ready()) return;
      tone("sine", 210, 55, 0.2, 0.34);
      noise(0.05, 900, 0.9, 0.16);
    },
    // 叽叽
    chirp() {
      if (!ready()) return;
      tone("triangle", 2100, 1700, 0.09, 0.16);
      tone("triangle", 2400, 1900, 0.09, 0.14, 0.13);
      tone("triangle", 2000, 1500, 0.1, 0.12, 0.3);
    },
    // 稀有
    sparkle() {
      if (!ready()) return;
      tone("sine", 700, 1500, 0.12, 0.12);
      tone("sine", 1100, 2100, 0.14, 0.1, 0.1);
    },
  };

  return api;
})();
