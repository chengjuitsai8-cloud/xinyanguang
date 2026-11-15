/* 新眼光：白內障手術醫病互動工具
   純前端、可離線。資料存在瀏覽器 localStorage，不會上傳。 */
(function () {
  'use strict';

  var D = window.APP_DATA;
  var KEY = 'cataract-helper.v1';
  var FREQ = { Q1H: '每小時 1 次', Q2H: '每 2 小時 1 次', Q3H: '每 3 小時 1 次', QID: '一天 4 次', TID: '一天 3 次', BID: '一天 2 次', QD: '一天 1 次', HS: '睡前 1 次' };

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function has(arr, v) { return Array.isArray(arr) && arr.indexOf(v) >= 0; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function money(n) { return 'NT$ ' + Number(n).toLocaleString('en-US'); }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); }
  function today() { return dateStr(new Date()); }
  function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function toMin(s) { var p = String(s || '08:00').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function fmtMin(m) { return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
  function mdLabel(s) { var d = parseDate(s); return (d.getMonth() + 1) + '/' + d.getDate(); }

  /* ---------- 狀態 ---------- */
  function defaults() {
    return {
      view: 'home', big: false, iolTab: 'iol',
      patient: { name: '', eye: '右眼', surgery: '', wake: '08:00', bed: '22:00' },
      meds: D.meds.map(function (m) { return { id: m.id, enabled: m.enabled, freq: m.freq, days: m.days }; }),
      prices: {}, femtoPrice: '',
      iol: { step: 0, ans: {}, done: false, pick: '' },
      femto: {},
      doses: {}, symptoms: {}, notify: false, photos: {}, hisAt: ''
    };
  }
  var S = load();
  var photoOk = {};      // 資料夾裡有沒有這張藥品照片
  var notified = {};     // 已經提醒過的時段
  var alarmSlot = null;  // 目前顯示提醒橫幅的時段

  function load() {
    var base = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return base;
      var o = JSON.parse(raw);
      Object.keys(base).forEach(function (k) {
        if (o[k] === undefined) return;
        if (k === 'meds') {
          base.meds = base.meds.map(function (m) {
            var f = (o.meds || []).filter(function (x) { return x.id === m.id; })[0];
            return f ? { id: m.id, enabled: !!f.enabled, freq: FREQ[f.freq] ? f.freq : m.freq, days: +f.days || 0 } : m;
          });
        } else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
          Object.keys(o[k] || {}).forEach(function (kk) { base[k][kk] = o[k][kk]; });
        } else {
          base[k] = o[k];
        }
      });
    } catch (e) { /* 讀不到就用預設值 */ }
    return base;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 無痕模式等情況，略過 */ }
  }

  /* ---------- 病程 ---------- */
  function pod() {
    if (!S.patient.surgery) return null;
    return Math.round((parseDate(today()) - parseDate(S.patient.surgery)) / 86400000);
  }
  function stageKey() {
    var p = pod();
    if (p === null || p < 0) return 'pre';
    if (p === 0) return 'd0';
    if (p === 1) return 'd1';
    if (p <= 7) return 'w1';
    if (p <= 30) return 'm1';
    return 'after';
  }

  /* ---------- 用藥排程 ---------- */
  function medDef(id) { return D.meds.filter(function (m) { return m.id === id; })[0]; }
  function activeMeds(day) {
    return S.meds.filter(function (c) {
      return c.enabled && (!c.days || day === null || day <= c.days);
    }).map(function (c) {
      var d = medDef(c.id), o = {};
      Object.keys(d).forEach(function (k) { o[k] = d[k]; });
      o.freq = c.freq; o.days = c.days;
      return o;
    });
  }
  function timesFor(freq) {
    var w = toMin(S.patient.wake), b = toMin(S.patient.bed), out = [], t, i;
    if (b <= w) b = w + 14 * 60;
    function every(step) { for (t = w; t <= b; t += step) out.push(t); }
    function spread(n, cap) {
      var gap = Math.min(cap, Math.floor((b - w - 60) / (n - 1) / 30) * 30);
      for (i = 0; i < n; i++) out.push(w + i * gap);
    }
    switch (freq) {
      case 'Q1H': every(60); break;
      case 'Q2H': every(120); break;
      case 'Q3H': every(180); break;
      case 'QID': spread(4, 240); break;
      case 'TID': spread(3, 360); break;
      case 'BID': spread(2, 720); break;
      case 'QD': out.push(w); break;
      case 'HS': out.push(b); break;
    }
    return out;
  }
  function slotsFor(date) {
    var day = S.patient.surgery ? Math.round((parseDate(date) - parseDate(S.patient.surgery)) / 86400000) : 1;
    var map = {};
    activeMeds(day).forEach(function (m) {
      timesFor(m.freq).forEach(function (t) {
        (map[t] = map[t] || []).push({ med: m, key: date + '|' + m.id + '|' + fmtMin(t) });
      });
    });
    return Object.keys(map).map(Number).sort(function (a, b) { return a - b; }).map(function (t) {
      map[t].sort(function (a, b) { return a.med.order - b.med.order; });
      return { t: t, doses: map[t] };
    });
  }
  function dayStats(date) {
    var total = 0, done = 0;
    slotsFor(date).forEach(function (s) {
      s.doses.forEach(function (d) { total++; if (S.doses[d.key]) done++; });
    });
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0 };
  }
  function slotState(slot, live) {
    var all = slot.doses.every(function (d) { return S.doses[d.key]; });
    if (all) return 'alldone';
    if (!live) return 'up';
    var n = nowMin();
    if (n >= slot.t + 30) return 'late';
    if (n >= slot.t) return 'due';
    return 'up';
  }
  function nextSlot() {
    var p = pod();
    if (p === null || p < 1) return null;
    var slots = slotsFor(today()), n = nowMin(), i;
    for (i = 0; i < slots.length; i++) {
      var st = slotState(slots[i], true);
      if (st === 'due' || st === 'late') return { slot: slots[i], state: st };
    }
    for (i = 0; i < slots.length; i++) if (slots[i].t > n) return { slot: slots[i], state: 'up' };
    return null;
  }

  /* ---------- 藥品圖片 ---------- */
  function illus(m) {
    var c = m.color || '#0e7c86', short = esc(shortName(m));
    var body = m.form === 'ointment'
      ? '<path d="M30 30h50l-6 62H36z" fill="#fff" stroke="' + c + '" stroke-width="3"/><rect x="45" y="92" width="20" height="14" rx="3" fill="' + c + '"/><rect x="33" y="48" width="44" height="22" fill="' + c + '"/><rect x="26" y="22" width="58" height="9" rx="2" fill="' + c + '" opacity=".5"/>'
      : '<rect x="45" y="12" width="20" height="22" rx="4" fill="' + c + '"/><path d="M41 34h28l7 14v50a8 8 0 0 1-8 8H42a8 8 0 0 1-8-8V48z" fill="#fff" stroke="' + c + '" stroke-width="3"/><rect x="34" y="58" width="42" height="24" fill="' + c + '"/>';
    return '<svg viewBox="0 0 110 126" role="img" aria-label="' + esc(m.name) + ' 示意圖"><rect width="110" height="126" fill="#f1f6f7"/>' + body +
      '<text x="55" y="' + (m.form === 'ointment' ? 64 : 75) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">' + short + '</text>' +
      '<text x="55" y="121" text-anchor="middle" font-size="9" fill="#56707a">示意圖</text></svg>';
  }
  function pic(m) {
    if (S.photos[m.id]) return '<img src="' + S.photos[m.id] + '" alt="' + esc(m.name) + ' 藥品照片">';
    if (photoOk[m.id]) return '<img src="' + esc(m.photo) + '" alt="' + esc(m.name) + ' 藥品照片">';
    return illus(m);
  }
  function probePhotos() {
    D.meds.forEach(function (m) {
      var im = new Image();
      im.onload = function () { photoOk[m.id] = true; render(); };
      im.src = m.photo;
    });
  }

  /* ---------- 人工水晶體推薦 ---------- */
  var QUIZ = [
    { id: 'dist', multi: true, title: '手術後，您最希望「不戴眼鏡」就看得清楚的距離？', hint: '可以複選', opts: [
      { v: 'far', t: '遠距離', s: '開車、看電視、看路牌' },
      { v: 'inter', t: '中距離', s: '用電腦、煮菜、看汽車儀表板' },
      { v: 'near', t: '近距離', s: '滑手機、看書、看藥袋' }] },
    { id: 'glasses', title: '手術後看近的時候戴老花眼鏡，您可以接受嗎？', opts: [
      { v: 'ok', t: '可以，戴眼鏡沒關係' },
      { v: 'some', t: '希望盡量少戴' },
      { v: 'never', t: '完全不想戴眼鏡' }] },
    { id: 'night', title: '您晚上開車或騎車的頻率？', opts: [
      { v: 'never', t: '幾乎不會' },
      { v: 'sometimes', t: '偶爾' },
      { v: 'often', t: '經常，或是職業駕駛' }] },
    { id: 'halo', title: '有些水晶體晚上看燈光會有光暈或眩光，您的接受度？', opts: [
      { v: 'low', t: '很在意，越少越好' },
      { v: 'mid', t: '可以慢慢適應' }] },
    { id: 'astig', title: '您有散光嗎？', hint: '不確定沒關係，醫師會用儀器測量角膜散光', opts: [
      { v: 'no', t: '沒有，或很輕微', s: '約 0.75 D 以下' },
      { v: 'yes', t: '有散光', s: '約 1.0 D 以上' },
      { v: 'unk', t: '不清楚' }] },
    { id: 'eye', multi: true, none: 'none', title: '眼睛有沒有下列狀況？', hint: '可以複選', opts: [
      { v: 'macula', t: '黃斑部病變', s: '例如老年性黃斑部病變、黃斑皺褶' },
      { v: 'dr', t: '糖尿病視網膜病變' },
      { v: 'glaucoma', t: '青光眼' },
      { v: 'cornea', t: '角膜疾病，或做過近視雷射手術' },
      { v: 'dry', t: '嚴重乾眼' },
      { v: 'none', t: '都沒有，或不清楚' }] },
    { id: 'budget', title: '每一眼願意自費的金額？', opts: [
      { v: '0', t: '只用健保，不自費' },
      { v: '40000', t: '4 萬元以內' },
      { v: '60000', t: '6 萬元以內' },
      { v: '999999', t: '不設限，以效果為主' }] }
  ];
  var DZ = { macula: '黃斑部病變', dr: '糖尿病視網膜病變', glaucoma: '青光眼', cornea: '角膜問題' };
  var LEVEL = { best: ['很適合', 'ok'], good: ['適合', ''], ok: ['可考慮', 'warn'], low: ['較不適合', 'gray'], out: ['不建議', 'danger'] };

  function femtoPrice() { var p = S.femtoPrice; return (p === undefined || p === '' || isNaN(+p)) ? (D.femtoPrice || 0) : +p; }
  function priceOf(L) { var p = S.prices[L.id]; return (p === undefined || p === '' || isNaN(+p)) ? L.diff : +p; }

  function evalIol(L, a) {
    var dist = (a.dist && a.dist.length) ? a.dist : ['far'];
    var g = a.glasses || 'ok';
    var gm = { ok: 0.7, some: 1.2, never: 1.6 }[g];
    var w = {
      far: has(dist, 'far') ? 7 : 0.5,
      inter: (has(dist, 'inter') ? 7 : 0.5) * gm,
      near: (has(dist, 'near') ? 7 : 0.5) * gm
    };
    var ideal = 3 * (w.far + w.inter + w.near) + 4;
    var raw = L.far * w.far + L.inter * w.inter + L.near * w.near + (L.aspheric ? 4 : 0);
    var score = raw / ideal * 100;
    var plus = [], minus = [], stop = [];

    if (has(dist, 'far') && L.far >= 3) plus.push('看遠清楚');
    if (has(dist, 'inter')) {
      if (L.inter >= 3) plus.push('中距離（電腦、儀表板）清楚');
      else if (L.inter === 2) plus.push('中距離大致清楚');
      else minus.push('中距離需要戴眼鏡');
    }
    if (has(dist, 'near')) {
      if (L.near >= 3) plus.push('近距離（手機、看書）清楚');
      else if (L.near === 2) plus.push('近距離堪用，小字可能仍需輕度老花眼鏡');
      else minus.push('看近需要戴老花眼鏡');
    }
    if (g === 'never' && L.near < 2) score -= 10;

    score -= L.halo * (g === 'ok' ? 5 : 2);
    if (a.night === 'often') {
      score -= L.halo * 9;
      if (L.halo >= 2) minus.push('您常夜間開車，這款夜間光暈眩光較明顯');
      else if (L.halo === 0 && L.aspheric) plus.push('光暈眩光少，適合夜間開車');
      if (!L.aspheric) { score -= 4; minus.push('球面設計，夜間對比略遜於非球面水晶體'); }
    } else if (a.night === 'sometimes') {
      score -= L.halo * 4;
      if (L.halo >= 3) minus.push('夜間開車時可能看到光暈');
    }
    if (a.halo === 'low') {
      score -= L.halo * 5;
      if (L.halo >= 2 && a.night !== 'often') minus.push('您在意光暈，這款出現光暈的機會較高');
    }

    if (a.astig === 'yes') {
      if (L.toric) plus.push('內建散光矯正');
      else {
        score -= L.diffractive ? 18 : 12;
        minus.push(L.diff > 0 ? '沒有散光矯正，殘留散光會影響這款的效果' : '沒有散光矯正，術後可能需要戴散光眼鏡');
      }
    } else if (a.astig === 'no') {
      if (L.toric) stop.push('您沒有明顯散光，不需要散光矯正款');
    } else if (L.toric) {
      score -= 3;
      minus.push('這是散光款，檢查確認有散光才需要');
    }

    var dz = (a.eye || []).filter(function (x) { return DZ[x]; }).map(function (x) { return DZ[x]; });
    if (dz.length) {
      var nm = dz.join('、');
      if (L.diffractive) stop.push('有' + nm + '：繞射式多焦點會降低對比敏感度，通常不建議');
      else if (L.typeKey === 'edof') { score -= 20; minus.push('有' + nm + '：需由醫師依嚴重程度個別評估'); }
      else plus.push('有' + nm + '時仍可使用');
    }
    if (has(a.eye, 'dry') && L.diffractive) { score -= 8; minus.push('嚴重乾眼會影響多焦點的視覺品質，建議先治療乾眼'); }

    var price = priceOf(L);
    var over = a.budget !== undefined && price > +a.budget;
    if (over) { score -= 35; minus.push('超出您設定的預算'); }
    else if (price === 0) plus.push('健保全額給付，不用自付差額');

    score = clamp(Math.round(score), 0, 100);
    var level = stop.length ? 'out' : score >= 78 ? 'best' : score >= 62 ? 'good' : score >= 45 ? 'ok' : 'low';
    if (dz.length && L.typeKey === 'edof' && (level === 'best' || level === 'good')) level = 'ok';
    return { L: L, score: score, level: level, plus: plus, minus: minus, stop: stop, price: price };
  }
  function rankIols(a) {
    var all = D.iols.map(function (L) { return evalIol(L, a); });
    var inn = all.filter(function (r) { return r.level !== 'out'; });
    var out = all.filter(function (r) { return r.level === 'out'; });
    inn.sort(function (x, y) {
      var rk = { best: 0, good: 1, ok: 2, low: 3 };
      var bx = Math.round(x.score / 4), by = Math.round(y.score / 4);
      return (rk[x.level] - rk[y.level]) || (by - bx) || (x.price - y.price) || (y.score - x.score);
    });
    return { inn: inn, out: out };
  }
  function ansText(a) {
    function pick(q, v) { var o = QUIZ.filter(function (x) { return x.id === q; })[0].opts.filter(function (x) { return x.v === v; })[0]; return o ? o.t : ''; }
    var rows = [];
    rows.push(['想不戴眼鏡看清楚', (a.dist || []).map(function (v) { return pick('dist', v); }).join('、') || '未選']);
    rows.push(['看近戴老花眼鏡', pick('glasses', a.glasses)]);
    rows.push(['夜間開車', pick('night', a.night)]);
    rows.push(['光暈接受度', pick('halo', a.halo)]);
    rows.push(['散光', pick('astig', a.astig)]);
    rows.push(['眼睛狀況', (a.eye || []).map(function (v) { return pick('eye', v); }).join('、') || '未選']);
    rows.push(['每眼自費預算', pick('budget', a.budget)]);
    return rows;
  }

  /* ---------- 飛秒雷射評估 ---------- */
  var FEMTO = {
    plus: [
      { id: 'premium', t: '打算選散光矯正、延伸焦段或多焦點水晶體', why: '雷射開的囊口又圓又置中，有助於這類水晶體位置穩定' },
      { id: 'astig', t: '有輕度角膜散光，想一併處理', why: '雷射可以做角膜弧形切口，減少輕度散光' },
      { id: 'hard', t: '白內障很硬，或已經過熟', why: '雷射先把核切開，可以減少超音波能量' },
      { id: 'endo', t: '角膜內皮細胞偏少', why: '減少超音波能量，降低術後角膜水腫的機會' },
      { id: 'zonule', t: '懸韌帶鬆弛、眼睛受過外傷或有假性脫屑', why: '雷射開囊對懸韌帶的拉扯較小' },
      { id: 'shallow', t: '前房較淺', why: '眼內空間小，雷射預先處理可以減少眼內操作' }
    ],
    minus: [
      { id: 'pupil', t: '瞳孔散不大', why: '雷射需要夠大的瞳孔才能開囊' },
      { id: 'opacity', t: '角膜中央有疤痕或混濁', why: '會擋住雷射，切割不完全' },
      { id: 'coop', t: '無法平躺、頭會不自主晃動，或難以配合注視', why: '雷射對接時需要平躺固定幾分鐘' },
      { id: 'fissure', t: '眼裂很小或眼窩很深', why: '雷射的吸附環可能放不上去' },
      { id: 'bleb', t: '做過青光眼濾過手術，或青光眼已到晚期', why: '吸附時眼壓會短暫升高，需由醫師評估' },
      { id: 'conj', t: '結膜鬆弛明顯，或翼狀贅肉較大', why: '可能造成吸附不穩' }
    ]
  };
  function femtoResult() {
    var p = FEMTO.plus.filter(function (x) { return S.femto[x.id]; }).length;
    var m = FEMTO.minus.filter(function (x) { return S.femto[x.id]; }).length;
    if (m > 0) return { cls: 'danger', title: '可能不適合飛秒雷射，請由醫師當面評估', text: '您勾選了 ' + m + ' 項可能限制飛秒雷射的狀況。醫師會在檢查後判斷是否仍可施作，或建議採用傳統超音波手術。' };
    if (p >= 2) return { cls: 'ok', title: '您可能從飛秒雷射得到較多好處', text: '您勾選了 ' + p + ' 項飛秒雷射較有幫助的狀況，可以和醫師進一步討論。' };
    if (p === 1) return { cls: 'info', title: '可以考慮飛秒雷射', text: '您有 1 項飛秒雷射較有幫助的狀況。傳統超音波手術同樣可以完成手術，請依需求與預算決定。' };
    return { cls: 'info', title: '傳統超音波手術即可', text: '目前沒有特別需要飛秒雷射的狀況。飛秒雷射是可以加選的項目，不是必要。' };
  }

  /* ---------- 畫面：首頁 ---------- */
  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    iol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c2.500-4.500 6-7 10-7s7.500 2.500 10 7c-2.500 4.500-6 7-10 7s-7.500-2.500-10-7z"/><circle cx="12" cy="12" r="3.200"/></svg>',
    meds: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 4 5 6.500 5 9.500a5 5 0 0 1-10 0C7 9.500 9 7 12 3z"/><path d="M4 21h16"/></svg>',
    care: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 11c0 5.500-7 10-7 10z"/></svg>',
    faq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M10 9.500a2 2 0 1 1 2.800 1.800c-.500.300-.800.700-.800 1.200"/><path d="M12 14.500v.010"/></svg>',
    laser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"/><path d="M12 16v6"/><path d="M2 12h6"/><path d="M16 12h6"/><circle cx="12" cy="12" r="2.500"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.500-3.300 7.800-8 9-4.700-1.200-8-4.500-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'
  };

  function heroCard() {
    var p = pod(), P = S.patient, who = P.name ? esc(P.name) + '，' : '';
    if (p === null) {
      return '<section class="card stack"><h2>先設定手術資料</h2>' +
        '<p class="muted small">設定後，App 會依照術後第幾天顯示點藥時間表與護理重點。</p>' +
        patientForm() +
        '<button class="btn ghost block" data-act="demo">不想設定？載入示範病人</button></section>';
    }
    var html = '<section class="card hero stack">';
    if (p < 0) html += '<div class="muted">' + who + '距離手術還有</div><div class="big-num">' + (-p) + ' 天</div><div class="muted">手術日 ' + mdLabel(P.surgery) + '，' + esc(P.eye) + '</div>';
    else if (p === 0) html += '<div class="muted">' + who + '今天是</div><div class="big-num">手術當天</div><div class="muted">紗布不要自己拆，今天不用點藥，好好休息。</div>';
    else {
      html += '<div class="muted">' + who + esc(P.eye) + '手術後</div><div class="big-num">第 ' + p + ' 天</div>';
      var st = dayStats(today());
      html += '<div class="muted">今天已點 ' + st.done + ' / ' + st.total + ' 次藥</div>';
    }
    html += '</section>';
    if (p >= 1) {
      var nx = nextSlot();
      if (nx) {
        var names = nx.slot.doses.filter(function (d) { return !S.doses[d.key]; }).map(function (d) { return shortName(d.med); }).join('、');
        var cls = nx.state === 'up' ? 'info' : (nx.state === 'late' ? 'danger' : '');
        var lead = nx.state === 'up' ? '下一次點藥' : (nx.state === 'late' ? '還沒點' : '現在該點藥了');
        html += '<button class="notice ' + cls + '" style="border:0;text-align:left;width:100%" data-act="go" data-view="meds"><b>' + lead + '　' + fmtMin(nx.slot.t) + '</b><br>' + esc(names) + '　→ 點這裡打勾</button>';
      } else {
        html += '<div class="notice ok"><b>今天的藥都點完了。</b></div>';
      }
    }
    return html;
  }
  function logoStrip(cls) {
    var H = D.hospital;
    if (!H.logo) return '';
    return '<div class="brand ' + (cls || '') + '"><img src="' + esc(H.logo) + '" alt="新光吳火獅紀念醫院" onerror="this.parentNode.hidden=true"></div>';
  }
  function patientForm() {
    var P = S.patient;
    return '<div class="stack">' +
      '<label class="field">稱呼（可不填）<input type="text" data-bind="patient.name" value="' + esc(P.name) + '" placeholder="例如：王先生"></label>' +
      '<div class="row"><label class="field grow">手術日期<input type="date" data-bind="patient.surgery" value="' + esc(P.surgery) + '"></label>' +
      '<label class="field" style="width:38%">手術眼<select data-bind="patient.eye">' + ['右眼', '左眼'].map(function (e) { return '<option' + (P.eye === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label></div>' +
      '</div>';
  }
  function viewHome() {
    var sk = stageKey(), order = ['pre', 'd0', 'd1', 'w1', 'm1'], cur = order.indexOf(sk);
    if (sk === 'after') cur = 99;
    var H = D.hospital;
    var html = logoStrip() + heroCard();
    html += '<section class="tiles">' +
      tile('iol', 'iol', 'iol', '選人工水晶體', '回答 7 題，看看哪種適合我') +
      tile('iol', 'femto', 'laser', '飛秒雷射評估', '我適合做飛秒雷射嗎') +
      tile('meds', '', 'meds', '今日點藥', '什麼時間點哪一罐') +
      tile('care', '', 'care', '術後護理', '每個階段該注意什麼') +
      tile('care', 'check', 'check', '今日自我檢查', '哪些狀況要馬上回診') +
      tile('faq', '', 'faq', '常見問題', '搭飛機、洗頭、提重物') +
      '</section>';
    html += '<section class="card"><h2>手術時間軸</h2><ol class="steps">' + D.stages.map(function (s, i) {
      var cls = i < cur ? 'done' : (i === cur ? 'now' : '');
      return '<li class="' + cls + '"><span class="dot"></span><div class="st-title">' + esc(s.title) + (i === cur ? ' <span class="tag warn">現在</span>' : '') + '</div><div class="small muted">' + esc(s.items[0]) + '</div></li>';
    }).join('') + '</ol><button class="btn ghost block" data-act="go" data-view="care">看完整護理重點</button></section>';
    if (S.iol.pick) {
      var L = D.iols.filter(function (x) { return x.id === S.iol.pick; })[0];
      if (L) html += '<section class="card"><h2>我想和醫師討論的水晶體</h2><div class="row spread"><div><b>' + esc(L.name) + '</b><div class="small muted">' + esc(L.zh) + '</div></div><div class="tag">' + (priceOf(L) ? money(priceOf(L)) : '健保給付') + '</div></div></section>';
    }
    html += '<section class="card stack"><h2>緊急聯絡</h2><p class="small muted">視力突然變差、眼睛劇痛、越來越紅，請立刻回診或掛急診。</p>' +
      '<a class="btn danger block" href="tel:' + esc(H.phone.replace(/[^0-9]/g, '')) + '">撥打 ' + esc(H.phone) + '</a>' +
      '<p class="small muted center">' + esc(H.name) + '　眼科門診分機 ' + esc(H.eyeExt) + '</p></section>';
    html += '<p class="small muted center"><b>' + esc(D.appName) + '</b>　' + esc(D.tagline || '') + '<br>本工具提供衛教與溝通輔助，不能取代醫師的診斷與建議。<br>競賽展示用原型，尚非醫院正式服務。</p>';
    return html;
  }
  function tile(view, sub, icon, title, desc) {
    return '<button class="tile" data-act="go" data-view="' + view + '" data-sub="' + sub + '">' + ICON[icon] + '<b>' + title + '</b><span>' + desc + '</span></button>';
  }

  /* ---------- 畫面：選水晶體 ---------- */
  function viewIol() {
    var html = '<div class="seg no-print"><button class="' + (S.iolTab === 'iol' ? 'on' : '') + '" data-act="ioltab" data-tab="iol">人工水晶體</button><button class="' + (S.iolTab === 'femto' ? 'on' : '') + '" data-act="ioltab" data-tab="femto">飛秒雷射</button><button class="' + (S.iolTab === 'all' ? 'on' : '') + '" data-act="ioltab" data-tab="all">全部比較</button></div>';
    if (S.iolTab === 'femto') return html + viewFemto();
    if (S.iolTab === 'all') return html + viewCompare();
    return html + (S.iol.done ? viewIolResult() : viewQuiz());
  }
  function viewQuiz() {
    var i = clamp(S.iol.step, 0, QUIZ.length - 1), q = QUIZ[i], a = S.iol.ans[q.id];
    var answered = q.multi ? (a && a.length > 0) : (a !== undefined);
    var html = '<section class="card stack">';
    html += '<div class="row spread small muted"><span>第 ' + (i + 1) + ' 題，共 ' + QUIZ.length + ' 題</span><span>約 1 分鐘</span></div>';
    html += '<div class="progress"><i style="width:' + Math.round(i / QUIZ.length * 100) + '%"></i></div>';
    html += '<div class="q"><div class="q-title">' + esc(q.title) + '</div>' + (q.hint ? '<div class="small muted">' + esc(q.hint) + '</div>' : '') + '<div class="opts">';
    q.opts.forEach(function (o) {
      var sel = q.multi ? has(a, o.v) : a === o.v;
      html += '<button class="opt' + (q.multi ? ' multi' : '') + (sel ? ' sel' : '') + '" data-act="ans" data-q="' + q.id + '" data-v="' + o.v + '" aria-pressed="' + sel + '"><span class="mark"></span><span><b>' + esc(o.t) + '</b>' + (o.s ? '<small>' + esc(o.s) + '</small>' : '') + '</span></button>';
    });
    html += '</div>' + sayBtn('quiz', '', '這一題') + '</div>';
    html += '<div class="row"><button class="btn ghost" data-act="quiz-prev"' + (i === 0 ? ' disabled' : '') + '>上一題</button><button class="btn grow" data-act="quiz-next"' + (answered ? '' : ' disabled') + '>' + (i === QUIZ.length - 1 ? '看建議結果' : '下一題') + '</button></div>';
    html += '</section>';
    html += '<p class="small muted center">問卷結果是和醫師討論的起點，最後由醫師依檢查結果確認。</p>';
    return html;
  }
  function dots(n, bad) {
    var s = '<span class="dots' + (bad ? ' bad' : '') + '">';
    for (var i = 0; i < 3; i++) s += '<i class="' + (i < n ? 'f' : '') + '"></i>';
    return s + '</span>';
  }
  function iolCard(r, isTop) {
    var L = r.L, lv = LEVEL[r.level];
    var html = '<article class="iol' + (isTop ? ' top' : '') + (r.level === 'out' ? ' out' : '') + '">';
    html += '<div class="row spread wrap"><span class="tag ' + lv[1] + '">' + lv[0] + '</span><span class="tag gray">' + esc(L.type) + '</span></div>';
    html += '<div class="row spread" style="align-items:flex-start"><div class="grow"><div class="name">' + esc(L.name) + '</div><div class="small muted">' + esc(L.zh) + '　' + esc(L.maker) + '</div></div>' +
      '<div style="text-align:right"><div class="price">' + (r.price ? money(r.price) : '健保給付') + '</div><div class="small muted">' + (r.price ? '每眼自付差額' : '不用自付差額') + '</div></div></div>';
    html += '<div class="range"><div>看遠<b>' + dots(L.far) + '</b></div><div>中距離<b>' + dots(L.inter) + '</b></div><div>看近<b>' + dots(L.near) + '</b></div><div>夜間光暈<b>' + dots(L.halo, true) + '</b></div></div>';
    html += '<p class="small">' + esc(L.oneLine) + '</p>';
    html += '<ul class="why">' + r.stop.map(function (t) { return '<li class="stop">' + esc(t) + '</li>'; }).join('') +
      r.plus.map(function (t) { return '<li class="plus">' + esc(t) + '</li>'; }).join('') +
      r.minus.map(function (t) { return '<li class="minus">' + esc(t) + '</li>'; }).join('') + '</ul>';
    html += sayBtn('iol', L.id, L.name);
    if (r.level !== 'out') {
      var picked = S.iol.pick === L.id;
      html += '<button class="btn sm no-print ' + (picked ? '' : 'line') + '" data-act="pick" data-id="' + L.id + '">' + (picked ? '✓ 已選：想和醫師討論這款' : '我想和醫師討論這款') + '</button>';
    }
    return html + '</article>';
  }
  function viewIolResult() {
    var a = S.iol.ans, R = rankIols(a), P = S.patient;
    var html = '<section class="card stack"><h2>給您的人工水晶體建議</h2>';
    html += logoStrip('only-print');
    html += '<p class="only-print small">' + esc(D.hospital.name) + '　' + esc(D.appName) + '　列印日期 ' + today() + (P.name ? '　病人：' + esc(P.name) : '') + '</p>';
    html += '<div class="notice info">依照您的回答排序。這是討論的起點，實際選擇要由醫師依檢查結果確認。</div>';
    html += '<details class="small"><summary class="muted">看我的回答</summary><table class="cmp" style="margin-top:.4rem">' + ansText(a).map(function (r) { return '<tr><td class="muted">' + r[0] + '</td><td style="text-align:left">' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></details>';
    html += '</section>';
    if (!R.inn.length) html += '<div class="notice">依您的條件沒有完全符合的品項，請直接和醫師討論。</div>';
    R.inn.forEach(function (r, i) { html += iolCard(r, i === 0 && (r.level === 'best' || r.level === 'good')); });
    if (R.out.length) {
      html += '<details class="card"><summary><b>不建議的品項（' + R.out.length + '）</b><span class="small muted">　點開看原因</span></summary><div class="stack" style="margin-top:.7rem">' + R.out.map(function (r) { return iolCard(r, false); }).join('') + '</div></details>';
    }
    html += '<section class="card stack"><p class="small muted">價格為每眼自付差額，已扣除健保給付 ' + D.nhiPay.toLocaleString('en-US') + ' 點。資料來源：' + esc(D.priceSource) + '。實際金額以批價為準，手術費與檢查費另計。</p>' +
      '<div class="row wrap no-print"><button class="btn ghost grow" data-act="quiz-reset">重新作答</button><button class="btn line grow" data-act="print">列印 / 存成 PDF</button></div>' +
      '<button class="btn block no-print" style="background:#06c755" data-act="share-iol">用 LINE 傳給家人</button>' +
      '<button class="btn ghost block no-print" data-act="ioltab" data-tab="femto">接著評估飛秒雷射</button></section>';
    return html;
  }
  function viewCompare() {
    var html = '<section class="card stack"><h2>院內常用人工水晶體比較</h2><div class="scroll-x"><table class="cmp wide"><tr><th>品項</th><th>遠</th><th>中</th><th>近</th><th>光暈</th><th>散光</th><th>自付差額</th></tr>';
    D.iols.forEach(function (L) {
      var p = priceOf(L);
      html += '<tr><td><b>' + esc(L.name) + '</b><br><span class="muted">' + esc(L.type) + '</span></td><td>' + dots(L.far) + '</td><td>' + dots(L.inter) + '</td><td>' + dots(L.near) + '</td><td>' + dots(L.halo, true) + '</td><td>' + (L.toric ? '✓' : '—') + '</td><td><b>' + (p ? p.toLocaleString('en-US') : '健保') + '</b></td></tr>';
    });
    html += '</table></div><p class="small muted">圓點越多代表該距離越清楚；「光暈」圓點越多代表夜間光暈眩光的機會越高。價格為每眼自付差額（新台幣），來源：' + esc(D.priceSource) + '。</p></section>';
    D.iols.forEach(function (L) {
      html += '<details class="card"><summary><b>' + esc(L.name) + '</b><span class="small muted">　' + esc(L.zh) + '</span></summary><div class="stack" style="margin-top:.6rem"><p class="small">' + esc(L.oneLine) + '</p><div><b class="small">優點</b><ul class="why">' + L.pros.map(function (t) { return '<li class="plus">' + esc(t) + '</li>'; }).join('') + '</ul></div><div><b class="small">限制</b><ul class="why">' + L.cons.map(function (t) { return '<li class="minus">' + esc(t) + '</li>'; }).join('') + '</ul></div></div></details>';
    });
    return html;
  }
  function viewFemto() {
    var r = femtoResult();
    var html = '<section class="card stack"><h2>我適合做飛秒雷射白內障手術嗎？</h2><p class="small muted">飛秒雷射用電腦控制的雷射完成切口、開囊與分核，再用超音波把白內障吸出來。請勾選符合的狀況；不確定的項目可以請醫師幫忙勾。</p>';
    if (S.iol.done) html += '<button class="btn ghost sm" data-act="femto-fill">帶入水晶體問卷的答案</button>';
    html += '</section>';
    html += '<section class="card"><h2>飛秒雷射比較有幫助的狀況</h2>' + FEMTO.plus.map(function (x) { return femtoLine(x); }).join('') + '</section>';
    html += '<section class="card"><h2>可能不適合飛秒雷射的狀況</h2>' + FEMTO.minus.map(function (x) { return femtoLine(x); }).join('') + '</section>';
    html += '<section class="notice ' + r.cls + '"><b>' + r.title + '</b><br>' + r.text + '</section>';
    html += '<section class="card stack"><h2>費用與效果</h2><p>飛秒雷射是全自費項目，健保不給付。' + (femtoPrice() ? '本院費用為每眼 <b>' + money(femtoPrice()) + '</b>。' : '費用請洽門診。') + '</p>' +
      '<p class="small muted">大型臨床研究顯示，飛秒雷射與傳統超音波手術的術後視力和安全性相近。主要差別在開囊與切口的精準度，以及減少超音波能量。是否加選，請與醫師討論。</p></section>';
    return html;
  }
  function femtoLine(x) {
    return '<label class="checkline"><input type="checkbox" data-femto="' + x.id + '"' + (S.femto[x.id] ? ' checked' : '') + ' style="accent-color:var(--brand)"><span><b>' + esc(x.t) + '</b><br><span class="small muted">' + esc(x.why) + '</span></span></label>';
  }

  /* ---------- 畫面：點藥 ---------- */
  function viewMeds() {
    var p = pod(), P = S.patient, html = '';
    var live = p !== null && p >= 1;
    var meds = activeMeds(live ? p : 1);

    if (p === null) html += '<div class="notice">還沒設定手術日期，以下是示範時間表。到「首頁」設定後就會依術後天數顯示。</div>';
    else if (p < 0) html += '<div class="notice info"><b>手術後才開始點藥。</b>以下是術後時間表預覽，可以先認識藥水。</div>';
    else if (p === 0) html += '<div class="notice info"><b>今天是手術當天，不用點藥。</b>明天回診拆紗布後開始，以下是明天的時間表預覽。</div>';
    else if (p === 1) html += '<div class="notice info"><b>術後第 1 天：</b>回診拆開紗布後開始點藥。回診前的時段可以略過。</div>';

    if (live) {
      var st = dayStats(today());
      html += '<section class="card row"><div class="ring" style="--p:' + st.pct + '"><div><span>' + st.done + '/' + st.total + '<small>今日完成</small></span></div></div>' +
        '<div class="grow"><b>術後第 ' + p + ' 天　點' + esc(P.eye) + '</b><div class="small muted">起床 ' + esc(P.wake) + '　睡覺 ' + esc(P.bed) + '</div>' +
        '<button class="btn sm ' + (S.notify ? '' : 'line') + '" style="margin-top:.4rem" data-act="notify">' + (S.notify ? '🔔 提醒已開啟' : '🔕 開啟到點提醒') + '</button></div></section>';
    }

    html += '<section class="card stack"><div class="row spread"><h2 style="margin:0">' + (live ? '今天的點藥時間' : '點藥時間表（預覽）') + '</h2><button class="btn ghost sm" data-act="edit-time">調整作息</button></div>';
    html += '<p class="small muted">' + meds.map(function (m) { return esc(shortName(m)) + ' ' + FREQ[m.freq]; }).join('；') + '</p></section>';

    var slots = slotsFor(today());
    if (!slots.length) html += '<div class="notice">目前沒有需要點的藥。</div>';
    slots.forEach(function (s) {
      var state = slotState(s, live);
      var label = { alldone: '已完成', due: '現在該點了', late: '還沒點', up: '' }[state];
      html += '<section class="slot ' + state + '" id="slot-' + s.t + '"><div class="slot-head"><span>' + fmtMin(s.t) + '　<span class="small">' + label + '</span></span>' + sayBtn('slot', s.t, fmtMin(s.t) + ' 的藥') + '</div>';
      s.doses.forEach(function (d, i) {
        var m = d.med, done = !!S.doses[d.key];
        if (i > 0) html += '<div class="gap-note">等 5 分鐘再用下一種' + (m.form === 'ointment' ? '；藥膏最後用' : '') + '</div>';
        html += '<div class="dose"><button class="thumb" data-act="drug" data-id="' + m.id + '" aria-label="看 ' + esc(m.name) + ' 的照片與說明">' + pic(m) + '</button>' +
          '<div class="grow"><div class="nm">' + esc(m.name) + '</div><div class="hint">' + esc(m.kind) + '　' + (m.form === 'ointment' ? '擠約 1 公分' : '1 滴') + (m.shake ? '　<b style="color:var(--danger)">先搖勻</b>' : '') + '</div></div>' +
          '<button class="check' + (done ? ' done' : '') + '" data-act="dose" data-key="' + esc(d.key) + '"' + (live ? '' : ' disabled') + ' aria-pressed="' + done + '" aria-label="' + esc(m.name) + ' ' + fmtMin(s.t) + (done ? ' 已點' : ' 還沒點') + '">' + (done ? '✓' : '點好<br>打勾') + '</button></div>';
      });
      html += '</section>';
    });

    html += '<section class="card"><h2>認識我的藥</h2><p class="small muted" style="margin-bottom:.7rem">點照片可以放大，對照手上的藥罐。</p>';
    meds.forEach(function (m) {
      html += '<div class="drug"><button class="pic" data-act="drug" data-id="' + m.id + '" aria-label="放大 ' + esc(m.name) + ' 的照片">' + pic(m) + '</button><div><div class="nm">' + esc(m.name) + '</div><div class="row wrap" style="gap:.3rem;margin:.2rem 0"><span class="tag">' + esc(m.kind) + '</span><span class="tag warn">' + FREQ[m.freq] + '</span></div><p class="small">' + esc(m.what) + '</p>' + (m.shake ? '<p class="small" style="color:var(--danger);font-weight:700">使用前要搖勻</p>' : '') + '</div></div>';
    });
    html += '</section>';

    html += '<section class="card"><h2>正確點眼藥水的方法</h2><ol>' + D.dropSteps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol></section>';
    if (S.hisAt) html += '<p class="small muted center">用藥醫囑來源：HIS 匯入（模擬）　' + esc(S.hisAt) + '</p>';
    else html += '<p class="small muted center">點藥次數與天數以醫師開立的醫囑為準。</p>';
    return html;
  }

  /* ---------- 畫面：術後護理 ---------- */
  function viewCare() {
    var sk = stageKey(), H = D.hospital;
    var sym = S.symptoms[today()] || [];
    var html = '<section class="card" id="selfcheck"><h2>今日自我檢查</h2><p class="small muted">有下列任何一項就打勾。</p>';
    D.redflags.forEach(function (t, i) {
      html += '<label class="checkline"><input type="checkbox" data-sym="' + i + '"' + (has(sym, i) ? ' checked' : '') + '><span>' + esc(t) + '</span></label>';
    });
    if (sym.length) {
      html += '<div class="notice danger" style="margin-top:.6rem"><b>請盡快回診或掛急診。</b><br>您勾選了 ' + sym.length + ' 項需要注意的狀況，請不要等到下次預約。</div>' +
        '<a class="btn danger block" style="margin-top:.6rem" href="tel:' + esc(H.phone.replace(/[^0-9]/g, '')) + '">撥打 ' + esc(H.phone) + '</a><p class="small muted center">眼科門診分機 ' + esc(H.eyeExt) + '</p>';
    } else {
      html += '<div class="notice ok" style="margin-top:.6rem">都沒有勾選：目前沒有警訊，請繼續按時點藥、依約回診。</div>';
    }
    html += '</section>';
    D.stages.forEach(function (s) {
      var now = s.key === sk;
      html += '<details class="card"' + (now ? ' open' : '') + '><summary><b>' + esc(s.title) + '</b>　<span class="small muted">' + esc(s.when) + '</span>' + (now ? ' <span class="tag warn">現在</span>' : '') + '</summary><ul style="margin-top:.5rem">' + s.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>';
    });
    html += '<p class="small muted center">護理重點為一般原則，若與主治醫師的交代不同，請以醫師為準。</p>';
    return html;
  }

  /* ---------- 畫面：常見問題 ---------- */
  function viewFaq() {
    var html = '<section class="card"><h2>常見問題</h2><p class="small muted">點問題看回答。找不到答案請在回診時詢問醫師。</p></section>';
    D.faq.forEach(function (f, i) {
      html += '<details class="qa"><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p><div style="padding:0 0 .9rem 2.1rem">' + sayBtn('faq', i, f.q) + '</div></details>';
    });
    return html;
  }

  /* ---------- 畫面：醫師設定 ---------- */
  function hisSample() {
    return JSON.stringify({
      source: 'HIS', patient: S.patient.surgery ? { name: S.patient.name, eye: S.patient.eye, surgery: S.patient.surgery } : { name: '陳○美', eye: '左眼', surgery: addDays(today(), -1) },
      orders: [{ drug: 'predforte', freq: 'Q2H' }, { drug: 'vigamox', freq: 'QID' }, { drug: 'winacort', freq: 'HS' }]
    }, null, 1);
  }
  function viewDoctor() {
    var P = S.patient, p = pod();
    var html = '<section class="card stack"><h2>醫師設定</h2><p class="small muted">這一頁給醫護人員使用：設定病人手術資料、術後用藥醫囑、價格，並查看病人的問卷結果與點藥紀錄。</p>' +
      '<div class="row wrap"><button class="btn ghost sm" data-act="demo">載入示範病人</button><button class="btn ghost sm" data-act="reset">清除所有資料</button></div></section>';

    html += '<section class="card stack"><h2>病人與手術</h2>' + patientForm() +
      '<div class="row"><label class="field grow">起床時間<input type="time" data-bind="patient.wake" value="' + esc(P.wake) + '"></label><label class="field grow">睡覺時間<input type="time" data-bind="patient.bed" value="' + esc(P.bed) + '"></label></div></section>';

    html += '<section class="card stack"><h2>術後用藥醫囑</h2>';
    S.meds.forEach(function (c) {
      var m = medDef(c.id);
      html += '<div class="stack" style="border-top:1px solid var(--line);padding-top:.6rem"><label class="row"><input type="checkbox" data-med="' + c.id + '" data-f="enabled"' + (c.enabled ? ' checked' : '') + ' style="width:1.4rem;height:1.4rem;accent-color:var(--brand)"><b>' + esc(m.name) + '</b><span class="small muted">' + esc(m.kind) + '</span></label>' +
        '<div class="row"><label class="field grow">頻率<select data-med="' + c.id + '" data-f="freq">' + Object.keys(FREQ).map(function (k) { return '<option value="' + k + '"' + (c.freq === k ? ' selected' : '') + '>' + k + '　' + FREQ[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="field" style="width:36%">用到術後第幾天<input type="number" min="0" max="120" data-med="' + c.id + '" data-f="days" value="' + (+c.days || 0) + '"></label></div></div>';
    });
    html += '<p class="small muted">天數填 0 表示持續到醫師調整為止。</p></section>';

    html += '<section class="card stack"><h2>HIS 醫囑連動（模擬）</h2><p class="small muted">未來由院內 HIS 提供醫囑資料，病人端自動更新點藥頻率。現在用下面的 JSON 模擬 HIS 送來的資料。</p>' +
      '<textarea id="hisBox" spellcheck="false">' + esc(hisSample()) + '</textarea><button class="btn block" data-act="his">模擬從 HIS 匯入醫囑</button>' +
      (S.hisAt ? '<p class="small muted">上次匯入：' + esc(S.hisAt) + '</p>' : '') + '</section>';

    html += '<section class="card stack"><h2>病人點藥紀錄（近 7 天）</h2>';
    if (p === null || p < 1) html += '<p class="small muted">術後第 1 天起才有紀錄。</p>';
    else {
      var days = [], i;
      for (i = 6; i >= 0; i--) { var d = addDays(today(), -i); if (parseDate(d) > parseDate(S.patient.surgery)) days.push(d); }
      var sum = { t: 0, d: 0 };
      html += '<div class="bars" style="grid-template-columns:repeat(' + days.length + ',1fr)">' + days.map(function (d) {
        var st = dayStats(d); sum.t += st.total; sum.d += st.done;
        return '<div><span>' + st.pct + '%</span><i style="height:' + Math.max(3, st.pct * 0.6) + 'px;' + (st.pct < 60 ? 'background:var(--accent)' : '') + '"></i><span>' + mdLabel(d) + '</span></div>';
      }).join('') + '</div><p>整體遵從率 <b>' + (sum.t ? Math.round(sum.d / sum.t * 100) : 0) + '%</b>（' + sum.d + ' / ' + sum.t + ' 次）</p>';
      var flags = Object.keys(S.symptoms).filter(function (k) { return S.symptoms[k].length; }).sort();
      html += flags.length ? '<div class="notice danger"><b>病人回報的警訊</b><br>' + flags.map(function (k) { return mdLabel(k) + '：' + S.symptoms[k].map(function (i) { return esc(D.redflags[i]); }).join('、'); }).join('<br>') + '</div>' : '<p class="small muted">病人沒有回報警訊症狀。</p>';
    }
    html += '</section>';

    html += '<section class="card stack"><h2>病人的水晶體問卷</h2>';
    if (S.iol.done) {
      var R = rankIols(S.iol.ans);
      html += '<table class="cmp">' + ansText(S.iol.ans).map(function (r) { return '<tr><td class="muted">' + r[0] + '</td><td style="text-align:left">' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
      html += '<p>系統排序前三：<b>' + R.inn.slice(0, 3).map(function (r) { return esc(r.L.name); }).join('、') + '</b></p>';
      var pk = D.iols.filter(function (x) { return x.id === S.iol.pick; })[0];
      html += '<p>病人想討論：<b>' + (pk ? esc(pk.name) : '尚未選擇') + '</b></p>';
    } else html += '<p class="small muted">病人尚未完成問卷。</p>';
    html += '</section>';

    html += '<section class="card stack"><h2>價格設定（每眼自付差額）</h2><p class="small muted">預設值來自' + esc(D.priceSource) + '，可依最新公告修改。</p>';
    D.iols.forEach(function (L) {
      html += '<label class="row"><span class="grow small"><b>' + esc(L.name) + '</b></span><input type="number" min="0" step="100" style="width:42%" data-price="' + L.id + '" value="' + priceOf(L) + '"></label>';
    });
    html += '<label class="row"><span class="grow small"><b>飛秒雷射費用（每眼）</b></span><input type="number" min="0" step="100" style="width:42%" data-bind="femtoPrice" value="' + (femtoPrice() || '') + '" placeholder="未設定"></label></section>';

    html += '<section class="card stack"><h2>藥品照片</h2><p class="small muted">上傳院內藥品照片，病人端會顯示。也可以把照片放進 app/drug-photos 資料夾，檔名見各藥品下方。</p>';
    D.meds.forEach(function (m) {
      html += '<div class="row"><div class="dose" style="padding:0;border:0"><span class="thumb">' + pic(m) + '</span></div><div class="grow"><b class="small">' + esc(m.name) + '</b><div class="small muted">' + esc(m.photo.split('/').pop()) + '</div><input type="file" accept="image/*" data-photo="' + m.id + '" style="min-height:auto;border:0;padding:.2rem 0;font-size:.8rem"></div>' + (S.photos[m.id] ? '<button class="btn ghost sm" data-act="photo-del" data-id="' + m.id + '">移除</button>' : '') + '</div>';
    });
    html += '</section>';
    return html;
  }

  /* ---------- 浮層 ---------- */
  function modal(inner) {
    document.getElementById('overlay').innerHTML = '<div class="modal" data-act="close-modal"><div class="box" role="dialog" aria-modal="true">' + inner + '<button class="btn block" data-act="close-modal">關閉</button></div></div>';
  }
  function closeModal() { document.getElementById('overlay').innerHTML = ''; stopSpeak(); }
  function drugModal(id) {
    var m = medDef(id), c = S.meds.filter(function (x) { return x.id === id; })[0];
    var isPhoto = S.photos[id] || photoOk[id];
    modal('<h2>' + esc(m.name) + '</h2><div class="small muted">' + esc(m.generic) + '</div>' + sayBtn('drug', id, m.name) + '<div class="bigpic">' + pic(m) + '</div>' +
      (isPhoto ? '' : '<p class="small muted center">尚未放入實物照片，這是示意圖。</p>') +
      (m.look ? '<p><b>外觀：</b>' + esc(m.look) + '</p>' : '') +
      '<p><b>這是什麼：</b>' + esc(m.what) + '</p><p><b>怎麼用：</b>' + FREQ[c.freq] + '</p><ul>' + m.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>');
  }
  function timeModal() {
    var P = S.patient;
    modal('<h2>調整作息時間</h2><p class="small muted">點藥時間會依起床和睡覺時間重新排列。</p><div class="row"><label class="field grow">起床時間<input type="time" data-bind="patient.wake" value="' + esc(P.wake) + '"></label><label class="field grow">睡覺時間<input type="time" data-bind="patient.bed" value="' + esc(P.bed) + '"></label></div>');
  }
  var toastTimer;
  function toast(t) {
    var el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.style.display = 'none'; }, 2600);
  }

  /* ---------- 朗讀（使用裝置內建語音，離線可用） ---------- */
  var speaking = false, voice = null, speakToken = 0;
  function canSpeak() { return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window; }
  function pickVoice() {
    try {
      var vs = window.speechSynthesis.getVoices();
      voice = vs.filter(function (v) { return /zh[-_]TW/i.test(v.lang); })[0] ||
        vs.filter(function (v) { return /^(zh|cmn)/i.test(v.lang); })[0] || null;
    } catch (e) { voice = null; }
  }
  function speakUi() {
    var b = document.getElementById('readBtn');
    if (!b) return;
    b.textContent = speaking ? '停止' : '朗讀';
    b.classList.toggle('on', speaking);
    b.setAttribute('aria-label', speaking ? '停止朗讀' : '朗讀這一頁');
  }
  function stopSpeak() {
    speakToken++;
    if (canSpeak()) { try { window.speechSynthesis.cancel(); } catch (e) { /* 略過 */ } }
    speaking = false; speakUi();
  }
  function speak(text) {
    if (!canSpeak()) { toast('這個瀏覽器不支援朗讀功能'); return; }
    var parts = (String(text).replace(/\s+/g, ' ').match(/[^。！？；]+[。！？；]?/g) || [])
      .map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return;
    try { window.speechSynthesis.cancel(); } catch (e) { /* 略過 */ }
    if (!voice) pickVoice();
    var token = ++speakToken;
    speaking = true; speakUi();
    parts.forEach(function (p, i) {
      var u = new SpeechSynthesisUtterance(p);
      u.lang = 'zh-TW'; if (voice) u.voice = voice;
      u.rate = 0.9;
      if (i === parts.length - 1) u.onend = u.onerror = function () { if (token === speakToken) { speaking = false; speakUi(); } };
      window.speechSynthesis.speak(u);
    });
  }
  function sayTime(min) {
    var h = Math.floor(min / 60) % 24, m = min % 60;
    var period = h < 6 ? '凌晨' : h < 12 ? '早上' : h === 12 ? '中午' : h < 18 ? '下午' : '晚上';
    var h12 = h > 12 ? h - 12 : h;
    return period + ' ' + h12 + ' 點' + (m ? ' ' + m + ' 分' : '');
  }
  function medSay(m) { return m.say || m.name; }
  function shortName(m) { return m.short || m.name.split(' ')[0]; }
  function slotSpeech(slot) {
    return sayTime(slot.t) + '要用的藥：' + slot.doses.map(function (d) {
      var m = d.med;
      return medSay(m) + '，' + (m.form === 'ointment' ? '擠約 1 公分到下眼瞼' : '點 1 滴') + (m.shake ? '，使用前先搖勻' : '');
    }).join('。等 5 分鐘之後，再用') + '。';
  }
  function iolSpeech(r) {
    var L = r.L, t = L.zh + '，' + L.type + '。' + LEVEL[r.level][0] + '。';
    t += r.price ? '每眼自付差額 ' + r.price + ' 元。' : '健保給付，不用自付差額。';
    t += L.oneLine;
    if (r.stop.length) t += '不建議的原因：' + r.stop.join('，') + '。';
    if (r.plus.length) t += '優點：' + r.plus.join('，') + '。';
    if (r.minus.length) t += '要注意：' + r.minus.join('，') + '。';
    return t;
  }
  function drugSpeech(id) {
    var m = medDef(id), c = S.meds.filter(function (x) { return x.id === id; })[0];
    return medSay(m) + '。' + (m.look ? '外觀：' + m.look : '') + m.what + '用法：' + FREQ[c.freq] + '。' + m.tips.join('。') + '。';
  }
  function pageSpeech() {
    var v = S.view, p = pod(), P = S.patient, t = '', sk = stageKey();
    var stage = D.stages.filter(function (s) { return s.key === sk; })[0];
    if (v === 'home') {
      if (p === null) return '歡迎使用' + D.appName + '。請先設定手術日期，或是載入示範病人。';
      if (p < 0) t = '距離手術還有 ' + (-p) + ' 天。';
      else if (p === 0) t = '今天是手術當天。';
      else {
        var st = dayStats(today()), nx = nextSlot();
        t = '今天是' + P.eye + '手術後第 ' + p + ' 天。今天已經點了 ' + st.done + ' 次藥，一共要點 ' + st.total + ' 次。';
        if (nx) t += (nx.state === 'up' ? '下一次點藥是' : '現在該點藥了。') + slotSpeech(nx.slot);
        else t += '今天的藥都點完了。';
      }
      if (stage) t += '現在的護理重點：' + stage.items.join('。') + '。';
      return t + '如果視力突然變差、眼睛劇痛，或是越來越紅，請立刻回診或掛急診。';
    }
    if (v === 'meds') {
      var live = p !== null && p >= 1, slots = slotsFor(today());
      if (!live) {
        t = p === 0 ? '今天是手術當天，不用點藥。明天回診拆紗布之後開始。' : '手術後才開始點藥。';
        return t + '手術後要用的藥有：' + activeMeds(1).map(function (m) { return medSay(m) + '，' + FREQ[m.freq]; }).join('。') + '。兩種藥水之間請間隔 5 分鐘，藥膏最後使用。';
      }
      var left = slots.filter(function (s) { return slotState(s, true) !== 'alldone'; });
      t = '今天是術後第 ' + p + ' 天，藥點在' + P.eye + '。';
      if (!left.length) return t + '今天的藥都點完了。';
      t += '還沒點的時段有 ' + left.length + ' 個。';
      left.slice(0, 4).forEach(function (s) { t += slotSpeech(s); });
      if (left.length > 4) t += '之後的時段請看畫面，或按各時段旁邊的喇叭。';
      return t + '兩種藥水之間請間隔 5 分鐘，藥膏最後使用。';
    }
    if (v === 'care') {
      t = stage ? stage.title + '的護理重點：' + stage.items.join('。') + '。' : '';
      return t + '有下列任何一種狀況，請立刻回診或掛急診：' + D.redflags.join('。') + '。';
    }
    if (v === 'faq') return D.faq.map(function (f) { return '問題：' + f.q + '回答：' + f.a; }).join('');
    if (v === 'iol') {
      if (S.iolTab === 'femto') {
        var fr = femtoResult();
        return '飛秒雷射評估。請勾選符合的狀況。目前結果：' + fr.title + '。' + fr.text + '飛秒雷射是全自費項目，健保不給付。' + (femtoPrice() ? '本院費用為每眼 ' + femtoPrice() + ' 元。' : '');
      }
      if (S.iolTab === 'all') return '院內常用人工水晶體比較。' + D.iols.map(function (L) { return L.zh + '：' + L.oneLine + (priceOf(L) ? '每眼自付差額 ' + priceOf(L) + ' 元。' : '健保給付。'); }).join('');
      if (!S.iol.done) return quizSpeech();
      var R = rankIols(S.iol.ans);
      return '依照您的回答，建議的人工水晶體如下。' + R.inn.slice(0, 3).map(function (r, i) { return '第 ' + (i + 1) + ' 順位：' + iolSpeech(r); }).join('') + '實際選擇要由醫師依檢查結果確認。';
    }
    return '這一頁是醫師設定，提供醫護人員使用。';
  }
  function quizSpeech() {
    var q = QUIZ[clamp(S.iol.step, 0, QUIZ.length - 1)];
    return q.title + (q.multi ? '可以複選。' : '') + '選項有：' + q.opts.map(function (o, i) { return '第 ' + (i + 1) + ' 個，' + o.t + (o.s ? '，' + o.s : ''); }).join('。') + '。';
  }
  var SAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.500 8.500a5 5 0 0 1 0 7"/><path d="M19 6a8.500 8.500 0 0 1 0 12"/></svg>';
  function sayBtn(kind, arg, label) {
    return '<button class="say no-print" data-act="say" data-kind="' + kind + '" data-arg="' + esc(arg) + '" aria-label="朗讀：' + esc(label || '') + '">' + SAY + '<span>唸給我聽</span></button>';
  }

  /* ---------- 提醒 ---------- */
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      var ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      o.start(); o.stop(ctx.currentTime + 0.85);
    } catch (e) { /* 沒有音效也沒關係 */ }
  }
  function tick() {
    var p = pod();
    if (p === null || p < 1) { setAlarm(null); return; }
    var nx = nextSlot();
    if (nx && nx.state !== 'up') {
      setAlarm(nx.slot);
      var k = today() + '|' + nx.slot.t;
      if (S.notify && !notified[k] && nx.state === 'due') {
        notified[k] = true;
        beep();
        var names = nx.slot.doses.map(function (d) { return shortName(d.med); }).join('、');
        try {
          if (window.Notification && Notification.permission === 'granted') new Notification('該點眼藥水了　' + fmtMin(nx.slot.t), { body: names + '。點完記得打勾。', tag: k });
        } catch (e) { /* 部分瀏覽器不支援 */ }
        if (canSpeak()) speak('現在該點眼藥水了。' + slotSpeech(nx.slot) + '點完記得打勾。');
      }
    } else setAlarm(null);
    if (S.view === 'meds' || S.view === 'home') softRefresh();
  }
  var lastMinute = -1;
  function softRefresh() {
    var m = nowMin();
    if (m !== lastMinute && !document.querySelector('.modal')) { lastMinute = m; render(); }
  }
  function setAlarm(slot) {
    var host = document.getElementById('alarmHost');
    if (!host) { host = document.createElement('div'); host.id = 'alarmHost'; document.body.appendChild(host); }
    alarmSlot = slot;
    var hide = !slot || S.view === 'meds' || S.view === 'home' || S.view === 'doctor';
    document.body.classList.toggle('has-alarm', !hide);
    if (hide) { host.innerHTML = ''; return; }
    var names = slot.doses.filter(function (d) { return !S.doses[d.key]; }).map(function (d) { return shortName(d.med); }).join('、');
    host.innerHTML = '<div class="alarm"><div class="in"><span class="grow">🔔 ' + fmtMin(slot.t) + ' 該點藥了：' + esc(names) + '</span><button class="btn sm" style="background:#fff;color:#9a5a05" data-act="go" data-view="meds">去打勾</button></div></div>';
  }

  /* ---------- 示範資料 ---------- */
  function loadDemo() {
    var keep = S.photos, big = S.big;
    S = defaults(); S.photos = keep; S.big = big;
    S.patient = { name: '王先生（示範）', eye: '右眼', surgery: addDays(today(), -3), wake: '08:00', bed: '22:00' };
    S.iol = { step: 0, done: true, pick: 'diu', ans: { dist: ['far', 'inter'], glasses: 'ok', night: 'often', halo: 'low', astig: 'yes', eye: ['none'], budget: '60000' } };
    S.femto = { premium: true, astig: true };
    var miss = { 1: [3, 9], 2: [6] }, d, n;
    for (d = 1; d <= 2; d++) {
      n = 0;
      slotsFor(addDays(S.patient.surgery, d)).forEach(function (s) {
        s.doses.forEach(function (x) { if (!has(miss[d], n)) S.doses[x.key] = 1; n++; });
      });
    }
    var nm = nowMin();
    slotsFor(today()).forEach(function (s) {
      if (s.t + 60 <= nm) s.doses.forEach(function (x) { S.doses[x.key] = 1; });
    });
    S.view = 'home';
    save(); render(); toast('已載入示範病人：術後第 3 天');
  }

  /* ---------- 繪製 ---------- */
  var TABS = [['home', '首頁', 'home'], ['iol', '選水晶體', 'iol'], ['meds', '點藥', 'meds'], ['care', '護理', 'care'], ['faq', '問答', 'faq']];
  function render() {
    var v = S.view, html;
    if (v === 'iol') html = viewIol();
    else if (v === 'meds') html = viewMeds();
    else if (v === 'care') html = viewCare();
    else if (v === 'faq') html = viewFaq();
    else if (v === 'doctor') html = viewDoctor();
    else html = viewHome();
    document.getElementById('view').innerHTML = html;
    var pending = 0, p = pod();
    if (p !== null && p >= 1) slotsFor(today()).forEach(function (s) { var st = slotState(s, true); if (st === 'due' || st === 'late') pending++; });
    document.getElementById('tabs').innerHTML = TABS.map(function (t) {
      return '<button class="tab' + (v === t[0] ? ' on' : '') + '" data-act="go" data-view="' + t[0] + '"' + (v === t[0] ? ' aria-current="page"' : '') + '>' + ICON[t[2]] + (t[0] === 'meds' && pending ? '<span class="badge">' + pending + '</span>' : '') + '<span>' + t[1] + '</span></button>';
    }).join('');
    document.documentElement.classList.toggle('big', !!S.big);
    document.getElementById('fontBtn').classList.toggle('on', !!S.big);
    document.getElementById('docBtn').classList.toggle('on', v === 'doctor');
    document.getElementById('appTitle').textContent = D.appName;
    document.getElementById('appSub').textContent = D.hospital.name;
    document.title = D.appName + '｜' + (D.tagline || '');
    setAlarm(alarmSlot);
  }
  function go(view, sub) {
    stopSpeak();
    S.view = view;
    if (view === 'iol') S.iolTab = sub === 'femto' ? 'femto' : (sub === 'all' ? 'all' : 'iol');
    save(); render();
    if (view === 'care' && sub === 'check') { var el = document.getElementById('selfcheck'); if (el) el.scrollIntoView(); }
    else if (view === 'meds') {
      var nx = nextSlot(), target = nx && document.getElementById('slot-' + nx.slot.t);
      if (target && nx.state !== 'up') target.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
    } else window.scrollTo(0, 0);
  }

  /* ---------- 事件 ---------- */
  var ACT = {
    go: function (el) { go(el.dataset.view, el.dataset.sub || ''); },
    'toggle-font': function () { S.big = !S.big; save(); render(); },
    'read-page': function () { if (speaking) stopSpeak(); else speak(pageSpeech()); },
    say: function (el) {
      var k = el.dataset.kind, a = el.dataset.arg, t = '';
      if (k === 'quiz') t = quizSpeech();
      else if (k === 'faq') t = D.faq[+a].q + D.faq[+a].a;
      else if (k === 'drug') t = drugSpeech(a);
      else if (k === 'slot') { var s = slotsFor(today()).filter(function (x) { return x.t === +a; })[0]; if (s) t = slotSpeech(s); }
      else if (k === 'iol') { var L = D.iols.filter(function (x) { return x.id === a; })[0]; if (L) t = iolSpeech(evalIol(L, S.iol.ans)); }
      speak(t);
    },
    demo: loadDemo,
    reset: function () {
      if (!confirm('確定清除這台裝置上的所有資料嗎？問卷、點藥紀錄和設定都會刪除。')) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* 略過 */ }
      S = defaults(); S.view = 'doctor'; notified = {}; render(); toast('已清除');
    },
    ioltab: function (el) { S.iolTab = el.dataset.tab; save(); render(); window.scrollTo(0, 0); },
    ans: function (el) {
      var q = QUIZ.filter(function (x) { return x.id === el.dataset.q; })[0], v = el.dataset.v, a = S.iol.ans;
      if (q.multi) {
        var cur = (a[q.id] || []).slice();
        if (q.none && v === q.none) cur = has(cur, v) ? [] : [v];
        else {
          cur = cur.filter(function (x) { return x !== q.none; });
          if (has(cur, v)) cur = cur.filter(function (x) { return x !== v; }); else cur.push(v);
        }
        a[q.id] = cur;
      } else a[q.id] = v;
      save(); render();
    },
    'quiz-prev': function () { S.iol.step = Math.max(0, S.iol.step - 1); save(); render(); },
    'quiz-next': function () {
      if (S.iol.step >= QUIZ.length - 1) { S.iol.done = true; S.iol.step = 0; }
      else S.iol.step++;
      save(); render(); window.scrollTo(0, 0);
    },
    'quiz-reset': function () { S.iol = { step: 0, ans: {}, done: false, pick: '' }; save(); render(); window.scrollTo(0, 0); },
    pick: function (el) { S.iol.pick = S.iol.pick === el.dataset.id ? '' : el.dataset.id; save(); render(); if (S.iol.pick) toast('已記下，回診時可以給醫師看'); },
    print: function () { window.print(); },
    'share-iol': function () {
      var R = rankIols(S.iol.ans), lines = ['【' + D.appName + '】人工水晶體建議'];
      R.inn.slice(0, 3).forEach(function (r, i) { lines.push((i + 1) + '. ' + r.L.name + '（' + r.L.type + '）' + (r.price ? ' 每眼自付約 ' + r.price.toLocaleString('en-US') + ' 元' : ' 健保給付')); });
      var pk = D.iols.filter(function (x) { return x.id === S.iol.pick; })[0];
      if (pk) lines.push('我想和醫師討論：' + pk.name);
      lines.push('實際選擇由醫師依檢查結果確認。');
      window.open('https://line.me/R/share?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    },
    'femto-fill': function () {
      var a = S.iol.ans, pk = D.iols.filter(function (x) { return x.id === S.iol.pick; })[0];
      var top = pk || (rankIols(a).inn[0] || {}).L;
      S.femto.premium = !!(top && top.typeKey !== 'mono');
      S.femto.astig = a.astig === 'yes';
      save(); render(); toast('已帶入問卷答案');
    },
    dose: function (el) {
      var k = el.dataset.key;
      if (S.doses[k]) delete S.doses[k]; else S.doses[k] = Date.now();
      save(); render(); tick();
    },
    drug: function (el) { drugModal(el.dataset.id); },
    'edit-time': timeModal,
    'close-modal': function (el, ev) {
      if (el.classList.contains('modal') && ev.target !== el) return;
      closeModal(); render();
    },
    notify: function () {
      if (S.notify) { S.notify = false; save(); render(); return; }
      S.notify = true; save(); render(); beep();
      if (!window.Notification) { toast('已開啟。這個瀏覽器不支援系統通知，畫面開著時會以聲音和橫幅提醒'); return; }
      try {
        Notification.requestPermission().then(function (r) {
          toast(r === 'granted' ? '已開啟到點提醒' : '已開啟。未允許系統通知，畫面開著時會以聲音和橫幅提醒');
        });
      } catch (e) { toast('已開啟，畫面開著時會以聲音和橫幅提醒'); }
    },
    his: function () {
      var o;
      try { o = JSON.parse(document.getElementById('hisBox').value); } catch (e) { toast('JSON 格式有誤，請檢查'); return; }
      if (!o || !Array.isArray(o.orders)) { toast('找不到 orders 欄位'); return; }
      var bad = o.orders.filter(function (x) { return !medDef(x.drug) || !FREQ[x.freq]; });
      if (bad.length) { toast('有不認得的藥品或頻率：' + bad.map(function (x) { return x.drug + ' ' + x.freq; }).join('、')); return; }
      S.meds.forEach(function (c) {
        var f = o.orders.filter(function (x) { return x.drug === c.id; })[0];
        c.enabled = !!f; if (f) { c.freq = f.freq; c.days = +f.days || 0; }
      });
      if (o.patient) ['name', 'eye', 'surgery'].forEach(function (k) { if (o.patient[k]) S.patient[k] = String(o.patient[k]); });
      var d = new Date(); S.hisAt = today() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      save(); render(); toast('已匯入 ' + o.orders.length + ' 筆醫囑，病人端時間表已更新');
    },
    'photo-del': function (el) { delete S.photos[el.dataset.id]; save(); render(); }
  };

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = ACT[el.dataset.act];
    if (fn) fn(el, ev);
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target, ds = el.dataset;
    if (ds.bind) {
      var path = ds.bind.split('.'), val = el.value;
      if (path.length === 2) S[path[0]][path[1]] = val; else S[path[0]] = val;
      save();
      if (!document.querySelector('.modal')) render();
    } else if (ds.femto) {
      S.femto[ds.femto] = el.checked; save(); render();
    } else if (ds.sym !== undefined) {
      var cur = (S.symptoms[today()] || []).filter(function (x) { return x !== +ds.sym; });
      if (el.checked) cur.push(+ds.sym);
      S.symptoms[today()] = cur; save(); render();
    } else if (ds.med) {
      var c = S.meds.filter(function (x) { return x.id === ds.med; })[0];
      if (ds.f === 'enabled') c.enabled = el.checked;
      else if (ds.f === 'freq') c.freq = el.value;
      else c.days = clamp(parseInt(el.value, 10) || 0, 0, 120);
      S.hisAt = ''; save(); render();
    } else if (ds.price) {
      S.prices[ds.price] = el.value === '' ? '' : Math.max(0, +el.value || 0); save();
    } else if (ds.photo && el.files && el.files[0]) {
      readPhoto(el.files[0], ds.photo);
    }
  });

  function readPhoto(file, id) {
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var max = 600, k = Math.min(1, max / Math.max(im.width, im.height));
        var cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        S.photos[id] = cv.toDataURL('image/jpeg', 0.8);
        save(); render(); toast('照片已更新');
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && document.querySelector('.modal')) { closeModal(); render(); } });

  /* ---------- 啟動 ---------- */
  if (location.hash === '#demo' && !S.patient.surgery) loadDemo();
  if (canSpeak()) {
    pickVoice();
    try { window.speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* 略過 */ }
    window.addEventListener('pagehide', stopSpeak);
  }
  render();
  speakUi();
  probePhotos();
  tick();
  setInterval(tick, 20000);

  window.__app = { state: function () { return S; }, rank: rankIols, slots: slotsFor };
})();
