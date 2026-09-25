(() => {
  let ctx = null;
  let sfxMaster = null;
  let bgmMaster = null;
  let bgmGain = null;
  let enabled = true;
  let armed = false;

  try {
    enabled = localStorage.getItem("mtg-sfx") !== "0";
  } catch {
    enabled = true;
  }

  /* ------------------------------------------------------------------ */
  /* AudioContext & Master Gain Routing                                  */
  /* ------------------------------------------------------------------ */
  function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      if (!ctx) {
        ctx = new AC();

        // SFX Master Gain
        sfxMaster = ctx.createGain();
        sfxMaster.gain.value = 0.55;
        sfxMaster.connect(ctx.destination);

        // BGM Master Gain
        bgmMaster = ctx.createGain();
        bgmMaster.gain.value = 1.0;
        bgmMaster.connect(ctx.destination);

        // BGM Track Volume Gain
        bgmGain = ctx.createGain();
        bgmGain.gain.setValueAtTime(bgmVolume, ctx.currentTime);
        bgmGain.connect(bgmMaster);
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      armed = ctx.state === "running" || ctx.state === "suspended";

      // If BGM is enabled, kick off music scheduler
      if (armed && bgmEnabled && bgmTrack !== "off" && !bgmTimer) {
        startBgm();
      }
      return true;
    } catch {
      return false;
    }
  }

  function envGain(peak, dur, t, targetMaster = sfxMaster) {
    if (!ctx) return null;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(targetMaster || sfxMaster);
    return g;
  }

  function tone(freq, dur, type, peak, slide, targetMaster = sfxMaster) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    const eg = envGain(peak || 0.35, dur, t, targetMaster);
    if (!eg) return;
    o.connect(eg);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, peak, hp, targetMaster = sfxMaster) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = hp ? "highpass" : "lowpass";
    filter.frequency.value = hp || 900;
    src.connect(filter);
    const eg = envGain(peak || 0.2, dur, t, targetMaster);
    if (!eg) return;
    filter.connect(eg);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  const seq = (notes) => {
    notes.forEach(([freq, wait, dur, type, peak]) => {
      setTimeout(() => tone(freq, dur || 0.14, type || "triangle", peak || 0.28), wait);
    });
  };

  /* ------------------------------------------------------------------ */
  /* Whimsical Sound Effects Bank                                        */
  /* ------------------------------------------------------------------ */
  const bank = {
    start() {
      // Cheerful sparkling fan-fare chime
      seq([
        [523.25, 0, 0.2, "triangle", 0.38],
        [659.25, 75, 0.2, "triangle", 0.34],
        [783.99, 150, 0.3, "sine", 0.36],
        [1046.5, 230, 0.38, "sine", 0.32],
        [1318.5, 320, 0.45, "sine", 0.22],
      ]);
    },
    play() {
      // Magical spell cast with sparkling shimmer
      noise(0.06, 0.12, 2200);
      seq([
        [698.46, 0, 0.12, "triangle", 0.32],
        [880, 50, 0.14, "triangle", 0.3],
        [1046.5, 100, 0.22, "sine", 0.26],
        [1396.9, 160, 0.26, "sine", 0.2],
      ]);
    },
    land() {
      // Warm earthy thump with soft wooden resonance
      tone(196, 0.24, "sine", 0.42, 85);
      tone(392, 0.12, "triangle", 0.2, 160);
      noise(0.08, 0.1, 450);
    },
    tap() {
      // Light crystal-wood bell tap
      tone(1320, 0.08, "triangle", 0.25);
      tone(880, 0.1, "sine", 0.2);
    },
    mana() {
      // Delightful bubbling crystal chime
      seq([
        [784, 0, 0.11, "sine", 0.28],
        [988, 45, 0.12, "sine", 0.28],
        [1174, 90, 0.16, "triangle", 0.32],
        [1568, 140, 0.2, "sine", 0.22],
      ]);
    },
    draw() {
      // Gentle card slide + fairy chime
      noise(0.07, 0.12, 2400);
      tone(880, 0.12, "triangle", 0.24, 520);
    },
    attack() {
      // Whimsical battle dash
      noise(0.12, 0.18, 750);
      tone(330, 0.2, "sawtooth", 0.18, 170);
      tone(1100, 0.12, "triangle", 0.22);
    },
    bell() {
      // Warm golden bell-chime for unlocking treasure
      seq([
        [659.25, 0, 0.14, "sine", 0.32],
        [987.77, 90, 0.18, "sine", 0.34],
        [1318.51, 180, 0.3, "sine", 0.28],
      ]);
    },
    cast() {
      // Arcane whoosh + chime when hurling a spell
      noise(0.14, 0.14, 2600);
      seq([
        [587.33, 10, 0.1, "sawtooth", 0.16],
        [1174.66, 60, 0.16, "triangle", 0.26],
        [1760, 120, 0.24, "sine", 0.24],
      ]);
    },
    combat() {
      // Clang of blades colliding
      tone(220, 0.16, "sawtooth", 0.24, 120);
      noise(0.12, 0.2, 1400);
      tone(880, 0.08, "square", 0.12);
    },
    sparkle() {
      // Tiny ascending fairy sparkles
      seq([
        [1046.5, 0, 0.08, "sine", 0.22],
        [1318.51, 40, 0.08, "sine", 0.22],
        [1567.98, 80, 0.1, "sine", 0.22],
        [2093, 120, 0.18, "sine", 0.2],
      ]);
    },
    strike() {
      // Crisp melee thump with bright ping
      tone(330, 0.1, "square", 0.26, 300);
      noise(0.06, 0.18, 900);
      tone(1760, 0.06, "triangle", 0.14);
    },
    summon() {
      // Rising mystical swell for summons
      noise(0.18, 0.1, 1800);
      seq([
        [392, 0, 0.22, "sine", 0.24],
        [587.33, 90, 0.22, "sine", 0.26],
        [783.99, 180, 0.3, "triangle", 0.28],
      ]);
    },
    victory() {
      // Bright triumphant flourish
      seq([
        [523.25, 0, 0.14, "triangle", 0.32],
        [659.25, 80, 0.14, "triangle", 0.34],
        [783.99, 160, 0.16, "triangle", 0.36],
        [1046.5, 240, 0.4, "sine", 0.4],
      ]);
    },
    lifeUp() {
      // Sweet ascending fairy harp arpeggio
      seq([
        [523.25, 0, 0.14, "sine", 0.3],
        [659.25, 60, 0.14, "sine", 0.32],
        [783.99, 120, 0.18, "sine", 0.34],
        [1046.5, 180, 0.28, "sine", 0.3],
      ]);
    },
    lifeDown() {
      // Cute soft bonk / droplet thud
      tone(440, 0.08, "triangle", 0.25, 260);
      tone(260, 0.2, "sine", 0.32, 130);
    },
    turn() {
      // Melodic turn-bell chime
      seq([
        [587.33, 0, 0.16, "sine", 0.32],
        [739.99, 100, 0.18, "triangle", 0.32],
        [880, 200, 0.28, "sine", 0.3],
      ]);
    },
    shuffle() {
      // Whimsical deck riffling
      [0, 35, 70, 115, 160].forEach((w) => setTimeout(() => noise(0.045, 0.12, 1600), w));
    },
    mill() {
      tone(246.94, 0.16, "sine", 0.26, 120);
      noise(0.07, 0.1, 1000);
    },
    token() {
      // Cute bubbly pop! ✨
      tone(1174, 0.08, "sine", 0.32, 1760);
      tone(1760, 0.14, "triangle", 0.26);
    },
    roll() {
      // Wooden clatter + lucky chime
      [0, 32, 70].forEach((w) => setTimeout(() => noise(0.04, 0.16, 600), w));
      setTimeout(() => {
        tone(880, 0.12, "triangle", 0.26);
        setTimeout(() => tone(1318.5, 0.2, "sine", 0.28), 50);
      }, 100);
    },
    concede() {
      seq([
        [440, 0, 0.16, "sine", 0.26],
        [349.23, 90, 0.2, "sine", 0.26],
        [261.63, 190, 0.28, "sine", 0.28],
      ]);
    },
    coin() {
      // Golden coin shimmer
      seq([
        [1568, 0, 0.08, "sine", 0.35],
        [2093, 40, 0.12, "sine", 0.38],
        [2637, 90, 0.22, "sine", 0.3],
      ]);
    },
    win() {
      // Triumphant victory fanfare with sparkling chords
      seq([
        [523.25, 0, 0.16, "triangle", 0.35],
        [659.25, 90, 0.16, "triangle", 0.35],
        [783.99, 180, 0.18, "triangle", 0.38],
        [1046.5, 270, 0.35, "sine", 0.42],
        [1318.5, 380, 0.45, "sine", 0.38],
        [1567.98, 480, 0.65, "sine", 0.32],
      ]);
    },
    tick() {
      // Crisp subtle clock tick
      tone(1760, 0.035, "triangle", 0.18);
      noise(0.008, 0.02, 3500);
    },
    warningTick() {
      // Urgent resonant alert tick pip
      tone(1046.5, 0.065, "square", 0.22, 1318.5);
      noise(0.012, 0.025, 2800);
    },
    timeUp() {
      // Phase time-up warning chime buzzer
      seq([
        [440, 0, 0.14, "sawtooth", 0.25],
        [330, 80, 0.18, "sawtooth", 0.28],
        [220, 180, 0.35, "sine", 0.35],
      ]);
    },
  };

  function play(name) {
    if (!enabled) return;
    unlock();
    if (!ctx || !bank[name]) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      bank[name]();
    } catch {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ */
  /* Cute Typing Sounds Generator                                      */
  /* ------------------------------------------------------------------ */
  let lastTypeTime = 0;
  // Whimsical pentatonic palette for typing: G5, A5, B5, D6, E6, G6, A6
  const TYPE_NOTES = [783.99, 880, 987.77, 1174.66, 1318.51, 1567.98, 1760.0];

  function playTyping(key) {
    if (!enabled) return;
    unlock();
    if (!ctx) return;
    const nowMs = performance.now();
    if (nowMs - lastTypeTime < 32) return;
    lastTypeTime = nowMs;

    try {
      if (ctx.state === "suspended") ctx.resume();
      const t = ctx.currentTime;

      if (key === "Enter") {
        // Cheerful double sparkle ding
        tone(1318.51, 0.07, "triangle", 0.16);
        setTimeout(() => tone(1760.0, 0.12, "sine", 0.18), 35);
      } else if (key === "Backspace" || key === "Delete") {
        // Cute descending droplet
        tone(1174.66, 0.05, "sine", 0.14, 783.99);
      } else if (key === " ") {
        // Soft warm wooden spacebar tap
        tone(523.25, 0.05, "triangle", 0.14, 392);
        noise(0.018, 0.05, 1400);
      } else {
        // Whimsical fairy droplet typewriter click
        const note = TYPE_NOTES[Math.floor(Math.random() * TYPE_NOTES.length)];

        // Micro tactile parchment click
        noise(0.012, 0.035, 2600);

        // Sweet soft bell droplet
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.07, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.042);
        g.connect(sfxMaster);

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(note, t);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.05);
      }
    } catch {
      /* ignore */
    }
  }

  // Global listener for typing into inputs, textareas, and contenteditable fields
  document.addEventListener(
    "keydown",
    (e) => {
      const el = e.target;
      if (!el) return;
      const tag = el.tagName;
      const isField = tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
      if (!isField) return;

      // Ignore modifier keys alone
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const ignore = [
        "Shift",
        "Control",
        "Alt",
        "Meta",
        "CapsLock",
        "Tab",
        "Escape",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        "Insert",
      ];
      if (ignore.includes(e.key)) return;

      playTyping(e.key);
    },
    true
  );

  /* ------------------------------------------------------------------ */
  /* Procedural Whimsical Fantasy Background Music (BGM) Engine         */
  /* ------------------------------------------------------------------ */
  let bgmTrack = "fairy";
  let bgmVolume = 0.35;
  let bgmEnabled = true;
  let bgmTimer = null;
  let bgmStep = 0;
  let nextStepTime = 0;

  try {
    const savedTrack = localStorage.getItem("mtg-bgm-track");
    if (savedTrack) bgmTrack = savedTrack;
    const savedVol = localStorage.getItem("mtg-bgm-vol");
    if (savedVol != null) bgmVolume = Math.min(1, Math.max(0, parseFloat(savedVol)));
    bgmEnabled = localStorage.getItem("mtg-bgm-enabled") !== "0";
    if (bgmTrack === "off") bgmEnabled = false;
  } catch {
    bgmTrack = "fairy";
    bgmVolume = 0.35;
    bgmEnabled = true;
  }

  // Procedural Synth Helpers for BGM
  function playPadChord(freqs, duration, time, peak = 0.06) {
    if (!ctx || !bgmGain) return;
    freqs.forEach((freq, idx) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.002, time); // Subtle detune shimmer

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(650 + idx * 80, time);
      filter.Q.setValueAtTime(1.2, time);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(peak, time + 0.5);
      g.gain.setValueAtTime(peak * 0.8, time + Math.max(0.6, duration - 0.7));
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(g);
      g.connect(bgmGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.05);
      osc2.stop(time + duration + 0.05);
    });
  }

  function playPluckNote(freq, time, peak = 0.09, dur = 0.38, type = "triangle") {
    if (!ctx || !bgmGain) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(320, time + dur * 0.75);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(filter);
    filter.connect(g);
    g.connect(bgmGain);

    osc.start(time);
    osc.stop(time + dur + 0.04);
  }

  function playBellNote(freq, time, peak = 0.07, dur = 0.6) {
    if (!ctx || !bgmGain) return;
    // Fundamental
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(freq, time);

    // Sparkle harmonic
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(freq * 2.0, time);

    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, time);
    g1.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    g1.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, time);
    g2.gain.exponentialRampToValueAtTime(peak * 0.35, time + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.6);

    o1.connect(g1);
    o2.connect(g2);
    g1.connect(bgmGain);
    g2.connect(bgmGain);

    o1.start(time);
    o2.start(time);
    o1.stop(time + dur + 0.05);
    o2.stop(time + dur + 0.05);
  }

  function playSparkleSweep(freqs, time, interval = 0.04) {
    if (!ctx || !bgmGain) return;
    freqs.forEach((f, idx) => {
      playBellNote(f, time + idx * interval, 0.045, 0.35);
    });
  }

  /* Track Definitions */
  const BGM_TRACKS = {
    // 🌸 Fairy Glade: Enchanted forest with celesta arpeggios, gentle warm pads, and faerie chimes
    fairy: {
      name: "🌸 Fairy Glade",
      bpm: 84,
      totalSteps: 64, // 8 bars (8 steps per bar)
      step(step, t, stepDur) {
        const bar = Math.floor(step / 8);
        const beat = step % 8;

        // Ethereal Pad (Triggers on beat 0 of each bar)
        if (beat === 0) {
          const chords = [
            [155.56, 196.0, 233.08, 293.66, 349.23], // Bar 0: Ebmaj9 (Eb3, G3, Bb3, D4, F4)
            [130.81, 196.0, 233.08, 311.13],         // Bar 1: Cm7 (C3, G3, Bb3, Eb4)
            [103.83, 155.56, 196.0, 261.63],         // Bar 2: Abmaj7 (Ab2, Eb3, G3, C4)
            [116.54, 174.61, 233.08, 293.66, 349.23],// Bar 3: Bb9 (Bb2, F3, Bb3, D4, F4)
            [155.56, 196.0, 233.08, 293.66],         // Bar 4: Ebmaj7
            [98.0, 146.83, 220.0, 293.66],           // Bar 5: Gm7
            [87.31, 130.81, 174.61, 261.63],         // Bar 6: Fm7
            [116.54, 174.61, 233.08, 293.66],        // Bar 7: Bb7
          ];
          playPadChord(chords[bar % chords.length], stepDur * 7.8, t, 0.055);
        }

        // Bass Pluck on beat 0 and beat 4
        if (beat === 0 || beat === 4) {
          const bassNotes = [155.56, 130.81, 103.83, 116.54, 155.56, 98.0, 87.31, 116.54];
          playPluckNote(bassNotes[bar % bassNotes.length], t, 0.08, 0.5, "triangle");
        }

        // Whimsical Celesta / Harp Melody & Arpeggios
        const melody = {
          0: 622.25, 2: 783.99, 3: 932.33, 5: 1174.66, 6: 1046.5,
          8: 783.99, 10: 932.33, 12: 1244.51, 14: 1174.66,
          16: 1046.5, 18: 783.99, 20: 830.61, 22: 1046.5,
          24: 1174.66, 26: 932.33, 28: 1396.91, 30: 1567.98,
          32: 1244.51, 34: 1174.66, 36: 932.33, 38: 783.99,
          40: 987.77, 42: 1174.66, 44: 1479.98, 46: 1318.51,
          48: 1046.5, 50: 880.0, 52: 830.61, 54: 1046.5,
          56: 1174.66, 58: 932.33, 60: 1396.91, 62: 1244.51,
        };

        if (melody[step]) {
          playBellNote(melody[step], t, 0.06, 0.55);
        }

        // Faerie Chime Sweep at bar endings
        if (step === 31 || step === 63) {
          playSparkleSweep([1567.98, 1760.0, 2093.0, 2349.32, 2793.83], t + stepDur * 0.4);
        }
      },
    },

    // ✨ Starlight Cyberpop: Upbeat synthwave pulse, driving arpeggiated bass, lush saw chords, and cyber chimes
    cyberpop: {
      name: "✨ Starlight Cyberpop",
      bpm: 126,
      totalSteps: 64, // 8 bars
      step(step, t, stepDur) {
        const bar = Math.floor(step / 8);
        const beat = step % 8;

        // Cyber Synthwave Pad (Triggers every bar)
        if (beat === 0) {
          const chords = [
            [130.81, 196.0, 261.63, 329.63], // Cmaj7
            [146.83, 220.0, 293.66, 349.23], // Dm7
            [110.0, 164.81, 220.0, 261.63],  // Am7
            [174.61, 220.0, 261.63, 329.63], // Fmaj7
            [130.81, 196.0, 261.63, 392.0],  // C9
            [164.81, 220.0, 261.63, 329.63], // Em7
            [174.61, 220.0, 261.63, 349.23], // Fmaj7
            [196.0, 246.94, 293.66, 392.0],  // G
          ];
          playPadChord(chords[bar % chords.length], stepDur * 7.6, t, 0.055);
        }

        // Bouncy 16th Synth Bass Pluck
        const bassNotes = [65.41, 73.42, 55.0, 87.31, 65.41, 82.41, 87.31, 98.0];
        const baseRoot = bassNotes[bar % bassNotes.length];
        if (beat % 2 === 0) {
          playPluckNote(baseRoot, t, 0.08, 0.45, "sawtooth");
        } else if (beat === 5 || beat === 7) {
          playPluckNote(baseRoot * 2, t, 0.05, 0.35, "sawtooth");
        }

        // Neon Cyberpop Melody & Arpeggio Leads
        const melody = {
          0: 523.25, 2: 659.25, 4: 783.99, 6: 659.25,
          8: 587.33, 10: 659.25, 12: 880.0, 14: 783.99,
          16: 659.25, 18: 523.25, 20: 587.33, 22: 659.25,
          24: 698.46, 26: 783.99, 28: 880.0, 30: 1046.5,
          32: 1046.5, 34: 880.0, 36: 783.99, 38: 659.25,
          40: 659.25, 42: 783.99, 44: 880.0, 46: 1046.5,
          48: 880.0, 50: 783.99, 52: 659.25, 54: 587.33,
          56: 659.25, 58: 587.33, 60: 523.25, 62: 783.99,
        };

        if (melody[step]) {
          playBellNote(melody[step], t, 0.07, 0.48);
          // Neon synth echo
          playBellNote(melody[step] * 1.5, t + stepDur * 0.4, 0.02, 0.25);
        }

        // Cyber Snare / Hi-Hat Tick
        if (beat === 2 || beat === 6) {
          noise(0.025, 0.035, 1600, bgmGain);
        }

        if (step === 31 || step === 63) {
          playSparkleSweep([1046.5, 1318.51, 1567.98, 2093.0], t + stepDur * 0.4);
        }
      },
    },

    // ⚔️ 8-Bit Dungeon: Retro NES square-wave dungeon crawler RPG battle theme with fast chiptune arpeggios
    chiptune: {
      name: "⚔️ 8-Bit Dungeon",
      bpm: 118,
      totalSteps: 64, // 8 bars
      step(step, t, stepDur) {
        const bar = Math.floor(step / 8);
        const beat = step % 8;

        // Punchy 8-bit Bass (square wave)
        const bassLine = [
          110.0, 110.0, 130.81, 146.83, // Bar 0: Am
          98.0, 98.0, 110.0, 123.47,    // Bar 1: G
          87.31, 87.31, 98.0, 110.0,    // Bar 2: F
          82.41, 98.0, 110.0, 123.47,   // Bar 3: E
          110.0, 110.0, 130.81, 146.83, // Bar 4: Am
          130.81, 130.81, 146.83, 164.81,// Bar 5: C
          146.83, 146.83, 164.81, 174.61,// Bar 6: Dm
          164.81, 164.81, 196.0, 220.0, // Bar 7: Em
        ];
        const curBass = bassLine[Math.floor(step / 2) % bassLine.length];
        if (step % 2 === 0) {
          playPluckNote(curBass, t, 0.09, 0.4, "square");
        }

        // Rapid 8-bit Chiptune Arpeggiation on off-beats
        const arpChords = [
          [220.0, 261.63, 329.63, 440.0], // Am
          [196.0, 246.94, 293.66, 392.0], // G
          [174.61, 220.0, 261.63, 349.23],// F
          [164.81, 207.65, 246.94, 329.63],// E
        ];
        const chord = arpChords[bar % arpChords.length];
        const arpNote = chord[beat % 4];
        playBellNote(arpNote * 1.5, t, 0.035, 0.22);

        // Heroic 8-Bit Lead Adventure Melody
        const melody = {
          0: 440.0, 2: 523.25, 4: 659.25, 6: 587.33,
          8: 523.25, 10: 440.0, 12: 493.88, 14: 523.25,
          16: 349.23, 18: 440.0, 20: 523.25, 22: 493.88,
          24: 329.63, 26: 392.0, 28: 440.0, 30: 493.88,
          32: 659.25, 34: 587.33, 36: 659.25, 38: 783.99,
          40: 880.0, 42: 783.99, 44: 659.25, 46: 587.33,
          48: 523.25, 50: 659.25, 52: 587.33, 54: 523.25,
          56: 493.88, 58: 440.0, 60: 493.88, 62: 440.0,
        };

        if (melody[step]) {
          playPluckNote(melody[step], t, 0.08, 0.45, "square");
        }

        // 8-bit Noise Burst on beat 2 and 6
        if (beat === 2 || beat === 6) {
          noise(0.015, 0.03, 900, bgmGain);
        }
      },
    },

    // 🎀 Kawaii Dreamcore: Pastel lofi dreamscape with warm sub-bass, music-box bells, and cute ethereal chimes
    dreamcore: {
      name: "🎀 Kawaii Dreamcore",
      bpm: 88,
      totalSteps: 64, // 8 bars
      step(step, t, stepDur) {
        const bar = Math.floor(step / 8);
        const beat = step % 8;

        // Dreamy Warm Pad Chords
        if (beat === 0) {
          const chords = [
            [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
            [164.81, 196.0, 246.94, 293.66, 349.23],// Em9
            [146.83, 174.61, 220.0, 261.63, 329.63],// Dm9
            [130.81, 164.81, 196.0, 246.94, 293.66],// Cmaj9
            [174.61, 220.0, 261.63, 329.63],         // Fmaj7
            [196.0, 246.94, 293.66, 392.0],          // G7
            [164.81, 196.0, 246.94, 329.63],         // Em7
            [110.0, 164.81, 220.0, 261.63],          // Am7
          ];
          playPadChord(chords[bar % chords.length], stepDur * 7.8, t, 0.06);
        }

        // Gentle sub-bass plucks on beats 0 and 4
        if (beat === 0 || beat === 4) {
          const bass = [87.31, 82.41, 73.42, 65.41, 87.31, 98.0, 82.41, 55.0];
          playPluckNote(bass[bar % bass.length], t, 0.14, 0.38, "sine");
        }

        // Cute Celesta & Music Box Lead
        const melody = {
          0: 659.25, 2: 783.99, 4: 880.0, 6: 783.99,
          8: 659.25, 10: 587.33, 12: 659.25, 14: 783.99,
          16: 587.33, 18: 523.25, 20: 587.33, 22: 659.25,
          24: 523.25, 26: 440.0, 28: 493.88, 30: 523.25,
          32: 880.0, 34: 1046.5, 36: 987.77, 38: 880.0,
          40: 783.99, 42: 880.0, 44: 1046.5, 46: 1174.66,
          48: 987.77, 50: 880.0, 52: 783.99, 54: 659.25,
          56: 659.25, 58: 587.33, 60: 523.25, 62: 659.25,
        };

        if (melody[step]) {
          playBellNote(melody[step], t, 0.08, 0.42);
        }

        // Kawaii Sparkle Sweep at bar 4 and bar 8
        if (step === 31 || step === 63) {
          playSparkleSweep([1318.51, 1567.98, 1760.0, 2093.0, 2349.32], t + stepDur * 0.3, 0.05);
        }
      },
    },

    // 🏰 Castle Promenade: Regal courtly fantasy promenade with rich lute harps and noble majestic pads
    castle: {
      name: "🏰 Castle Promenade",
      bpm: 108,
      totalSteps: 64, // 8 bars
      step(step, t, stepDur) {
        const bar = Math.floor(step / 8);
        const beat = step % 8;

        // Regal Courtly Horn / Organ Pad
        if (beat === 0) {
          const chords = [
            [146.83, 220.0, 293.66, 369.99], // D
            [164.81, 246.94, 329.63, 392.0],  // Em
            [185.0, 277.18, 369.99, 440.0],   // F#m
            [196.0, 246.94, 293.66, 392.0],   // G
            [220.0, 277.18, 329.63, 440.0],   // A
            [185.0, 220.0, 293.66, 369.99],   // Bm
            [196.0, 246.94, 293.66, 392.0],   // G
            [146.83, 220.0, 293.66, 440.0],   // Dsus4 -> D
          ];
          playPadChord(chords[bar % chords.length], stepDur * 7.7, t, 0.06);
        }

        // Plucked Court Lute Bass
        if (beat === 0 || beat === 4) {
          const bass = [146.83, 164.81, 185.0, 196.0, 220.0, 123.47, 98.0, 146.83];
          playPluckNote(bass[bar % bass.length], t, 0.12, 0.4, "triangle");
        }

        // Lute strum on beats 2 and 6
        if (beat === 2 || beat === 6) {
          const strums = [
            [293.66, 369.99, 440.0], // D
            [329.63, 392.0, 493.88], // Em
            [369.99, 440.0, 554.37], // F#m
            [293.66, 392.0, 493.88], // G
            [329.63, 440.0, 554.37], // A
            [293.66, 369.99, 440.0], // Bm
            [293.66, 392.0, 493.88], // G
            [293.66, 369.99, 440.0], // D
          ];
          const strum = strums[bar % strums.length];
          strum.forEach((f, idx) => playPluckNote(f, t + idx * 0.02, 0.06, 0.28, "triangle"));
        }

        // Noble Royal Melody
        const melody = {
          0: 587.33, 2: 739.99, 4: 880.0, 6: 739.99,
          8: 659.25, 10: 739.99, 12: 880.0, 14: 987.77,
          16: 880.0, 18: 739.99, 20: 880.0, 22: 1108.73,
          24: 987.77, 26: 880.0, 28: 739.99, 30: 659.25,
          32: 880.0, 34: 987.77, 36: 1108.73, 38: 1174.66,
          40: 1108.73, 42: 987.77, 44: 880.0, 46: 739.99,
          48: 783.99, 50: 880.0, 52: 739.99, 54: 659.25,
          56: 587.33, 58: 739.99, 60: 659.25, 62: 587.33,
        };

        if (melody[step]) {
          playBellNote(melody[step], t, 0.08, 0.46);
        }
      },
    },

    // 🍄 Sylvan Meadow: Cheerful music-box waltz with playful woodsy chimes and warm pastoral vibes
    meadow: {
      name: "🍄 Sylvan Meadow",
      bpm: 112,
      totalSteps: 32, // 4 bars
      step(step, t, stepDur) {
        const bar = Math.floor(step / 8);
        const beat = step % 8;

        // Bouncy Pizzicato Bass
        if (beat === 0 || beat === 4) {
          const bass = [98.0, 82.41, 130.81, 146.83];
          playPluckNote(bass[bar % bass.length], t, 0.1, 0.35, "triangle");
        }

        // Music Box Chords (beats 2 & 6)
        if (beat === 2 || beat === 6) {
          const chords = [
            [246.94, 293.66, 392.0], // G
            [196.0, 246.94, 329.63],  // Em
            [261.63, 329.63, 392.0], // C
            [220.0, 293.66, 369.99], // D
          ];
          chords[bar % chords.length].forEach((f) => playBellNote(f, t, 0.035, 0.28));
        }

        // Lilting Music Box Melody
        const melody = {
          0: 392.0, 1: 493.88, 3: 587.33, 5: 783.99, 6: 587.33,
          8: 659.25, 10: 493.88, 12: 392.0, 14: 493.88,
          16: 523.25, 18: 659.25, 20: 783.99, 22: 659.25,
          24: 587.33, 26: 739.99, 28: 880.0, 30: 739.99,
        };

        if (melody[step]) {
          playBellNote(melody[step], t, 0.08, 0.45);
        }

        if (step === 31) {
          playSparkleSweep([1174.66, 1318.51, 1567.98, 1760.0], t + stepDur * 0.5);
        }
      },
    },
  };

  function bgmTick() {
    if (!ctx || !bgmEnabled || bgmTrack === "off") return;
    const track = BGM_TRACKS[bgmTrack];
    if (!track) return;

    const stepDur = 60 / track.bpm / 2; // 8th note
    const lookAhead = 0.28;

    while (nextStepTime < ctx.currentTime + lookAhead) {
      const step = bgmStep % track.totalSteps;
      try {
        track.step(step, nextStepTime, stepDur);
      } catch {
        /* ignore step error */
      }
      bgmStep++;
      nextStepTime += stepDur;
    }
  }

  function startBgm() {
    if (bgmTimer) return;
    if (!ctx) unlock();
    if (!ctx || !bgmEnabled || bgmTrack === "off") return;

    if (ctx.state === "suspended") ctx.resume();
    bgmStep = 0;
    nextStepTime = ctx.currentTime + 0.05;

    // Smooth fade in
    if (bgmGain) {
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      bgmGain.gain.linearRampToValueAtTime(bgmVolume, ctx.currentTime + 0.35);
    }

    bgmTimer = setInterval(bgmTick, 90);
    notifyBgmListeners();
  }

  function stopBgm(fadeOut = 0.25) {
    if (!bgmTimer && (!bgmGain || bgmGain.gain.value === 0)) return;
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (ctx && bgmGain) {
      try {
        bgmGain.gain.cancelScheduledValues(ctx.currentTime);
        bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime);
        bgmGain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeOut);
      } catch {
        bgmGain.gain.value = 0;
      }
    }
    notifyBgmListeners();
  }

  const bgmListeners = new Set();
  function notifyBgmListeners() {
    bgmListeners.forEach((fn) => {
      try {
        fn({
          track: bgmTrack,
          volume: bgmVolume,
          enabled: bgmEnabled && bgmTrack !== "off",
          playing: !!bgmTimer,
          name: BGM_TRACKS[bgmTrack]?.name || "Music Off",
        });
      } catch {}
    });
  }

  function setBgmTrack(name) {
    if (name === "off") {
      bgmTrack = "off";
      bgmEnabled = false;
      stopBgm(0.2);
    } else if (BGM_TRACKS[name]) {
      const wasPlaying = !!bgmTimer;
      bgmTrack = name;
      bgmEnabled = true;
      if (wasPlaying) {
        stopBgm(0.15);
        setTimeout(() => startBgm(), 160);
      } else if (armed) {
        startBgm();
      }
    }
    try {
      localStorage.setItem("mtg-bgm-track", bgmTrack);
      localStorage.setItem("mtg-bgm-enabled", bgmEnabled ? "1" : "0");
    } catch {}
    notifyBgmListeners();
  }

  function setBgmVolume(val) {
    bgmVolume = Math.max(0, Math.min(1, val));
    if (ctx && bgmGain && bgmTimer) {
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.setValueAtTime(bgmGain.gain.value, ctx.currentTime);
      bgmGain.linearRampToValueAtTime(bgmVolume, ctx.currentTime + 0.05);
    }
    try {
      localStorage.setItem("mtg-bgm-vol", String(bgmVolume));
    } catch {}
    notifyBgmListeners();
  }

  function toggleBgm() {
    unlock();
    if (bgmTimer) {
      stopBgm();
    } else {
      if (bgmTrack === "off") {
        setBgmTrack("fairy");
      } else {
        bgmEnabled = true;
        startBgm();
      }
    }
    notifyBgmListeners();
  }

  function onGesture() {
    const first = !ctx;
    unlock();
    if (first && enabled) play("start");
    if (first && bgmEnabled && bgmTrack !== "off" && !bgmTimer) {
      startBgm();
    }
  }

  ["pointerdown", "keydown", "touchstart", "click"].forEach((ev) => {
    document.addEventListener(ev, onGesture, { capture: true, passive: true });
  });

  /* ------------------------------------------------------------------ */
  /* Public Exports                                                     */
  /* ------------------------------------------------------------------ */
  window.MTG_SFX = {
    play,
    unlock,
    type: playTyping,
    get enabled() {
      return enabled;
    },
    get armed() {
      return !!(ctx && ctx.state === "running");
    },
    setEnabled(on) {
      enabled = !!on;
      try {
        localStorage.setItem("mtg-sfx", enabled ? "1" : "0");
      } catch {}
      if (enabled) {
        unlock();
        play("start");
      }
    },
  };

  window.MTG_BGM = {
    unlock,
    get track() {
      return bgmTrack;
    },
    get volume() {
      return bgmVolume;
    },
    get enabled() {
      return bgmEnabled && bgmTrack !== "off";
    },
    get isPlaying() {
      return !!bgmTimer;
    },
    get tracks() {
      return Object.entries(BGM_TRACKS).map(([k, v]) => ({ id: k, name: v.name }));
    },
    setTrack: setBgmTrack,
    setVolume: setBgmVolume,
    toggle: toggleBgm,
    start: startBgm,
    stop: stopBgm,
    subscribe(fn) {
      bgmListeners.add(fn);
      notifyBgmListeners();
      return () => bgmListeners.delete(fn);
    },
  };
})();
