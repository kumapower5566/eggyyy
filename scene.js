/*
 * eggyyy · 全流程
 * intro  一屏静态：空锅 + 三颗蛋 + 一句话 + 一个按钮
 * crack  打蛋：坏蛋不算数；三个是底线不是上限，稀有蛋只在贪心时出现
 * cook   下锅：番茄飞进来、放糖、翻炒
 * card   成品卡：长按就能存进相册
 */
(() => {
  "use strict";

  const INK = "46, 42, 38";
  const INK_SOFT = "107, 96, 85";
  const YOLK = "#f2b33d";
  const YOLK_DEEP = "#dc9722";
  const TOMATO_DEEP = "#a92d20";
  const FONT_TITLE = '"Smiley Sans", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif';
  const FONT_HAND = '"LXGW WenKai", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif';

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const el = {
    paper: document.getElementById("paper"),
    hint: document.getElementById("hint"),
    act: document.getElementById("act"),
    alt: document.getElementById("alt"),
    card: document.getElementById("card"),
    cardImg: document.getElementById("cardImg"),
    mute: document.getElementById("mute"),
    whisper: document.getElementById("whisper"),
    badge: document.getElementById("badge"),
  };

  /* ---------- 体验版：按固定顺序出蛋，方便逐个看效果（正式版不带这个就是真随机） ---------- */
  const DEMO_SEQ = {
    "1": [1, 2, 3, 4, 5],
    chick: [1, 1, 1, "chick"],
    bad: ["bad", 1, 1],
    five: ["chick", "chick", "chick", "chick", "chick"],
  };
  const DEMO_LABEL = {
    "1": "体验版 · 单双三四五黄",
    chick: "体验版 · 第 4 个必定小鸡",
    bad: "体验版 · 第 1 个是坏蛋",
    five: "体验版 · 每一颗都是小鸡",
  };
  let demoTemplate = null;
  let demoQueue = null;

  function setDemoMode(mode) {
    demoTemplate = DEMO_SEQ[mode] || null;
    demoQueue = demoTemplate ? demoTemplate.slice() : null;
    el.badge.textContent = DEMO_LABEL[mode] || "";
    el.badge.hidden = !demoTemplate;
    el.paper.classList.toggle("has-badge", !!demoTemplate);
  }

  /* ---------- 时钟与定时器 ---------- */

  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  const timers = [];
  function later(sec, fn) {
    timers.push({ at: now() + sec, fn });
  }
  function runTimers() {
    for (let i = timers.length - 1; i >= 0; i -= 1) {
      if (now() >= timers[i].at) {
        const fn = timers[i].fn;
        timers.splice(i, 1);
        fn();
      }
    }
  }

  /* ---------- 状态 ---------- */

  const S = {
    scene: "intro",
    row: [],
    pan: [],
    toms: [],
    parts: [],
    count: 0,
    cracks: 0, // 这一盆一共打掉了几个蛋（打出来的鸡也算一个）
    bestYolk: 0,
    chick: false,
    chicks: [],
    pleaded: false,
    sugar: null,
    cook: "",
    flames: 0,
    tilt: 0,
    anim: null,
    beat: false,
    beatStart: null,
    stage: 0, // 0 = 开场（锅在中间），1 = 打蛋（锅靠左、碗在右）
    bowl: [],
    pourStart: null,
    ruined: false,
    special: false,
  };

  const geo = { W: 0, H: 0, cx: 0, eggR: 0, eggY: 0, gap: 0, px: 0, py: 0, pr: 0, pa: -0.5, bx: 0, by: 0, br: 0, ba: 0 };

  /* ---------- 手感工具 ---------- */

  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function mixHex(a, b, t) {
    const ca = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const cb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    const m = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
    return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
  }

  // 手绘感的闭合形状：同一个 seed 永远画出同一条抖线
  function blob(g, cx, cy, rx, ry, seed, wob = 0) {
    const N = 26;
    g.beginPath();
    for (let i = 0; i <= N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      const jitter = 1 + (hash(seed + i * 3.17) - 0.5) * 0.05 + Math.sin(a * 3 + seed * 2) * 0.014;
      const w = 1 + wob * 0.05 * Math.sin(a * 4 + seed);
      const x = cx + Math.cos(a) * rx * jitter * w;
      const y = cy + Math.sin(a) * ry * jitter * w;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  }

  function roughRect(g, x, y, w, h, seed, amp = 2.2) {
    const per = 12;
    const pts = [];
    const j = (i) => (hash(seed + i * 1.7) - 0.5) * amp;
    for (let i = 0; i <= per; i += 1) pts.push([x + (w * i) / per, y + j(i)]);
    for (let i = 1; i <= per; i += 1) pts.push([x + w + j(i + 20), y + (h * i) / per]);
    for (let i = 1; i <= per; i += 1) pts.push([x + w - (w * i) / per, y + h + j(i + 40)]);
    for (let i = 1; i <= per; i += 1) pts.push([x + j(i + 60), y + h - (h * i) / per]);
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
  }

  let grainPat = null;
  function getGrain(g) {
    if (!grainPat) {
      const n = document.createElement("canvas");
      n.width = 128;
      n.height = 128;
      const ng = n.getContext("2d");
      const img = ng.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 110 + Math.random() * 130;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 30;
      }
      ng.putImageData(img, 0, 0);
      grainPat = g.createPattern(n, "repeat");
    }
    return grainPat;
  }

  /* ---------- 画东西 ---------- */

  function drawPan(g, cx, cy, R, angle = -0.5) {
    const line = Math.max(1.6, R * 0.028);

    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = `rgb(${INK})`;
    g.beginPath();
    g.ellipse(cx + R * 0.07, cy + R * 0.17, R, R * 0.97, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 手柄：向上斜伸，保证任何宽度下都不会被画布切掉
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    g.lineCap = "round";
    const hx0 = R * 0.78;
    const hx1 = R * 1.52;
    const hw = R * 0.19;
    g.beginPath();
    g.moveTo(hx0, 0);
    g.lineTo(hx1, 0);
    g.strokeStyle = `rgba(${INK}, 0.78)`;
    g.lineWidth = hw + line * 2;
    g.stroke();
    g.beginPath();
    g.moveTo(hx0, 0);
    g.lineTo(hx1, 0);
    g.strokeStyle = "#4a443c";
    g.lineWidth = hw;
    g.stroke();
    g.restore();

    const body = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    body.addColorStop(0, "#4b443b");
    body.addColorStop(0.55, "#3a352f");
    body.addColorStop(1, "#2b2724");
    blob(g, cx, cy, R, R, 1.7);
    g.fillStyle = body;
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.78)`;
    g.lineWidth = line * 1.35;
    g.lineJoin = "round";
    g.stroke();

    const face = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R * 0.9);
    face.addColorStop(0, "#584f44");
    face.addColorStop(0.6, "#413b34");
    face.addColorStop(1, "#302c27");
    blob(g, cx, cy, R * 0.83, R * 0.83, 5.3);
    g.fillStyle = face;
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.6)`;
    g.lineWidth = line * 0.9;
    g.stroke();

    g.save();
    blob(g, cx, cy, R * 0.83, R * 0.83, 5.3);
    g.clip();
    g.globalAlpha = 0.12;
    g.fillStyle = "#fff8e8";
    g.beginPath();
    g.ellipse(cx - R * 0.34, cy - R * 0.36, R * 0.5, R * 0.26, -0.7, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // 灶火：从锅沿下探头的一圈小火苗
  function drawFlames(g, cx, cy, R, t, amount) {
    if (amount <= 0.02) return;
    const n = 12;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      const flick = 0.6 + 0.4 * Math.sin(t * 9 + i * 2.3);
      const len = R * 0.17 * flick * amount;
      const w = R * 0.07;
      const bx = cx + Math.cos(a) * R * 1.02;
      const by = cy + Math.sin(a) * R * 1.02;
      g.save();
      g.translate(bx, by);
      g.rotate(a);
      g.globalAlpha = 0.85 * amount;
      g.beginPath();
      g.moveTo(0, -w);
      g.quadraticCurveTo(len * 1.25, 0, 0, w);
      g.quadraticCurveTo(len * 0.32, 0, 0, -w);
      g.closePath();
      g.fillStyle = i % 2 ? YOLK : "#ef8b2c";
      g.fill();
      g.restore();
    }
  }

  // 碗：蛋先在碗里打散，再倒进锅
  function drawBowl(g, cx, cy, r, alpha) {
    if (alpha <= 0.02) return;
    const line = Math.max(1.4, r * 0.055);
    g.save();
    g.globalAlpha = alpha;

    g.save();
    g.globalAlpha = alpha * 0.16;
    g.fillStyle = `rgb(${INK})`;
    g.beginPath();
    g.ellipse(cx + r * 0.06, cy + r * 0.16, r, r * 0.95, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    blob(g, cx, cy, r, r, 6.1);
    const body = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    body.addColorStop(0, "#fffdf7");
    body.addColorStop(1, "#e7d9bd");
    g.fillStyle = body;
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.72)`;
    g.lineWidth = line;
    g.lineJoin = "round";
    g.stroke();

    // 碗里
    blob(g, cx, cy, r * 0.79, r * 0.79, 9.4);
    const inner = g.createRadialGradient(cx - r * 0.22, cy - r * 0.26, r * 0.1, cx, cy, r * 0.92);
    inner.addColorStop(0, "#f5ecd8");
    inner.addColorStop(1, "#e0d0af");
    g.fillStyle = inner;
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.42)`;
    g.lineWidth = Math.max(1, r * 0.032);
    g.stroke();

    // 碗沿一圈红，跟整页的配色呼应
    blob(g, cx, cy, r * 0.9, r * 0.9, 6.1);
    g.strokeStyle = "rgba(210, 64, 47, 0.55)";
    g.lineWidth = Math.max(1.4, r * 0.05);
    g.stroke();

    g.restore();
  }

  function drawWholeEgg(g, x, y, r, seed, opts = {}) {
    const { tilt = 0, alpha = 1, crack = 0, scale = 1, dark = false } = opts;
    const rx = r * 0.79 * scale;
    const ry = r * scale;
    const line = Math.max(1.3, r * 0.1);
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(tilt);

    g.save();
    g.globalAlpha = 0.16 * alpha;
    g.fillStyle = `rgb(${INK})`;
    g.beginPath();
    g.ellipse(r * 0.08, ry * 0.9, rx * 0.94, ry * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    blob(g, 0, 0, rx, ry, seed);
    const shell = g.createLinearGradient(-rx, -ry, rx, ry);
    if (dark) {
      shell.addColorStop(0, "#8d866f");
      shell.addColorStop(1, "#5f5a4a");
    } else {
      shell.addColorStop(0, "#fffdf6");
      shell.addColorStop(1, "#efe4cd");
    }
    g.fillStyle = shell;
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.78)`;
    g.lineWidth = line;
    g.lineJoin = "round";
    g.stroke();

    // 没打之前就是一整颗壳，不能看见蛋黄
    g.save();
    g.beginPath();
    g.ellipse(-rx * 0.32, -ry * 0.34, rx * 0.3, ry * 0.19, -0.5, 0, Math.PI * 2);
    g.fillStyle = "rgba(255, 255, 255, 0.8)";
    g.fill();
    g.restore();
    if (!dark) {
      for (let i = 0; i < 4; i += 1) {
        const sx = (hash(seed + i * 7.7) - 0.5) * rx * 1.05;
        const sy = (hash(seed + i * 3.3 + 5.1) - 0.5) * ry * 1.25;
        g.beginPath();
        g.arc(sx, sy, Math.max(0.7, r * 0.028), 0, Math.PI * 2);
        g.fillStyle = "rgba(198, 178, 138, 0.45)";
        g.fill();
      }
    }

    if (crack > 0) {
      g.save();
      g.globalAlpha = Math.min(1, crack) * alpha;
      g.beginPath();
      const steps = 7;
      for (let i = 0; i <= steps; i += 1) {
        const px = -rx * 0.95 + (i / steps) * rx * 1.9;
        const py = Math.sin(i * 2.3 + seed) * ry * 0.14;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokeStyle = `rgba(${INK}, 0.92)`;
      g.lineWidth = line * 1.15;
      g.stroke();
      g.restore();
    }

    g.restore();
  }

  // yolks：这一个是几黄蛋（1~5）；yolkScale：1 = 完整的蛋，0 = 打散了的蛋液
  function drawLiquid(g, x, y, r, seed, yolks = 1, yolkScale = 1, dark = false) {
    const n = Math.max(1, Math.min(5, yolks));
    const rr = r * (1 + 0.12 * (n - 1));
    const t = 1 - yolkScale;
    g.save();
    blob(g, x, y, rr, rr * 0.94, seed);
    const grad = g.createRadialGradient(x - rr * 0.2, y - rr * 0.3, rr * 0.1, x, y, rr * 1.1);
    if (dark) {
      grad.addColorStop(0, "#948d6d");
      grad.addColorStop(1, "#4d4838");
    } else {
      grad.addColorStop(0, mixHex("#fffdf6", "#fff2c4", t));
      grad.addColorStop(1, mixHex("#eee2c6", "#f0c65c", t));
    }
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = dark ? `rgba(${INK}, 0.6)` : `rgba(${INK}, 0.24)`;
    g.lineWidth = Math.max(1, r * 0.06);
    g.stroke();

    if (!dark && yolkScale > 0.06) {
      for (let i = 0; i < n; i += 1) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / n) + 0.6;
        const d = n === 1 ? 0 : rr * 0.36;
        const yr = rr * (n === 1 ? 0.45 : 0.5 / Math.sqrt(n)) * yolkScale;
        const yx = x + Math.cos(a) * d;
        const yy = y + Math.sin(a) * d * 0.7 - (n === 1 ? rr * 0.04 : 0);
        blob(g, yx, yy, yr, yr * 0.96, seed + i * 3.1 + 9.1);
        const yg = g.createRadialGradient(yx - yr * 0.3, yy - yr * 0.4, yr * 0.1, yx, yy, yr * 1.1);
        yg.addColorStop(0, "#ffd574");
        yg.addColorStop(0.65, YOLK);
        yg.addColorStop(1, YOLK_DEEP);
        g.fillStyle = yg;
        g.fill();
      }
    }
    g.restore();
  }

  function drawTomato(g, x, y, r, seed, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    blob(g, 0, 0, r, r * 0.92, seed);
    const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    grad.addColorStop(0, "#e8563f");
    grad.addColorStop(1, TOMATO_DEEP);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.5)`;
    g.lineWidth = Math.max(1, r * 0.1);
    g.stroke();
    g.save();
    g.globalAlpha *= 0.85;
    g.beginPath();
    g.ellipse(r * 0.14, 0, r * 0.38, r * 0.32, 0, 0, Math.PI * 2);
    g.fillStyle = "#f2906f";
    g.fill();
    g.restore();
    g.restore();
  }

  // 切开的番茄块：扇形 + 浅色果肉
  function drawTomatoWedge(g, x, y, r, rot, seed) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const spread = 0.88 + hash(seed) * 0.24;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, r, -spread, spread);
    g.closePath();
    const grad = g.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, "#e8563f");
    grad.addColorStop(1, TOMATO_DEEP);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.5)`;
    g.lineWidth = Math.max(1, r * 0.12);
    g.lineJoin = "round";
    g.stroke();
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, r * 0.64, -spread * 0.8, spread * 0.8);
    g.closePath();
    g.fillStyle = "#f2906f";
    g.fill();
    g.restore();
  }

  // 小鸡：黄色一小团 + 两点眼睛 + 小嘴，别的什么都不要
  function drawChick(g, x, y, r, t) {
    const bob = Math.sin(t * 3) * r * 0.03;
    g.save();
    g.translate(x, y + bob);

    g.save();
    g.globalAlpha = 0.14;
    g.fillStyle = `rgb(${INK})`;
    g.beginPath();
    g.ellipse(r * 0.05, r * 0.9 - bob, r * 0.7, r * 0.13, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.strokeStyle = "#ef8b2c";
    g.lineWidth = Math.max(1.4, r * 0.08);
    g.lineCap = "round";
    [-1, 1].forEach((s) => {
      g.beginPath();
      g.moveTo(s * r * 0.2, r * 0.64);
      g.lineTo(s * r * 0.2, r * 0.85);
      g.stroke();
    });

    blob(g, 0, 0, r * 0.78, r * 0.74, 4.4);
    const body = g.createLinearGradient(-r, -r, r, r);
    body.addColorStop(0, "#ffdd7d");
    body.addColorStop(1, YOLK);
    g.fillStyle = body;
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.7)`;
    g.lineWidth = Math.max(1.3, r * 0.05);
    g.stroke();

    [-1, 1].forEach((s) => {
      g.beginPath();
      g.arc(s * r * 0.24, -r * 0.12, r * 0.085, 0, Math.PI * 2);
      g.fillStyle = `rgb(${INK})`;
      g.fill();
    });

    g.beginPath();
    g.moveTo(-r * 0.075, r * 0.05);
    g.lineTo(0, r * 0.16);
    g.lineTo(r * 0.075, r * 0.05);
    g.closePath();
    g.fillStyle = "#ef8b2c";
    g.fill();

    g.restore();
  }

  function drawPlate(g, cx, cy, R, portions, bestYolk) {
    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = `rgb(${INK})`;
    g.beginPath();
    g.ellipse(cx + R * 0.05, cy + R * 0.16, R, R * 0.94, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    blob(g, cx, cy, R, R, 3.3);
    g.fillStyle = "#fffdf6";
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.7)`;
    g.lineWidth = Math.max(2, R * 0.022);
    g.stroke();

    blob(g, cx, cy, R * 0.79, R * 0.79, 8.1);
    g.fillStyle = "#f7f1e3";
    g.fill();

    const n = Math.min(9, 3 + portions);
    for (let i = 0; i < n; i += 1) {
      const a = -Math.PI / 2 + i * 2.399 + 0.4;
      const d = i === 0 ? 0 : R * 0.34 * (0.72 + 0.28 * hash(i * 1.9));
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d * 0.82;
      const r = R * (0.28 + 0.07 * hash(i * 3.3));
      blob(g, x, y, r, r * 0.86, i * 5.5 + 1);
      const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.15);
      grad.addColorStop(0, "#ffe08a");
      grad.addColorStop(0.6, YOLK);
      grad.addColorStop(1, "#e09b28");
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = `rgba(${INK}, 0.28)`;
      g.lineWidth = Math.max(1, R * 0.012);
      g.stroke();
    }

    const toms = bestYolk >= 4 ? 5 : 4;
    for (let i = 0; i < toms; i += 1) {
      const a = -Math.PI / 2 + i * 1.9 + 1.1;
      const d = R * 0.42 * (0.6 + 0.4 * hash(i * 4.4));
      drawTomatoWedge(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, R * 0.17, a + 1.6, i * 6.1);
    }
    // 炒出来的那点红汁
    for (let i = 0; i < 3; i += 1) {
      const a = i * 2.1 + 0.7;
      const d = R * 0.5 * (0.45 + 0.4 * hash(i * 2.6));
      g.save();
      g.globalAlpha = 0.28;
      blob(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, R * 0.22, R * 0.15, i * 9.1);
      g.fillStyle = TOMATO_DEEP;
      g.fill();
      g.restore();
    }
  }

  function drawStamp(g, cx, cy, size, text, seed) {
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.13);
    g.globalAlpha = 0.92;
    g.strokeStyle = "#c0392b";
    g.lineWidth = size * 0.045;
    roughRect(g, -size / 2, -size / 2, size, size, seed, size * 0.025);
    g.stroke();
    g.lineWidth = size * 0.018;
    roughRect(g, -size / 2 + size * 0.07, -size / 2 + size * 0.07, size * 0.86, size * 0.86, seed + 5, size * 0.02);
    g.stroke();
    g.fillStyle = "#c0392b";
    const fs = size * (text.length > 3 ? 0.26 : text.length === 3 ? 0.3 : 0.36);
    g.font = `700 ${Math.round(fs)}px ${FONT_TITLE}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, size * 0.02);
    g.restore();
  }

  /* ---------- 布局与派生位置 ---------- */

  function layout() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geo.W = w;
    geo.H = h;
    geo.cx = w * 0.5;
    geo.eggR = Math.max(12, Math.min(w * 0.072, h * 0.06));
    geo.eggY = h * 0.87;
    geo.gap = Math.min(w * 0.23, h * 0.18);
  }

  // 开场：锅在正中间；打蛋：锅让到左边，碗从右边进来
  const PAN_INTRO = { x: 0.5, y: 0.42, rw: 0.32, rh: 0.3, a: -0.5 };
  const PAN_COOK = { x: 0.3, y: 0.4, rw: 0.19, rh: 0.22, a: -2.7 };
  const BOWL_INTRO = { x: 1.75, y: 0.42, rw: 0.2, rh: 0.22, a: 0 };
  const BOWL_COOK = { x: 0.72, y: 0.42, rw: 0.185, rh: 0.21, a: 1 };

  const lerp = (a, b, t) => a + (b - a) * t;

  function applyStage() {
    const s = S.stage;
    const e = s * s * (3 - 2 * s);
    geo.px = geo.W * lerp(PAN_INTRO.x, PAN_COOK.x, e);
    geo.py = geo.H * lerp(PAN_INTRO.y, PAN_COOK.y, e);
    geo.pr = Math.min(geo.W * lerp(PAN_INTRO.rw, PAN_COOK.rw, e), geo.H * lerp(PAN_INTRO.rh, PAN_COOK.rh, e));
    geo.pa = lerp(PAN_INTRO.a, PAN_COOK.a, e);
    geo.bx = geo.W * lerp(BOWL_INTRO.x, BOWL_COOK.x, e);
    geo.by = geo.H * lerp(BOWL_INTRO.y, BOWL_COOK.y, e);
    geo.br = Math.min(geo.W * lerp(BOWL_INTRO.rw, BOWL_COOK.rw, e), geo.H * lerp(BOWL_INTRO.rh, BOWL_COOK.rh, e));
    geo.ba = lerp(BOWL_INTRO.a, BOWL_COOK.a, e);
  }

  function rowTargetX(i, n) {
    return geo.cx + (i - (n - 1) / 2) * geo.gap;
  }

  // 黄金角螺旋排布，蛋液不会叠在一起
  function spiral(cx, cy, R, i, d0, d1) {
    const a = -Math.PI / 2 + i * 2.399 + 0.6;
    const d = R * (i === 0 ? d0 : d1);
    return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d };
  }

  function panSlot(i) {
    return spiral(geo.px, geo.py, geo.pr, i, 0.14, 0.34);
  }

  function bowlSlot(i) {
    return spiral(geo.bx, geo.by, geo.br, i, 0.12, 0.28);
  }

  // 搅打进度：0 = 还是完整的蛋，1 = 已经打散
  function beatProgress() {
    if (S.beatStart !== null) {
      const p = Math.min(1, (now() - S.beatStart) / 1);
      return p * p * (3 - 2 * p);
    }
    return S.beat ? 1 : 0;
  }

  function pourProgress() {
    if (S.pourStart === null) return S.pan.length ? 1 : 0;
    const p = Math.min(1, (now() - S.pourStart) / 0.7);
    return p * p * (3 - 2 * p);
  }

  // 碗里搅打的漩涡
  function bowlSwirl(i, beat) {
    const s = bowlSlot(i);
    const a = beat * 5.2;
    const dx = s.x - geo.bx;
    const dy = s.y - geo.by;
    const k = 1 - 0.5 * beat;
    return {
      x: geo.bx + (dx * Math.cos(a) - dy * Math.sin(a)) * k,
      y: geo.by + (dx * Math.sin(a) + dy * Math.cos(a)) * k,
    };
  }

  // 倒的时候那一道蛋液
  function drawStream(q) {
    const from = { x: geo.bx - geo.br * 0.55, y: geo.by + geo.br * 0.55 };
    const to = { x: geo.px, y: geo.py - geo.pr * 0.35 };
    const fade = Math.sin(Math.min(1, Math.max(0, q)) * Math.PI);
    ctx.save();
    ctx.globalAlpha = 0.9 * fade;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#f8ecc9";
    ctx.lineWidth = geo.br * 0.3;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo((from.x + to.x) / 2, from.y + geo.br * 0.45, to.x, to.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(220, 151, 34, 0.45)";
    ctx.lineWidth = geo.br * 0.12;
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 画一帧 ---------- */

  function draw() {
    const t = now();
    ctx.clearRect(0, 0, geo.W, geo.H);
    if (S.scene === "card") return;

    applyStage();
    const beat = beatProgress();
    const pour = pourProgress();

    drawFlames(ctx, geo.px, geo.py, geo.pr, t, S.flames);

    ctx.save();
    ctx.translate(geo.px, geo.py);
    ctx.rotate(S.tilt);
    ctx.translate(-geo.px, -geo.py);
    drawPan(ctx, geo.px, geo.py, geo.pr, geo.pa);
    S.pan.forEach((p, i) => {
      const s = panSlot(i);
      drawLiquid(ctx, s.x, s.y, geo.pr * 0.32, p.seed, p.yolks, 1 - beat);
    });

    S.toms.forEach((tm) => {
      const age = t - tm.start;
      if (age < 0) return;
      const p = Math.min(1, age / tm.dur);
      const e = p * p * (3 - 2 * p);
      if (p < 1) {
        const x = tm.from.x + (tm.to.x - tm.from.x) * e;
        const y = tm.from.y + (tm.to.y - tm.from.y) * e - Math.sin(e * Math.PI) * geo.pr * 0.55;
        drawTomato(ctx, x, y, geo.pr * (0.2 + 0.06 * e), tm.seed, (1 - e) * 2 + tm.rot);
        return;
      }
      // 落锅之后自己裂开、压碎，不用用户动手切
      const k = Math.min(1, (age - tm.dur) / 0.42);
      const spread = k * k * (3 - 2 * k);
      const jk = Math.min(1, (age - tm.dur) / 0.55);
      if (jk < 1) {
        ctx.save();
        ctx.globalAlpha = 0.32 * (1 - jk);
        blob(ctx, tm.to.x, tm.to.y, geo.pr * (0.15 + jk * 0.22), geo.pr * (0.12 + jk * 0.18), tm.seed + 2);
        ctx.fillStyle = TOMATO_DEEP;
        ctx.fill();
        ctx.restore();
      }
      for (let j = 0; j < 3; j += 1) {
        const a = tm.base + j * 2.1;
        const d = geo.pr * 0.11 + spread * geo.pr * 0.28;
        drawTomatoWedge(
          ctx,
          tm.to.x + Math.cos(a) * d,
          tm.to.y + Math.sin(a) * d * 0.85,
          geo.pr * 0.2,
          a + 1.6,
          tm.seed + j * 4.1
        );
      }
      if (jk < 1) {
        for (let j = 0; j < 5; j += 1) {
          const a = tm.base + j * 1.26 + 0.5;
          const d = geo.pr * (0.12 + jk * 0.4);
          ctx.save();
          ctx.globalAlpha = 0.9 * (1 - jk);
          ctx.beginPath();
          ctx.arc(
            tm.to.x + Math.cos(a) * d,
            tm.to.y + Math.sin(a) * d * 0.8,
            Math.max(1.2, geo.pr * 0.026),
            0,
            Math.PI * 2
          );
          ctx.fillStyle = TOMATO_DEEP;
          ctx.fill();
          ctx.restore();
        }
      }
    });
    ctx.restore();

    // 碗：蛋液在碗里打散，开火时倒进锅
    if (pour > 0 && pour < 1) drawStream(pour);
    drawBowl(ctx, geo.bx, geo.by, geo.br, geo.ba);
    if (!S.pan.length) {
      S.bowl.forEach((c, i) => {
        const a = bowlSwirl(i, beat);
        const b = panSlot(i);
        drawLiquid(
          ctx,
          lerp(a.x, b.x, pour),
          lerp(a.y, b.y, pour),
          lerp(geo.br * 0.34, geo.pr * 0.32, pour),
          c.seed,
          c.yolks,
          1 - beat,
          !!c.bad
        );
      });
      // 打坏蛋之后，整碗都废了
      if (S.ruined) {
        ctx.save();
        ctx.globalAlpha = 0.82;
        blob(ctx, geo.bx, geo.by, geo.br * 0.62, geo.br * 0.62, 21.7);
        const dg = ctx.createRadialGradient(
          geo.bx - geo.br * 0.2,
          geo.by - geo.br * 0.22,
          geo.br * 0.05,
          geo.bx,
          geo.by,
          geo.br * 0.68
        );
        dg.addColorStop(0, "#8f8a6c");
        dg.addColorStop(1, "#4b4638");
        ctx.fillStyle = dg;
        ctx.fill();
        ctx.strokeStyle = `rgba(${INK}, 0.55)`;
        ctx.lineWidth = Math.max(1.2, geo.br * 0.035);
        ctx.stroke();
        ctx.restore();
      }
    }

    const live = S.row.filter((e) => e.state !== "gone");
    live.forEach((e, i) => {
      const tx = rowTargetX(i, live.length);
      if (e.x === null) e.x = tx;
      e.x += (tx - e.x) * 0.16;
      e.y = geo.eggY;
    });
    S.row.forEach((e) => {
      if (e.state === "gone" || e.state === "cracking") return;
      drawWholeEgg(ctx, e.x, e.y, geo.eggR, e.seed, {
        scale: 1 + (reduced ? 0 : Math.sin(t * 1.25 + e.seed) * 0.012),
      });
    });

    // 打出来的小鸡仔，站在旁边看着你炒
    if (S.chicks.length) {
      const n = S.chicks.length;
      const gap = Math.min(geo.W * 0.18, geo.H * 0.12);
      const cr = Math.max(10, Math.min(geo.W * 0.075, geo.H * 0.055));
      S.chicks.forEach((c, i) => {
        drawChick(ctx, geo.cx + (i - (n - 1) / 2) * gap, geo.H * 0.72, cr, t + i * 0.7);
      });
    }

    if (S.anim) drawCrack(S.anim, t);
    drawParts(t);
  }

  function drawCrack(a, t) {
    const p = Math.min(1, (t - a.start) / a.dur);
    const lift = Math.sin(Math.min(1, p / 0.4) * Math.PI * 0.5) * geo.eggR * 0.6;
    const x = a.from.x;
    const y = a.from.y - lift;
    const to = bowlSlot(a.slot);

    if (p < 0.45) {
      drawWholeEgg(ctx, x, y, geo.eggR, a.egg.seed, {
        tilt: p * 0.5,
        crack: Math.max(0, (p - 0.14) / 0.3),
      });
      return;
    }

    const q = (p - 0.45) / 0.55;
    if (a.kind.kind === "chick") {
      if (q < 0.55) {
        drawWholeEgg(ctx, x, y, geo.eggR * (1 - q), a.egg.seed, { crack: 1, alpha: 1 - q * 1.6 });
      }
      const grow = Math.min(1, Math.max(0, (q - 0.15) / 0.5));
      drawChick(ctx, x, y - geo.eggR * 0.2, geo.eggR * (0.35 + grow * 1.35), t);
      return;
    }

    drawWholeEgg(ctx, x, y, geo.eggR * (1 - q * 0.86), a.egg.seed, {
      crack: 1,
      alpha: 1 - q,
      dark: a.kind.kind === "bad",
    });

    if (a.kind.kind !== "bad") {
      const tp = Math.min(1, Math.max(0, (p - 0.45) / 0.5));
      const e = tp * tp * (3 - 2 * tp);
      const fx = x + (to.x - x) * e;
      const fy = y + (to.y - y) * e - Math.sin(e * Math.PI) * geo.H * 0.14;
      drawLiquid(ctx, fx, fy, geo.br * 0.34 * (0.55 + 0.45 * e), a.egg.seed, a.kind.yolks);
      return;
    }
    // 坏蛋也打进碗里：一摊发黑的蛋液
    const tp = Math.min(1, Math.max(0, (p - 0.45) / 0.5));
    const e = tp * tp * (3 - 2 * tp);
    const fx = x + (to.x - x) * e;
    const fy = y + (to.y - y) * e - Math.sin(e * Math.PI) * geo.H * 0.14;
    drawLiquid(ctx, fx, fy, geo.br * 0.34 * (0.6 + 0.4 * e), a.egg.seed, 1, 1, true);
  }

  function drawParts(t) {
    for (let i = S.parts.length - 1; i >= 0; i -= 1) {
      const p = S.parts[i];
      const age = t - p.born;
      if (age > p.life) {
        S.parts.splice(i, 1);
        continue;
      }
      const x = p.x + p.vx * age;
      const y = p.y + p.vy * age + 900 * age * age * 0.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot + p.vr * age);
      ctx.globalAlpha = 1 - age / p.life;
      ctx.fillStyle = p.bad ? "#6f6a55" : "#fffaf0";
      ctx.strokeStyle = `rgba(${INK}, 0.6)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-p.size, -p.size * 0.6);
      ctx.lineTo(p.size, -p.size * 0.2);
      ctx.lineTo(-p.size * 0.2, p.size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- 流程 ---------- */

  function egg() {
    return { state: "idle", x: null, y: 0, seed: Math.random() * 100 };
  }

  function say(text) {
    el.hint.textContent = text;
  }

  function show(btn, text) {
    btn.textContent = text;
    btn.hidden = false;
    btn.disabled = false;
  }

  function hide(btn) {
    btn.hidden = true;
    btn.disabled = false;
  }

  function render() {
    const s = S.scene;
    el.paper.classList.toggle("is-card", s === "card");
    el.card.hidden = s !== "card";
    el.mute.textContent = sfx.muted ? "静" : "声";
    el.mute.setAttribute("aria-pressed", String(sfx.muted));
    el.whisper.textContent = "";

    if (s === "intro") {
      show(el.act, "打蛋");
      hide(el.alt);
      return;
    }

    if (s === "crack") {
      if (S.ruined) {
        show(el.act, "刷碗");
        hide(el.alt);
      } else if (S.anim) {
        el.act.disabled = true;
        hide(el.alt);
      } else if (S.beatStart !== null) {
        show(el.act, "搅开");
        el.act.disabled = true;
        hide(el.alt);
      } else if (S.count >= 3) {
        show(el.act, S.beat ? "开火" : "搅开");
        if (S.cracks < 5) show(el.alt, "再来一个");
        else hide(el.alt);
      } else {
        // 篮子空了但还没凑够三个，得再去拿一个（也得占掉五个的额度）
        const rowHasEgg = S.row.some((e) => e.state === "idle");
        show(el.act, rowHasEgg ? "敲开" : "再来一个");
        if (S.count >= 1) show(el.alt, S.pleaded ? "……好吧" : "就这样吧");
        else hide(el.alt);
      }
      el.whisper.textContent = !S.ruined && !S.anim && S.count >= 3 && S.cracks < 5 ? "（听说有人打出来过一只鸡）" : "";
      return;
    }

    if (s === "cook") {
      if (S.cook === "sugar") {
        show(el.act, "放糖");
        show(el.alt, "不放糖");
      } else if (S.cook === "ready") {
        show(el.act, "出锅");
        hide(el.alt);
      } else {
        hide(el.act);
        hide(el.alt);
      }
      return;
    }

    if (s === "card") {
      show(el.act, "再做一个");
      show(el.alt, "保存图片");
    }
  }

  function reset() {
    S.scene = "intro";
    S.row = [egg(), egg(), egg()];
    S.pan = [];
    S.toms = [];
    S.parts = [];
    S.count = 0;
    S.cracks = 0;
    S.bestYolk = 0;
    S.special = false;
    S.chick = false;
    S.chicks = [];
    S.pleaded = false;
    S.sugar = null;
    S.cook = "";
    S.flames = 0;
    S.tilt = 0;
    S.anim = null;
    S.beat = false;
    S.beatStart = null;
    S.stage = 0;
    S.bowl = [];
    S.pourStart = null;
    S.ruined = false;
    if (demoTemplate) demoQueue = demoTemplate.slice();
    timers.length = 0;
    el.cardImg.removeAttribute("src");
    say("");
    render();
  }

  const YOLK_NAME = ["", "", "双黄", "三黄", "四黄", "五黄"];

  // 前三个蛋：安全为主，偶尔来只小鸡仔或者双黄
  const TABLE_PLAIN = [
    { upTo: 0.06, kind: "chick", yolks: 1 },
    { upTo: 0.14, kind: "egg", yolks: 2 },
    { upTo: 0.24, kind: "bad", yolks: 1 },
    { upTo: 1, kind: "egg", yolks: 1 },
  ];

  // 小鸡仔不占你的蛋，它站到旁边看着你继续炒
  const CHICK_LINES = [
    "……小鸡。它蹲旁边看着。",
    "又一只。",
    "三只了。",
    "……四只。",
    "五只小鸡。今天不吃番茄炒蛋了。",
  ];
  // 贪心多打的蛋：黄的层数越往上越稀有，小鸡是另一个不在这条梯子上的结局
  const TABLE_GREEDY = [
    { upTo: 0.12, kind: "chick", yolks: 1 },
    { upTo: 0.14, kind: "egg", yolks: 5 },
    { upTo: 0.19, kind: "egg", yolks: 4 },
    { upTo: 0.3, kind: "egg", yolks: 3 },
    { upTo: 0.5, kind: "egg", yolks: 2 },
    { upTo: 0.58, kind: "bad", yolks: 1 },
    { upTo: 1, kind: "egg", yolks: 1 },
  ];
  // 第五个蛋的保底：前面都没出过特殊，这一个必定有黄
  const TABLE_JACKPOT = [
    { upTo: 0.55, kind: "egg", yolks: 2 },
    { upTo: 0.81, kind: "egg", yolks: 3 },
    { upTo: 0.95, kind: "egg", yolks: 4 },
    { upTo: 1, kind: "egg", yolks: 5 },
  ];

  // 小鸡保底：连抽几次都不出，下一次必出（localStorage 存不住就退回内存）
  const CHICK_PITY = 5;
  let memMiss = 0;
  function readMiss() {
    try {
      const v = Number(window.localStorage.getItem("eggyyy.chickMiss"));
      return Number.isFinite(v) ? v : memMiss;
    } catch (err) {
      return memMiss;
    }
  }
  function writeMiss(v) {
    memMiss = v;
    try {
      window.localStorage.setItem("eggyyy.chickMiss", String(v));
    } catch (err) {
      /* file:// 下可能不给用，内存里记着就行 */
    }
  }

  function pick(table) {
    const r = Math.random();
    for (let i = 0; i < table.length; i += 1) {
      if (r < table[i].upTo) return { kind: table[i].kind, yolks: table[i].yolks };
    }
    return { kind: "egg", yolks: 1 };
  }

  function rollKind() {
    if (demoQueue && demoQueue.length) {
      const v = demoQueue.shift();
      if (v === "chick") return { kind: "chick", yolks: 1 };
      if (v === "bad") return { kind: "bad", yolks: 1 };
      return { kind: "egg", yolks: v };
    }
    if (S.count < 3) return pick(TABLE_PLAIN);
    // 贪心阶段
    const miss = readMiss();
    if (miss >= CHICK_PITY - 1) {
      writeMiss(0);
      return { kind: "chick", yolks: 1 };
    }
    // 打到第五个蛋了，前面一个特殊的都没有：这一个必定有
    if (S.count >= 4 && S.count < 5 && !S.special) {
      writeMiss(miss + 1);
      return pick(TABLE_JACKPOT);
    }
    const res = pick(TABLE_GREEDY);
    writeMiss(res.kind === "chick" ? 0 : miss + 1);
    return res;
  }

  function startCrack() {
    if (S.anim) return;
    const live = S.row.filter((e) => e.state !== "gone");
    const target = live.find((e) => e.state === "idle");
    if (!target) return;
    const idx = live.indexOf(target);
    const fromX = target.x === null ? rowTargetX(idx, live.length) : target.x;
    target.state = "cracking";
    const kind = rollKind();
    S.anim = {
      kind,
      egg: target,
      from: { x: fromX, y: geo.eggY },
      slot: S.bowl.length,
      start: now(),
      dur: kind.kind === "chick" ? 1.3 : 0.62,
    };
    sfx.crack();
    render();
  }

  // 只看「这一个蛋」是什么，不能拿整局的累计状态来判断
  function phraseAfter(kind) {
    if (kind.yolks >= 2) return kind.yolks === 5 ? "……五黄蛋。" : `${YOLK_NAME[kind.yolks]}。`;
    if (S.count === 1) return "很好。";
    if (S.count === 2) return "还有一个。";
    if (S.count === 3) return "这就对了。";
    if (S.count === 4) return "……多打了一个。";
    return "五个了，够了。";
  }

  function spawnShards(x, y, r, bad) {
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      S.parts.push({
        x,
        y,
        vx: Math.cos(a) * r * (2 + Math.random() * 2.4),
        vy: Math.sin(a) * r * (2 + Math.random() * 2) - r * 1.1,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 10,
        life: 0.5 + Math.random() * 0.3,
        born: now(),
        bad,
        size: r * (0.12 + Math.random() * 0.16),
      });
    }
  }

  function finishCrack() {
    const a = S.anim;
    S.anim = null;
    a.egg.state = "gone";
    spawnShards(a.from.x, a.from.y, geo.eggR, a.kind.kind === "bad");
    S.cracks += 1; // 打掉一个就算一个，打出来的是鸡也算

    if (a.kind.kind === "bad") {
      S.ruined = true;
      S.bowl.push({ seed: Math.random() * 100, yolks: 1, bad: true });
      sfx.bad();
      say("啊哦，打出坏蛋。要刷碗重新打了。");
    } else if (a.kind.kind === "chick") {
      S.chicks.push({ seed: Math.random() * 100 });
      sfx.chirp();
      say(CHICK_LINES[Math.min(S.chicks.length, 5) - 1]);
    } else {
      S.count += 1;
      if (a.kind.yolks >= 2) {
        S.bestYolk = Math.max(S.bestYolk, a.kind.yolks);
        S.special = true;
        sfx.sparkle();
      } else {
        sfx.drop();
      }
      S.bowl.push({
        seed: Math.random() * 100,
        yolks: a.kind.yolks,
        bad: false,
      });
      // 又打进来一个生蛋，得重新搅
      S.beat = false;
      say(phraseAfter(a.kind));
    }
    S.pleaded = false;

    // 五个蛋打完了还没凑够三个好蛋：今天做不成了
    if (S.cracks >= 5 && S.count < 3 && !S.chick) {
      S.chick = true;
      say(S.chicks.length >= 5 ? "五只小鸡。今天不吃番茄炒蛋了。" : "蛋不够了。今天不吃番茄炒蛋了。");
      later(1, showCard);
    }
    render();
  }

  function startCook(line) {
    S.scene = "cook";
    S.cook = "pouring";
    S.pourStart = now();
    sfx.pour();
    say(line || "倒进锅里。");
    render();

    later(0.72, () => {
      // 蛋液倒进锅，碗空掉
      S.pan = S.bowl.map((c) => ({ seed: c.seed, yolks: c.yolks }));
      S.bowl = [];
      S.pourStart = null;
      S.cook = "flying";
      S.flames = 1;
      S.toms = [0, 1, 2].map((i) => {
        const a = -Math.PI / 2 + i * 2.1 + 0.9;
        return {
          start: now() + i * 0.15,
          dur: 0.5,
          seed: Math.random() * 100,
          rot: Math.random() * 3,
          base: -0.6 + i * 0.7,
          from: { x: geo.px + geo.pr * (1.3 + i * 0.2), y: geo.py + geo.pr * 1.4 },
          to: { x: geo.px + Math.cos(a) * geo.pr * 0.55, y: geo.py + Math.sin(a) * geo.pr * 0.55 },
        };
      });
      sfx.sizzle();
      say("番茄压碎出汁。");
      render();
      later(1.45, () => {
        S.cook = "sugar";
        say("放糖吗？");
        render();
      });
    });
  }

  // 打散蛋液：一次点击、一秒动画，不做小游戏
  function startBeat() {
    if (S.beatStart !== null || S.beat) return;
    S.beatStart = now();
    sfx.whisk();
    say("搅开。");
    render();
    later(1, () => {
      S.beat = true;
      S.beatStart = null;
      say("好了。");
      render();
    });
  }

  // 打出坏蛋：整碗作废，刷干净从头打
  function washBowl() {
    S.ruined = false;
    S.bowl = [];
    S.count = 0;
    S.cracks = 0;
    S.bestYolk = 0;
    S.special = false;
    S.beat = false;
    S.beatStart = null;
    S.row = [egg(), egg(), egg()];
    if (demoTemplate) demoQueue = demoTemplate.slice();
    sfx.wash();
    say("干净了。再来。");
    render();
  }

  function chooseSugar(v) {
    S.sugar = v;
    S.cook = "frying";
    sfx.stir();
    say(v ? "放了。" : "不放。");
    render();
    later(1.3, () => {
      S.cook = "ready";
      say("起锅。");
      render();
    });
  }

  function assessText() {
    if (S.chick) return S.chicks.length > 1 ? "它们不同意。" : "它不同意。";
    // 旁边站着鸡的时候，它们就一直在看着你（五只时改成不同意，见上）
    if (S.chicks.length === 1) return "它在旁边看着。";
    if (S.chicks.length > 1) return `${["", "", "两", "三", "四", "五"][S.chicks.length]}只都在看。`;
    if (S.bestYolk >= 2) return `最好的那颗是${YOLK_NAME[S.bestYolk]}。`;
    if (S.count <= 2) return "你很可疑。";
    if (S.count === 3) return "很正常。";
    if (S.count === 4) return "有点贪。";
    return "你是真的很饿。";
  }

  function stampText() {
    if (S.chick) return "今天不吃";
    if (S.chicks.length) return "围观";
    if (S.bestYolk >= 2) return YOLK_NAME[S.bestYolk];
    if (S.count <= 2) return "你很可疑";
    if (S.count >= 5) return "五蛋";
    return "正常";
  }

  function drawCard(g, W, H) {
    g.fillStyle = "#f2e4c7";
    g.fillRect(0, 0, W, H);
    g.save();
    g.globalAlpha = 0.45;
    g.fillStyle = getGrain(g);
    g.fillRect(0, 0, W, H);
    g.restore();

    const x = 54;
    const y = 54;
    const w = W - 108;
    const h = H - 108;

    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-0.011);
    g.translate(-W / 2, -H / 2);

    g.save();
    g.globalAlpha = 0.13;
    g.fillStyle = `rgb(${INK})`;
    g.fillRect(x + 10, y + 16, w, h);
    g.restore();

    roughRect(g, x, y, w, h, 21, 2.6);
    g.fillStyle = "#fffaf0";
    g.fill();
    g.strokeStyle = `rgba(${INK}, 0.45)`;
    g.lineWidth = 3;
    g.stroke();

    const left = x + 56;

    g.save();
    if ("letterSpacing" in g) g.letterSpacing = "6px";
    g.fillStyle = "#d2402f";
    g.font = `400 30px ${FONT_HAND}`;
    g.textAlign = "left";
    g.fillText("eggyyy", left, y + 96);
    g.restore();

    g.fillStyle = `rgb(${INK})`;
    g.font = `700 76px ${FONT_TITLE}`;
    g.textAlign = "left";
    g.fillText(S.chick ? "今天不吃" : "番茄炒蛋", left, y + 194);

    g.fillStyle = `rgba(${INK_SOFT}, 1)`;
    g.font = `400 26px ${FONT_HAND}`;
    g.fillText(S.chick ? `打出来 ${S.chicks.length} 只鸡，做不成了。` : "三个蛋起步。", left, y + 240);

    g.beginPath();
    g.moveTo(left, y + 268);
    for (let i = 1; i <= 24; i += 1) {
      g.lineTo(left + (i / 24) * (w - 112), y + 268 + (hash(i * 2.7) - 0.5) * 3);
    }
    g.strokeStyle = `rgba(${INK}, 0.35)`;
    g.lineWidth = 2;
    g.stroke();

    if (S.chick) {
      // 五只鸡排一排
      // 鸡多了就整体缩小，别叠在一起
      const n = Math.max(1, S.chicks.length);
      const cr = Math.min(116, (W - 200) / n / 2.6);
      const gap = cr * 2.6;
      S.chicks.forEach((c, i) => drawChick(g, W / 2 + (i - (n - 1) / 2) * gap, y + 640, cr, 0.6 + i));
    } else {
      drawPlate(g, W / 2, y + 600, 215, S.count, S.bestYolk);
    }

    // 炒菜这局打出来的小鸡仔，蹲在卡片底下
    if (!S.chick && S.chicks.length) {
      S.chicks.forEach((c, i) => drawChick(g, 150 + i * 92, y + 1088, 40, 0.4 + i));
    }

    g.fillStyle = `rgb(${INK})`;
    g.font = `400 34px ${FONT_HAND}`;
    g.textAlign = "left";
    g.fillText(`鸡蛋 ×${S.count}`, left, y + 910);
    g.fillText(S.sugar ? "糖 放了" : "糖 没放", left + 300, y + 910);

    g.fillStyle = `rgb(${INK})`;
    g.font = `400 32px ${FONT_HAND}`;
    g.fillText(`我的评价：${assessText()}`, left, y + 975);

    drawStamp(g, W - 220, y + 985, 165, stampText(), 31);

    g.fillStyle = `rgba(${INK_SOFT}, 1)`;
    g.font = `400 22px ${FONT_HAND}`;
    g.textAlign = "center";
    // 卡片上已经蹲着鸡了就不用再写那句传闻
    if (!S.chicks.length) g.fillText("（听说有人打出来过一只鸡）", W / 2, y + h - 34);

    g.restore();
  }

  function buildCard() {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 1200;
    drawCard(c.getContext("2d"), 900, 1200);
    return c.toDataURL("image/png");
  }

  function showCard() {
    S.scene = "card";
    el.cardImg.src = buildCard();
    sfx.stamp();
    render();
  }

  function saveImage() {
    const a = document.createElement("a");
    a.href = el.cardImg.src;
    a.download = "eggyyy.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- 交互 ---------- */

  el.act.addEventListener("click", () => {
    sfx.unlock();
    if (S.scene === "intro") {
      S.scene = "crack";
      say("先来三个。");
      render();
      return;
    }
    if (S.scene === "crack") {
      if (S.ruined) return washBowl();
      if (S.anim) return;
      if (S.count >= 3) return S.beat ? startCook() : startBeat();
      // 篮子空了但还没凑够三个：再去拿一个（照样占掉五个的额度）
      if (!S.row.some((e) => e.state === "idle")) {
        if (S.cracks >= 5) return undefined;
        S.row.push(egg());
      }
      if (S.pleaded) {
        S.pleaded = false;
        say("这就对了。");
        render();
      }
      return startCrack();
    }
    if (S.scene === "cook") {
      if (S.cook === "sugar") return chooseSugar(true);
      if (S.cook === "ready") return showCard();
      return;
    }
    if (S.scene === "card") return reset();
    return undefined;
  });

  el.alt.addEventListener("click", () => {
    sfx.unlock();
    if (S.scene === "crack") {
      if (S.count >= 3) {
        if (S.cracks >= 5) return;
        S.row.push(egg());
        return startCrack();
      }
      if (!S.pleaded) {
        S.pleaded = true;
        say("真的要吃三个吗？");
        render();
        return;
      }
      return startCook("……我知道。网上说两个也行。");
    }
    if (S.scene === "cook" && S.cook === "sugar") return chooseSugar(false);
    if (S.scene === "card") return saveImage();
    return undefined;
  });

  el.mute.addEventListener("click", () => {
    sfx.unlock();
    sfx.setMuted(!sfx.muted);
    render();
  });

  /* ---------- 主循环 ---------- */

  function loop() {
    runTimers();
    if (S.anim && now() - S.anim.start >= S.anim.dur) finishCrack();
    S.tilt = reduced || S.cook !== "frying" ? 0 : Math.sin(now() * 7) * 0.05;
    const stageTarget = S.scene === "intro" || S.scene === "card" ? 0 : 1;
    S.stage = reduced ? stageTarget : S.stage + (stageTarget - S.stage) * 0.13;
    draw();
    requestAnimationFrame(loop);
  }

  if ("ResizeObserver" in window) new ResizeObserver(layout).observe(canvas);
  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", layout);

  layout();
  const initialDemo =
    typeof window.EGGYYY_MODE === "string"
      ? window.EGGYYY_MODE
      : new URLSearchParams(window.location.search).get("demo") || "";
  setDemoMode(initialDemo);
  reset();
  loop();

  // 调试用的后门：不接任何界面，只在控制台里能把随机钉成固定顺序（"chick" 全小鸡 / "bad" 先坏蛋）
  window.eggyyyDebug = {
    setMode(mode) {
      setDemoMode(mode);
      reset();
    },
    // 只给验证用：把这一局算出来的文字吐出来，界面上看不到
    snapshot() {
      return {
        count: S.count,
        cracks: S.cracks,
        chicks: S.chicks.length,
        bestYolk: S.bestYolk,
        sugar: S.sugar,
        chickEnd: S.chick,
        assess: assessText(),
        stamp: stampText(),
      };
    },
  };
})();
