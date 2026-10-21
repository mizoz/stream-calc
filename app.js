(function () {
  'use strict';

  // Bitrates in kbps. min/rec/max follow each platform's own wording; missing = not published.
  var Q = {
    '2160p60': ['4K 2160p, 60 fps', 3840, 2160, 60],
    '2160p30': ['4K 2160p, 30 fps', 3840, 2160, 30],
    '1440p60': ['1440p, 60 fps', 2560, 1440, 60],
    '1440p30': ['1440p, 30 fps', 2560, 1440, 30],
    '1080p60': ['1080p, 60 fps', 1920, 1080, 60],
    '1080p30': ['1080p, 30 fps', 1920, 1080, 30],
    '720p60': ['720p, 60 fps', 1280, 720, 60],
    '720p30': ['720p, 30 fps', 1280, 720, 30],
    '480p30': ['480p, 30 fps', 854, 480, 30],
    '360p30': ['360p, 30 fps', 640, 360, 30]
  };
  var CODEC = { h264: 'H.264 (AVC)', hevc: 'HEVC (H.265)', av1: 'AV1', auto: 'Set by Zoom' };

  function ytRow(hmin, hrec, nmin, nrec) {
    var n = { min: nmin, rec: nrec };
    return { h264: { min: hmin, rec: hrec }, hevc: n, av1: n };
  }
  var custom = {
    '2160p60': [30000, 40000, 50000], '2160p30': [20000, 30000, 40000],
    '1440p60': [12000, 16000, 24000], '1440p30': [9000, 12000, 16000],
    '1080p60': [6000, 8000, 12000], '1080p30': [4500, 6000, 8000],
    '720p60': [3500, 4500, 6000], '720p30': [2500, 3500, 4500],
    '480p30': [1000, 1500, 2500], '360p30': [400, 800, 1000]
  };
  var customQ = {};
  Object.keys(custom).forEach(function (k) {
    var v = custom[k], r = function (x) { return Math.round(x * 0.7 / 250) * 250; };
    var e = { min: r(v[0]), rec: r(v[1]), max: r(v[2]) };
    customQ[k] = { h264: { min: v[0], rec: v[1], max: v[2] }, hevc: e, av1: e };
  });

  var P = {
    youtube: {
      name: 'YouTube Live', audio: 128, audioNote: '128 kbps AAC stereo (384 kbps for 5.1), 44.1 kHz stereo / 48 kHz 5.1',
      key: '2 s, never over 4 s', rc: 'CBR', profile: 'high', bframes: 2,
      notes: 'YouTube gives a minimum and a recommended number. The recommended one is generous; the minimum is where it starts to look soft.',
      q: {
        '2160p60': ytRow(14000, 50000, 10000, 35000), '2160p30': ytRow(11000, 42000, 8000, 30000),
        '1440p60': ytRow(8000, 34000, 6000, 24000), '1440p30': ytRow(7000, 21000, 5000, 15000),
        '1080p60': ytRow(6000, 17000, 4000, 12000), '1080p30': ytRow(5000, 14000, 4000, 10000),
        '720p60': ytRow(3000, 8000, 2000, 6000), '720p30': ytRow(3000, 8000, 2000, 6000),
        '480p30': ytRow(400, 4000, 300, 3000), '360p30': ytRow(400, 4000, 300, 3000)
      }
    },
    facebook: {
      name: 'Facebook Live', audio: 128, audioMax: 256, audioNote: '128 kbps AAC-LC preferred, never over 256, 44.1 or 48 kHz',
      key: '2 s, never over 4 s', rc: 'CBR', profile: 'high', bframes: 2,
      notes: 'Meta publishes a range per resolution. H.264 only. Streams max out at 8 hours.',
      q: {
        '1080p60': { h264: { min: 4500, max: 9000 } }, '1080p30': { h264: { min: 3000, max: 6000 } },
        '720p60': { h264: { min: 2250, max: 6000 } }, '720p30': { h264: { min: 1500, max: 4000 } },
        '480p30': { h264: { min: 600, max: 2000 } }, '360p30': { h264: { min: 400, max: 1000 } }
      }
    },
    twitch: {
      name: 'Twitch', audio: 160, audioMax: 160, audioNote: 'AAC-LC, 160 kbps max (Twitch says 96 kbps for widest compatibility)',
      key: '2 s', rc: 'CBR', profile: 'main or high', bframes: 2,
      notes: 'Standard Twitch ingest tops out at 6,000 kbps. HEVC at 1440p (up to 9 Mbps) needs Enhanced Broadcasting and Partner or Affiliate status; in that mode 1080p H.264 goes up to 7,500 kbps.',
      q: {
        '1440p60': { hevc: { rec: 9000, max: 9000 } }, '1440p30': { hevc: { max: 9000 } },
        '1080p60': { h264: { rec: 6000, max: 6000 } }, '1080p30': { h264: { rec: 4500, max: 6000 } },
        '720p60': { h264: { rec: 4500, max: 6000 } }, '720p30': { h264: { rec: 3000, max: 6000 } }
      }
    },
    linkedin: {
      name: 'LinkedIn Live', audio: 128, audioNote: '128 kbps AAC, 48 kHz',
      key: '2 s (60 frames at 30 fps)', rc: 'CBR', profile: 'baseline', bframes: 0,
      notes: 'LinkedIn recommends 720p at 3.5 Mbps, caps video at 6 Mbps and 30 fps, and asks for at least 10 Mbps upload. It also suggests the Baseline profile to avoid processing failures.',
      q: { '1080p30': { h264: { max: 6000 } }, '720p30': { h264: { rec: 3500, max: 6000 } } }
    },
    vimeo: {
      name: 'Vimeo', audio: 128, audioMax: 256, audioNote: 'AAC, 48 kHz. Vimeo re-encodes to 256/128/56 kbps, so more than 256 is wasted',
      key: '2 s', rc: 'CBR', profile: 'high', bframes: 2,
      notes: 'Vimeo ties its numbers to your upload speed. 60 fps is Enterprise only; Advanced and Premium plans cap at 1080p30 and 5,000 kbps.',
      q: {
        '1080p60': { h264: { rec: 9000 } }, '1080p30': { h264: { min: 4000, rec: 5000, max: 5000 } },
        '720p60': { h264: { rec: 5000 } }, '720p30': { h264: { min: 2000, rec: 2500 } }
      }
    },
    teams: {
      name: 'Teams town hall (RTMP-In)', audio: 192, audioNote: '192 kbps AAC-LC, 48 kHz recommended',
      key: '2 s, IDR frame at the start of each GOP', rc: 'CBR (1080p may use VBR)', profile: 'high (level 4.0)', bframes: 2,
      notes: 'Microsoft only gives a ceiling: up to 5 Mbps at 720p and 10 Mbps at 1080p, at least 29.97 fps. Their own tip is to double your bitrate when sizing bandwidth.',
      q: { '1080p30': { h264: { max: 10000 } }, '720p30': { h264: { max: 5000 } } }
    },
    zoom: {
      name: 'Zoom webinar to RTMP', audio: 0, audioNote: 'included in Zoom’s figure',
      key: 'handled by Zoom', rc: 'handled by Zoom', profile: '', bframes: null, zoom: true,
      notes: 'Zoom encodes the outgoing stream in its own cloud, so your venue only uploads what the Zoom app sends. Numbers are Zoom’s published upload needs for sending HD video in a group call. Streaming out of Zoom defaults to 720p.',
      q: { '1080p30': { auto: { rec: 3800 } }, '720p30': { auto: { rec: 2600 } } }
    },
    custom: {
      name: 'Custom RTMP / SRT', audio: 160, audioNote: '128 to 192 kbps AAC, 48 kHz is a safe default',
      key: '2 s', rc: 'CBR', profile: 'high', bframes: 2,
      notes: 'No platform behind this one, so these are my working numbers, not anyone’s spec. Check what your CDN or restream service asks for.',
      q: customQ
    }
  };

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var nf = function (n, d) { return Number(n).toLocaleString('en-CA', { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: 0 }); };
  var mbps = function (kbps) { return nf(kbps / 1000, 1) + ' Mbps'; };
  var kb = function (kbps) { return nf(kbps, 0) + ' kbps'; };
  var num = function (v, def) { var n = parseFloat(v); return isFinite(n) ? n : def; };

  function pick(e, t) {
    if (!e) return { v: 0 };
    if (t === 'min') return { v: e.min != null ? e.min : (e.rec != null ? e.rec : e.max) };
    if (t === 'max') return { v: e.max != null ? e.max : (e.rec != null ? e.rec : e.min) };
    if (t === 'bal' && e.min != null && e.rec != null) return { v: Math.round((e.min + e.rec) / 2 / 250) * 250, bal: true };
    if (e.rec != null) return { v: e.rec };
    if (e.min != null && e.max != null) return { v: Math.round((e.min + e.max) / 2 / 250) * 250, mid: true };
    return { v: e.max != null ? e.max : e.min, ceil: e.max != null };
  }
  function range(e) {
    if (!e) return '';
    var parts = [];
    if (e.min != null && e.max != null) return kb(e.min) + ' to ' + kb(e.max) + (e.rec != null ? ', ' + kb(e.rec) + ' recommended' : '');
    if (e.min != null) parts.push('min ' + kb(e.min));
    if (e.rec != null) parts.push(kb(e.rec) + ' recommended');
    if (e.max != null) parts.push('max ' + kb(e.max));
    return parts.join(', ');
  }
  function qualities(pid) { return Object.keys(Q).filter(function (k) { return P[pid].q[k]; }); }
  function codecs(pid, q) { return Object.keys(P[pid].q[q] || {}); }

  // ---------- state ----------
  var D = {
    t: 'live',
    rows: [{ p: 'youtube', q: '1080p30', c: 'h264' }],
    tg: 'bal', hd: '2', md: 'direct', au: 'auto', up: '',
    fh: 1, fm: 0, fs: 0, fp: 'h264-1080p30', fv: 8, fa: 384,
    ts: 2, tu: 'GB', mg: 5,
    n: 4, hpd: 8, days: 1, cp: 2, ds: 2,
    us: 20, uu: 'GB', sp: 50, ef: 85
  };
  var S = JSON.parse(JSON.stringify(D));

  function encodeRows(rows) { return rows.map(function (r) { return [r.p, r.q, r.c].join('.'); }).join(','); }
  function decodeRows(s) {
    var out = [];
    String(s || '').split(',').forEach(function (x) {
      var a = x.split('.');
      if (P[a[0]] && P[a[0]].q[a[1]] && P[a[0]].q[a[1]][a[2]]) out.push({ p: a[0], q: a[1], c: a[2] });
    });
    return out.length ? out.slice(0, 8) : null;
  }
  function toParams() {
    var p = new URLSearchParams();
    Object.keys(D).forEach(function (k) {
      if (k === 'rows') { var r = encodeRows(S.rows); if (r !== encodeRows(D.rows)) p.set('r', r); return; }
      if (String(S[k]) !== String(D[k])) p.set(k, S[k]);
    });
    return p;
  }
  function fromParams(p) {
    Object.keys(D).forEach(function (k) {
      if (k === 'rows') { var r = decodeRows(p.get('r')); if (r) S.rows = r; return; }
      if (p.has(k)) S[k] = typeof D[k] === 'number' ? num(p.get(k), D[k]) : p.get(k);
    });
  }
  function save() {
    var qs = toParams().toString();
    try { history.replaceState(null, '', location.pathname + location.search + (qs ? '#' + qs : '')); } catch (e) {}
    try { localStorage.setItem('stream-calc', qs); } catch (e) {}
  }
  function load() {
    var h = location.hash.replace(/^#/, '');
    if (h) { fromParams(new URLSearchParams(h)); return; }
    try { var s = localStorage.getItem('stream-calc'); if (s) fromParams(new URLSearchParams(s)); } catch (e) {}
  }

  // ---------- tabs ----------
  var tabs = $$('[role="tab"]');
  function showTab(id, focus) {
    tabs.forEach(function (t) {
      var on = t.dataset.tab === id;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    S.t = id; save();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showTab(t.dataset.tab); });
    t.addEventListener('keydown', function (e) {
      var j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = tabs.length - 1;
      if (j != null) { e.preventDefault(); showTab(tabs[j].dataset.tab, true); }
    });
  });
  $$('[data-goto]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); showTab(a.dataset.goto, true); $('#tool').scrollIntoView(); });
  });

  // ---------- live planner ----------
  var rowsEl = $('#rows');
  function opt(v, label, sel) { return '<option value="' + v + '"' + (sel ? ' selected' : '') + '>' + label + '</option>'; }

  function renderRows() {
    rowsEl.innerHTML = '';
    S.rows.forEach(function (r, i) {
      var qs = qualities(r.p);
      if (qs.indexOf(r.q) < 0) r.q = qs.indexOf('1080p30') >= 0 ? '1080p30' : qs[0];
      var cs = codecs(r.p, r.q);
      if (cs.indexOf(r.c) < 0) r.c = cs[0];
      var id = 'd' + i;
      var li = document.createElement('li');
      li.className = 'dest';
      li.innerHTML =
        '<div class="field"><label for="' + id + 'p">Platform</label><select id="' + id + 'p" data-k="p">' +
        Object.keys(P).map(function (k) { return opt(k, P[k].name, k === r.p); }).join('') + '</select></div>' +
        '<div class="field"><label for="' + id + 'q">Resolution, fps</label><select id="' + id + 'q" data-k="q">' +
        qs.map(function (k) { return opt(k, Q[k][0], k === r.q); }).join('') + '</select></div>' +
        '<div class="field"><label for="' + id + 'c">Codec</label><select id="' + id + 'c" data-k="c"' + (cs.length < 2 ? ' disabled' : '') + '>' +
        cs.map(function (k) { return opt(k, CODEC[k], k === r.c); }).join('') + '</select></div>' +
        (S.rows.length > 1 ? '<button type="button" class="btn link rm" aria-label="Remove ' + P[r.p].name + '">Remove</button>' : '');
      $$('select', li).forEach(function (sel) {
        sel.addEventListener('change', function () { r[sel.dataset.k] = sel.value; renderRows(); calcLive(); });
      });
      var rm = $('.rm', li);
      if (rm) rm.addEventListener('click', function () { S.rows.splice(i, 1); renderRows(); calcLive(); $('#add').focus(); });
      rowsEl.appendChild(li);
    });
    $('#add').disabled = S.rows.length >= 8;
  }
  $('#add').addEventListener('click', function () {
    var used = S.rows.map(function (r) { return r.p; });
    var next = ['facebook', 'linkedin', 'twitch', 'youtube', 'vimeo', 'custom', 'teams'].filter(function (p) { return used.indexOf(p) < 0; })[0] || 'custom';
    S.rows.push({ p: next, q: '1080p30', c: 'h264' });
    renderRows(); calcLive();
    var sel = $$('#rows select[data-k="p"]'); sel[sel.length - 1].focus();
  });

  function audioFor(pid) {
    var p = P[pid];
    if (p.zoom) return 0;
    if (S.au === 'auto') return p.audio;
    var a = num(S.au, p.audio);
    return p.audioMax ? Math.min(a, p.audioMax) : a;
  }

  function rowCalc(r) {
    var p = P[r.p], e = p.q[r.q][r.c], k = pick(e, S.tg);
    var a = audioFor(r.p);
    return { r: r, p: p, e: e, v: k.v, mid: k.mid, bal: k.bal, ceil: k.ceil, a: a, total: k.v + a };
  }

  var lastLive = '', fileReady = false;
  function calcLive() {
    var calcs = S.rows.map(rowCalc);
    var hd = num(S.hd, 1.5);
    var sum = calcs.reduce(function (s, c) { return s + c.total; }, 0);
    var top = calcs.reduce(function (m, c) { return c.total > m.total ? c : m; }, calcs[0]);
    var relay = S.md === 'relay' && calcs.length > 1;
    var send = relay ? top.total : sum;
    var need = send * hd;

    var html = '';
    calcs.forEach(function (c) {
      var tag = c.bal ? ' <span class="tag">between min and recommended</span>' : c.mid ? ' <span class="tag">middle of range</span>' : c.ceil && S.tg !== 'max' ? ' <span class="tag">platform max</span>' : '';
      html += '<div class="res-card"><h3>' + c.p.name + ' <span class="sub">' + Q[c.r.q][0] + ' · ' + CODEC[c.r.c] + '</span></h3>' +
        '<dl class="kv">' +
        '<div><dt>' + (c.p.zoom ? 'Zoom upload need' : 'Video bitrate') + '</dt><dd><strong>' + kb(c.v) + '</strong>' + tag + '</dd></div>' +
        '<div><dt>Published guidance</dt><dd>' + range(c.e) + '</dd></div>' +
        (c.p.zoom ? '' : '<div><dt>Audio</dt><dd>' + kb(c.a) + ' <span class="muted">(' + c.p.audioNote + ')</span></dd></div>') +
        '<div><dt>Stream total</dt><dd>' + kb(c.total) + ' = ' + mbps(c.total) + '</dd></div>' +
        '</dl><p class="note">' + c.p.notes + '</p></div>';
    });
    $('#perDest').innerHTML = html;

    $('#outSend').textContent = mbps(send);
    $('#outNeed').textContent = mbps(need);
    $('#outNeedLabel').textContent = 'Upload you need (' + nf(hd, 2) + '× headroom)';
    $('#outSendLabel').textContent = relay ? 'You send (one stream to the relay)' : calcs.length > 1 ? 'You send (all ' + calcs.length + ' streams)' : 'You send';

    var warn = [];
    if (relay) {
      calcs.forEach(function (c) {
        if (c !== top && c.e.max != null && top.v > c.e.max) warn.push('The relay gets ' + kb(top.v) + ' of video but ' + c.p.name + ' caps at ' + kb(c.e.max) + '. Make sure the relay service re-encodes for that destination, or lower your stream.');
        if (c !== top && (c.r.q !== top.r.q || c.r.c !== top.r.c)) warn.push(c.p.name + ' is set to ' + Q[c.r.q][0] + ' ' + CODEC[c.r.c] + ' but the relay only receives your ' + Q[top.r.q][0] + ' ' + CODEC[top.r.c] + ' feed. Most relays pass it through as is unless you pay for transcoding.');
      });
    }
    calcs.forEach(function (c) {
      if (c.r.p === 'linkedin') warn.push('LinkedIn asks for at least 10 Mbps of upload no matter what your stream bitrate is.');
      if (c.r.p === 'twitch' && c.r.c === 'hevc') warn.push('Twitch HEVC at 1440p only works through Enhanced Broadcasting (OBS) and for Partners or Affiliates.');
      if (c.r.p === 'vimeo' && /60$/.test(c.r.q)) warn.push('Vimeo 60 fps is for Enterprise accounts.');
    });
    var upM = num(S.up, 0), up = upM * 1000, verdict = $('#verdict');
    if (up > 0) {
      var cls, msg;
      if (up >= need) { cls = 'ok'; msg = 'Your ' + nf(upM) + ' Mbps upload covers this with the headroom you picked.'; }
      else if (up >= send) { cls = 'warn'; msg = 'Tight. ' + nf(upM) + ' Mbps carries the stream but leaves only ' + nf(up / send, 2) + '× headroom. Any dip and you drop frames. Lower the bitrate or get a wired line.'; }
      else { cls = 'bad'; msg = 'Not enough. ' + nf(upM) + ' Mbps is less than the ' + mbps(send) + ' you are trying to send.'; }
      verdict.className = 'verdict ' + cls; verdict.textContent = msg; verdict.hidden = false;
    } else verdict.hidden = true;
    var wl = $('#warnings');
    wl.innerHTML = warn.filter(function (w, i) { return warn.indexOf(w) === i; }).map(function (w) { return '<li>' + w + '</li>'; }).join('');
    wl.hidden = !warn.length;

    renderHints(calcs);

    var lines = ['Live stream plan (' + location.href.split('#')[0] + ')'];
    calcs.forEach(function (c) {
      lines.push('- ' + c.p.name + ': ' + Q[c.r.q][0] + ', ' + CODEC[c.r.c] + ', video ' + kb(c.v) + (c.p.zoom ? '' : ', audio ' + kb(c.a)) + ', total ' + mbps(c.total) + ', keyframe ' + c.p.key + ', ' + c.p.rc);
    });
    lines.push((relay ? 'Sending one stream to a relay: ' : 'Upload used: ') + mbps(send));
    lines.push('Upload needed with ' + nf(hd, 2) + 'x headroom: ' + mbps(need));
    if (up > 0) lines.push('Measured upload: ' + nf(upM) + ' Mbps');
    lastLive = lines.join('\n');
    if (S.fp === 'stream' && fileReady) { applyPreset(); calcFile(); }
    save();
  }

  function renderHints(calcs) {
    var c = calcs.reduce(function (m, x) { return x.total > m.total ? x : m; }, calcs[0]);
    var multi = calcs.filter(function (x) { return !x.p.zoom; });
    if (!multi.length) {
      $('#hints').innerHTML = '<p>With Zoom pushing the stream, there is nothing to set in OBS or vMix. In Zoom: More, then Live on Custom Live Streaming Service, paste the RTMP URL and key from your platform. Give the Zoom computer a wired connection.</p>';
      return;
    }
    if (c.p.zoom) c = multi[0];
    var q = Q[c.r.q], fps = q[3], gop = fps * 2;
    var enc = c.r.c === 'h264' ? 'x264 or NVENC H.264' : c.r.c === 'hevc' ? 'NVENC HEVC (or another hardware HEVC encoder)' : 'NVENC AV1 or another hardware AV1 encoder';
    var h = '<p class="muted">For ' + c.p.name + ' at ' + q[0] + (calcs.length > 1 ? ' (your heaviest stream; repeat per output with its own bitrate)' : '') + '.</p>';
    h += '<h3>OBS Studio</h3><ul>' +
      '<li>Settings, Video: base and output resolution <code>' + q[1] + 'x' + q[2] + '</code>, FPS <code>' + fps + '</code></li>' +
      '<li>Settings, Output, Output Mode <code>Advanced</code>, Streaming tab: encoder ' + enc + '</li>' +
      '<li>Rate control <code>CBR</code>, bitrate <code>' + c.v + ' Kbps</code>, keyframe interval <code>2 s</code></li>' +
      '<li>Profile <code>' + c.p.profile + '</code>' + (c.p.bframes != null ? ', B-frames <code>' + c.p.bframes + '</code>' : '') + ', x264 preset <code>veryfast</code> or NVENC preset <code>Quality</code></li>' +
      '<li>Audio tab: track bitrate <code>' + c.a + '</code>; Settings, Audio: sample rate <code>48 kHz</code></li>' +
      (calcs.length > 1 ? '<li>For simulcast from one PC, use Enhanced Broadcasting / multitrack where the platform supports it, or a plugin like Multiple RTMP outputs. Each extra output costs CPU or GPU encoder time.</li>' : '') +
      '</ul>';
    h += '<h3>vMix</h3><ul>' +
      '<li>Stream window: pick the destination, then the cog next to Quality</li>' +
      '<li>Video bit rate <code>' + c.v + ' kbps</code>, audio bit rate <code>' + c.a + ' kbps</code>, size <code>' + q[1] + 'x' + q[2] + '</code></li>' +
      '<li>H.264 profile <code>' + c.p.profile + '</code>, keyframe every 2 s</li>' +
      (c.r.p === 'teams' ? '<li>For Teams RTMP-In, Microsoft says to pick <code>FFMPEG6</code> in the Application drop-down.</li>' : '') +
      '</ul>';
    h += '<h3>Any encoder</h3><ul>' +
      '<li>Keyframe / GOP: 2 seconds. If it asks in frames, that is <code>' + gop + '</code> at ' + fps + ' fps.</li>' +
      '<li>Constant bitrate (CBR), progressive scan, square pixels, Rec. 709 colour for SDR.</li>' +
      '<li>Audio AAC-LC, 48 kHz, stereo.</li>' +
      '<li>Wired ethernet, not venue Wi-Fi. Run a speed test from the encoder machine, at the venue, at the time of day you go live.</li>' +
      '</ul>';
    $('#hints').innerHTML = h;
  }

  function bindSimple(id, key, fn) {
    var el = $('#' + id);
    if (!el) return;
    if (el.type === 'radio') return;
    el.value = S[key];
    el.addEventListener('input', function () { S[key] = typeof D[key] === 'number' ? num(el.value, D[key]) : el.value; fn(); });
  }
  function bindRadios(name, key, fn) {
    $$('input[name="' + name + '"]').forEach(function (r) {
      r.checked = r.value === String(S[key]);
      r.addEventListener('change', function () { if (r.checked) { S[key] = r.value; fn(); } });
    });
  }

  // ---------- file size ----------
  var PRESETS = {
    'h264-1080p30': ['H.264 delivery, 1080p 24/25/30 fps', 8, 384],
    'h264-1080p60': ['H.264 delivery, 1080p 50/60 fps', 12, 384],
    'h264-2160p30': ['H.264 delivery, 4K 24/25/30 fps', 40, 384],
    'h264-720p30': ['H.264 delivery, 720p 30 fps', 5, 384],
    'phone-4k30': ['Phone 4K 30 fps, HEVC (approx.)', 22.7, 0],
    'phone-4k60': ['Phone 4K 60 fps, HEVC (approx.)', 53, 0],
    'phone-1080p30': ['Phone 1080p 30 fps, HEVC (approx.)', 8, 0],
    'prores-hq-1080p30': ['ProRes 422 HQ, 1080p 30', 220, 2304],
    'prores-hq-1080p60': ['ProRes 422 HQ, 1080p 60', 440, 2304],
    'prores-hq-2160p30': ['ProRes 422 HQ, UHD 30', 884, 2304],
    'prores-422-1080p30': ['ProRes 422, 1080p 30', 147, 2304],
    'prores-422-2160p30': ['ProRes 422, UHD 30', 589, 2304],
    'prores-lt-1080p30': ['ProRes 422 LT, 1080p 30', 102, 2304],
    'prores-proxy-1080p30': ['ProRes 422 Proxy, 1080p 30', 45, 2304],
    'stream': ['Same as my live stream (from the planner)', 0, 0],
    'custom': ['Custom bitrate', null, null]
  };
  var psel = $('#fp');
  psel.innerHTML = Object.keys(PRESETS).map(function (k) { return opt(k, PRESETS[k][0], k === S.fp); }).join('');

  function streamPreset() {
    var c = rowCalc(S.rows[0]);
    return [c.v / 1000, c.a];
  }
  function applyPreset() {
    var p = PRESETS[S.fp];
    if (!p || p[1] === null) return;
    var v = p[1], a = p[2];
    if (S.fp === 'stream') { var s = streamPreset(); v = s[0]; a = s[1]; }
    S.fv = v; S.fa = a;
    $('#fv').value = v; $('#fa').value = a;
  }
  function fmtBytes(b) {
    var u = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'], i = 0;
    while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
    return nf(b, b < 10 && i > 0 ? 2 : 1) + ' ' + u[i];
  }
  function fmtBin(b) {
    var u = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return nf(b, 2) + ' ' + u[i];
  }
  function fmtDur(s) {
    s = Math.round(s);
    if (!isFinite(s) || s < 0) return '–';
    if (s < 60) return s + ' s';
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    if (h >= 48) return nf(s / 86400, 1) + ' days';
    return ((h ? h + ' h ' : '') + (m || h ? m + ' min ' : '') + (h ? '' : sec + ' s')).trim();
  }
  var unitB = { MB: 1e6, GB: 1e9, TB: 1e12, MiB: 1048576, GiB: 1073741824 };

  var lastFile = '';
  function calcFile() {
    var dur = S.fh * 3600 + S.fm * 60 + S.fs;
    var kbps = S.fv * 1000 + S.fa;
    var bytes = kbps * 1000 / 8 * dur;
    $('#outSize').textContent = fmtBytes(bytes);
    $('#outSizeBin').textContent = fmtBin(bytes) + ' in binary units (what Windows calls GB)';
    $('#outPerMin').textContent = fmtBytes(kbps * 1000 / 8 * 60) + ' per minute, ' + fmtBytes(kbps * 1000 / 8 * 3600) + ' per hour';

    var target = S.ts * (unitB[S.tu] || 1e9) * (1 - S.mg / 100);
    var totK = dur > 0 ? target * 8 / dur / 1000 : 0;
    var vidK = totK - S.fa;
    $('#outTarget').textContent = dur > 0 ? (vidK > 0 ? kb(Math.floor(vidK)) : 'Too small') : 'Set a duration';
    $('#outTargetNote').textContent = dur > 0 ? 'Total ' + kb(Math.floor(totK)) + ' minus ' + kb(S.fa) + ' audio, with a ' + S.mg + '% margin for the container and encoder overshoot.' : '';

    var perHour = kbps * 1000 / 8 * 3600;
    var copy = perHour * S.n * S.hpd * S.days;
    var total = copy * S.cp;
    $('#outEvent').textContent = fmtBytes(total);
    var drives = Math.ceil(copy / (S.ds * 1e12 * 0.9));
    $('#outEventNote').textContent = fmtBytes(copy) + ' per copy × ' + S.cp + ' cop' + (S.cp === 1 ? 'y' : 'ies') + '. That is ' + drives + ' × ' + S.ds + ' TB drive' + (drives === 1 ? '' : 's') + ' per copy if you only fill them to 90%.';

    lastFile = [
      'Video file size (' + location.href.split('#')[0] + ')',
      '- Bitrate: ' + nf(S.fv, 1) + ' Mbps video + ' + kb(S.fa) + ' audio (' + PRESETS[S.fp][0] + ')',
      '- Duration: ' + fmtDur(dur) + ' -> ' + fmtBytes(bytes),
      '- To fit ' + S.ts + ' ' + S.tu + ': video bitrate ' + (vidK > 0 ? kb(Math.floor(vidK)) : 'n/a'),
      '- Event recording: ' + S.n + ' source(s) x ' + S.hpd + ' h x ' + S.days + ' day(s) x ' + S.cp + ' copies = ' + fmtBytes(total)
    ].join('\n');
    save();
  }

  // ---------- upload time ----------
  var lastUp = '';
  function calcUpload() {
    var bytes = S.us * (unitB[S.uu] || 1e9);
    var eff = Math.min(Math.max(S.ef, 10), 100) / 100;
    var secs = bytes * 8 / (S.sp * 1e6 * eff);
    $('#outTime').textContent = S.sp > 0 ? fmtDur(secs) : '–';
    $('#outTimeNote').textContent = S.sp > 0 ? fmtBytes(bytes) + ' at ' + nf(S.sp) + ' Mbps, assuming you actually get ' + Math.round(eff * 100) + '% of it.' : '';
    var rows = [10, 25, 50, 100, 300, 1000].map(function (s) {
      return '<tr><td>' + nf(s, 0) + ' Mbps</td><td>' + fmtDur(bytes * 8 / (s * 1e6 * eff)) + '</td></tr>';
    }).join('');
    $('#speedTable').innerHTML = rows;
    lastUp = 'Upload time (' + location.href.split('#')[0] + ')\n- ' + fmtBytes(bytes) + ' at ' + nf(S.sp) + ' Mbps (' + Math.round(eff * 100) + '% efficiency): ' + fmtDur(secs);
    save();
  }
  $('#useFile').addEventListener('click', function () {
    var dur = S.fh * 3600 + S.fm * 60 + S.fs;
    var gb = (S.fv * 1000 + S.fa) * 1000 / 8 * dur / 1e9;
    S.us = Math.round(gb * 100) / 100; S.uu = 'GB';
    $('#us').value = S.us; $('#uu').value = 'GB';
    calcUpload();
  });

  // ---------- copy ----------
  function copyText(text, btn) {
    var done = function () {
      var o = btn.textContent; btn.textContent = 'Copied'; $('#status').textContent = 'Copied to clipboard';
      setTimeout(function () { btn.textContent = o; }, 1500);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(t);
    }
  }
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var w = b.dataset.copy;
      copyText(w === 'live' ? lastLive : w === 'file' ? lastFile : w === 'upload' ? lastUp : location.href, b);
    });
  });
  $('#reset').addEventListener('click', function () {
    S = JSON.parse(JSON.stringify(D));
    try { localStorage.removeItem('stream-calc'); } catch (e) {}
    init(); history.replaceState(null, '', location.pathname);
  });

  // ---------- init ----------
  function init() {
    renderRows();
    bindRadios('tg', 'tg', calcLive);
    bindRadios('md', 'md', calcLive);
    ['hd', 'au', 'up'].forEach(function (k) { bindSimple(k, k, calcLive); });
    psel.value = S.fp;
    ['fh', 'fm', 'fs', 'fv', 'fa', 'ts', 'tu', 'mg', 'n', 'hpd', 'days', 'cp', 'ds'].forEach(function (k) {
      bindSimple(k, k, function () {
        if ((k === 'fv' || k === 'fa') && S.fp !== 'custom') { S.fp = 'custom'; psel.value = 'custom'; }
        calcFile();
      });
    });
    ['us', 'uu', 'sp', 'ef'].forEach(function (k) { bindSimple(k, k, calcUpload); });
    fileReady = true;
    if (S.fp === 'stream') applyPreset();
    calcLive(); calcFile(); calcUpload();
    showTab(S.t in { live: 1, file: 1, upload: 1 } ? S.t : 'live');
  }
  psel.addEventListener('change', function () { S.fp = psel.value; applyPreset(); calcFile(); });
  // inputs get replaced listeners on reset, so clone to drop old ones
  var bound = false;
  var _init = init;
  init = function () {
    if (bound) {
      $$('#tool input, #tool select').forEach(function (el) {
        if (el.closest('#rows') || el.id === 'fp') return;
        var c = el.cloneNode(true); el.parentNode.replaceChild(c, el);
      });
    }
    bound = true; _init();
  };
  load();
  init();
})();
