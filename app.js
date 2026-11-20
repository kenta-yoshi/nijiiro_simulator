/* ==========================================================
   ご利用料金 概算シミュレーター — App Logic
   ========================================================== */
(function () {
  'use strict';

  var CONFIG = null;
  var currentStep = 1;
  var TOTAL_STEPS = 3;
  var answers = {};
  var lastResult = null;

  /* ---------- Init ---------- */
  async function init() {
    try {
      var res = await fetch('config.json');
      CONFIG = await res.json();
    } catch (e) {
      document.body.innerHTML =
        '<div style="padding:48px 24px;text-align:center;font-family:sans-serif;">' +
        '<h2>設定ファイルの読み込みに失敗しました</h2>' +
        '<p style="margin-top:12px;">config.json が同じフォルダにあるか確認してください。<br>' +
        'ローカルファイルの場合は簡易サーバー経由で開いてください。<br><br>' +
        '<code style="background:#f5f5f5;padding:4px 10px;border-radius:6px;">' +
        'python -m http.server 8000</code></p></div>';
      return;
    }
    buildDynamicUI();
    bindEvents();
    if (sessionStorage.getItem('nijiiro_unlocked')) {
      showScreen('screen-top');
    } else {
      showScreen('screen-lock');
    }
    document.getElementById('facility-name-top').textContent = CONFIG.facilityName;
  }

  /* ---------- Dynamic UI Build ---------- */
  function buildDynamicUI() {
    buildRadios('q-area', 'area', CONFIG.areas.map(function (a) {
      return {
        id: a.id,
        label: a.label,
        description: a.available ? '' : '料金は準備中です',
        disabled: !a.available
      };
    }));
    buildRadios('q-usage',      'usage',      CONFIG.usageTypes);
    buildRadios('q-careLevel',  'careLevel',  CONFIG.careLevels);
    buildRadios('q-burdenRate', 'burdenRate', CONFIG.burdenRates);
  }

  function buildRadios(containerId, name, items) {
    var c = document.getElementById(containerId);
    c.innerHTML = '';
    items.forEach(function (item) {
      var lbl = document.createElement('label');
      lbl.className = 'choice' + (item.disabled ? ' is-disabled' : '');
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = name; inp.value = item.id;
      inp.disabled = !!item.disabled;
      var sp = document.createElement('span');
      sp.textContent = item.label;
      if (item.description) {
        var desc = document.createElement('span');
        desc.className = 'card-desc';
        desc.textContent = item.description;
        sp.appendChild(desc);
      }
      lbl.appendChild(inp);
      lbl.appendChild(sp);
      c.appendChild(lbl);
    });
  }

  /* ---------- Screen / Step ---------- */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  }

  function showStep(n) {
    currentStep = n;
    document.querySelectorAll('.step').forEach(function (s) { s.classList.remove('active'); });
    var el = document.querySelector('.step[data-step="' + n + '"]');
    if (el) el.classList.add('active');
    updateProgress();
    updateNav();
    window.scrollTo(0, 0);
  }

  function updateProgress() {
    var pct = ((currentStep - 1) / TOTAL_STEPS) * 100;
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('step-indicator').textContent = 'Step ' + currentStep + ' / ' + TOTAL_STEPS;
  }

  function updateNav() {
    document.getElementById('btn-prev').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    document.getElementById('btn-next').textContent = currentStep === TOTAL_STEPS ? '結果を見る' : '次へ';
  }

  /* ---------- Answers ---------- */
  function collectAnswers() {
    ['area', 'usage', 'careLevel', 'burdenRate'].forEach(function (n) {
      var el = document.querySelector('input[name="' + n + '"]:checked');
      answers[n] = el ? el.value : null;
    });
  }

  /* ---------- Validation ---------- */
  function validateCurrentStep() {
    collectAnswers();
    var req = [];
    switch (currentStep) {
      case 1: req = ['area']; break;
      case 2: req = ['usage']; break;
      case 3: req = ['careLevel', 'burdenRate']; break;
    }
    for (var i = 0; i < req.length; i++) {
      if (!answers[req[i]]) {
        alert('すべての質問にお答えください。');
        return false;
      }
    }
    return true;
  }

  /* ---------- Calculation ---------- */
  function findById(arr, id) {
    for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) return arr[i]; }
    return null;
  }

  // 単位数 × 地域単価（1円未満切り捨て）。浮動小数の誤差を避けるため整数で計算する
  function unitsToYen(units, unitPrice) {
    return Math.floor(units * Math.round(unitPrice * 100) / 100);
  }

  // 利用者負担額 = 費用 −（費用 × 保険給付割合（1円未満切り捨て））
  function burdenOf(yen, percent) {
    return yen - Math.floor(yen * (100 - percent) / 100);
  }

  function calculate() {
    var area = findById(CONFIG.areas, answers.area);
    var p    = area.pricing || findById(CONFIG.areas, area.pricingFrom).pricing;
    var cl   = findById(CONFIG.careLevels, answers.careLevel);
    var br   = findById(CONFIG.burdenRates, answers.burdenRate);
    var st   = findById(p.serviceTimes, p.serviceTimeId);
    var unitsPerDay = st.units[cl.id];
    var brLabel = br.displayLabel || br.label;
    var serviceLabel = p.serviceName + '（' + cl.label + '・' + st.label + '）';

    var r = {
      type: answers.usage,
      areaLabel: area.label, clLabel: cl.label, brLabel: brLabel,
      usageLabel: findById(CONFIG.usageTypes, answers.usage).label,
      insRows: [], nonRows: [], totals: [],
      notes: [CONFIG.notes.additions]
    };
    if (br.note) r.notes.unshift(br.note);

    if (answers.usage === 'day') {
      var ins = burdenOf(unitsToYen(unitsPerDay, p.unitPrice), br.percent);
      r.heading = '1日あたりのご利用料金';
      r.insRows.push({ label: serviceLabel + ' ' + brLabel + '負担', val: ins });
      r.insSubtotal = ins;
      r.nonRows.push({ label: '昼食代', val: p.fees.lunch });
      r.nonRows.push({ label: '夕食代（希望者のみ）', val: p.fees.dinner });
      r.nonRows.push({ label: '交通費（送迎）', val: '無料' });
      r.totals.push({ label: '夕食なしの場合', amount: ins + p.fees.lunch });
      r.totals.push({ label: '夕食ありの場合', amount: ins + p.fees.lunch + p.fees.dinner });
      r.unit = '円/日';
    } else {
      var days = p.monthly.days, nights = p.monthly.nights;
      var totalUnits  = unitsPerDay * days;
      var withinUnits = Math.min(totalUnits, cl.limitUnits);
      var withinYen   = unitsToYen(withinUnits, p.unitPrice);
      var excessYen   = unitsToYen(totalUnits, p.unitPrice) - withinYen;
      var withinBurden = burdenOf(withinYen, br.percent);

      r.heading = '1ヶ月（' + days + '日）宿泊した場合のご利用料金';
      r.insRows.push({
        label: serviceLabel + ' ' + days + '日分' +
          (excessYen > 0 ? '／限度額内 ' : ' ') + brLabel + '負担',
        val: withinBurden
      });
      if (excessYen > 0) {
        r.insRows.push({ label: '区分支給限度額の超過分（全額自己負担）', val: excessYen });
        r.notes.push(CONFIG.notes.limitExceeded);
      }
      r.insSubtotal = withinBurden + excessYen;

      var stay = p.fees.stay * nights, lunch = p.fees.lunch * days, dinner = p.fees.dinner * days;
      r.nonRows.push({ label: '宿泊代（朝食代含む） ' + yen(p.fees.stay) + '円×' + nights + '泊', val: stay });
      r.nonRows.push({ label: '昼食代 ' + yen(p.fees.lunch) + '円×' + days + '日', val: lunch });
      r.nonRows.push({ label: '夕食代 ' + yen(p.fees.dinner) + '円×' + days + '日', val: dinner });
      r.nonSubtotal = stay + lunch + dinner;
      r.totals.push({ label: '月額合計', amount: r.insSubtotal + r.nonSubtotal });
      r.unit = '円/月';
    }
    return r;
  }

  /* ---------- Render Result ---------- */
  function renderResult() {
    var c = calculate();
    lastResult = c;

    document.getElementById('result-heading').textContent = c.heading;
    document.getElementById('result-conditions').textContent =
      c.areaLabel + '／' + c.clLabel + '／' + c.brLabel + '負担';

    var ta = document.getElementById('total-amount');
    if (c.totals.length === 1) {
      ta.className = 'total-display';
      ta.innerHTML = '約 <strong>' + yen(c.totals[0].amount) + '</strong><small>' + esc(c.unit) + '</small>';
    } else {
      ta.className = 'total-pair';
      ta.innerHTML = c.totals.map(function (t) {
        return '<div class="total-item"><span class="total-item-label">' + esc(t.label) + '</span>' +
          '<span class="total-item-value">約 ' + yen(t.amount) + '<small>' + esc(c.unit) + '</small></span></div>';
      }).join('');
    }

    var ins = document.getElementById('breakdown-insurance');
    ins.innerHTML = '';
    c.insRows.forEach(function (d) { row(ins, d.label, d.val); });
    if (c.insRows.length > 1) row(ins, '小計', c.insSubtotal, true);

    var non = document.getElementById('breakdown-non-insurance');
    non.innerHTML = '';
    c.nonRows.forEach(function (d) { row(non, d.label, d.val); });
    if (c.nonSubtotal !== undefined) row(non, '小計', c.nonSubtotal, true);

    var notes = document.getElementById('result-notes');
    notes.innerHTML = '';
    c.notes.forEach(function (n) {
      var div = document.createElement('div');
      div.className = 'notice';
      div.textContent = n;
      notes.appendChild(div);
    });

    var dl = document.getElementById('doc-checklist');
    dl.innerHTML = '';
    CONFIG.documentsToBring.forEach(function (d) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="doc-check"></span><div><span class="doc-label">' +
        esc(d.label) + '</span><br><span class="doc-note">' + esc(d.note) + '</span></div>';
      dl.appendChild(li);
    });

    var di = document.getElementById('result-disclaimers');
    di.innerHTML = '';
    CONFIG.disclaimers.forEach(function (d) {
      var li = document.createElement('li'); li.textContent = d; di.appendChild(li);
    });

    var now = new Date();
    document.getElementById('result-foot').textContent = CONFIG.facilityName + '　' +
      now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 作成';

    document.getElementById('breakdown-accordion').open = true;
  }

  /* ---------- Download as image ---------- */
  // 結果をcanvasに直接描く。文字幅の計測と描画を同じcanvasで行うため、ブラウザ差で文字が重ならない
  var IMG = {
    W: 720, PAD: 24, SCALE: 2,
    font: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif",
    text: '#333333', sub: '#666666', border: '#E5E5E5', line: '#f0f0f0',
    sec: '#F7F9F8', primary: '#8DBD3C', accent: '#D84F83', accentBg: '#fdf0f4'
  };
  var NO_LINE_START = '、。，．）」』】％・ー！？';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function paintResult(ctx, c, logo) {
    var W = IMG.W, PAD = IMG.PAD, y = 32;

    function font(size, bold) { ctx.font = (bold ? '600 ' : '400 ') + size + 'px ' + IMG.font; }
    function wrap(str, maxW) {
      var lines = [], cur = '';
      for (var i = 0; i < str.length; i++) {
        var ch = str[i];
        if (cur && ctx.measureText(cur + ch).width > maxW && NO_LINE_START.indexOf(ch) === -1) {
          lines.push(cur); cur = ch;
        } else { cur += ch; }
      }
      if (cur) lines.push(cur);
      return lines;
    }
    // 折り返して描画し、描いた高さを返す
    function para(str, x, top, maxW, o) {
      font(o.size, o.bold);
      var lh = Math.round(o.size * (o.lh || 1.6));
      var lines = wrap(str, maxW);
      ctx.fillStyle = o.color || IMG.text;
      ctx.textBaseline = 'middle';
      ctx.textAlign = o.align || 'left';
      var tx = o.align === 'center' ? x + maxW / 2 : (o.align === 'right' ? x + maxW : x);
      lines.forEach(function (ln, i) { ctx.fillText(ln, tx, top + lh * i + lh / 2); });
      return lines.length * lh;
    }
    function paraHeight(str, maxW, o) {
      font(o.size, o.bold);
      return wrap(str, maxW).length * Math.round(o.size * (o.lh || 1.6));
    }
    function box(x, top, w, h, r, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(x + r[0], top);
      ctx.arcTo(x + w, top, x + w, top + h, r[1]);
      ctx.arcTo(x + w, top + h, x, top + h, r[2]);
      ctx.arcTo(x, top + h, x, top, r[3]);
      ctx.arcTo(x, top, x + w, top, r[0]);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }
    function hline(x, top, w, color, lw) {
      ctx.fillStyle = color; ctx.fillRect(x, top, w, lw || 1);
    }
    function filledNote(str, x, top, w, o) {
      var h = paraHeight(str, w - 28, o) + 24;
      box(x, top, w, h, [14, 14, 14, 14], o.bg);
      para(str, x + 14, top + 12, w - 28, o);
      return h;
    }
    // 「約 1,807 円/日」のように大きさの違う文字を、幅を測って順に並べる
    function amount(parts, rightX, midY) {
      var widths = parts.map(function (p) { font(p.size, p.bold); return ctx.measureText(p.t).width; });
      var x = rightX - widths.reduce(function (a, b) { return a + b; }, 0);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = IMG.text;
      parts.forEach(function (p, i) {
        font(p.size, p.bold);
        ctx.fillText(p.t, x, midY);
        x += widths[i];
      });
    }
    function amountWidth(parts) {
      return parts.reduce(function (sum, p) { font(p.size, p.bold); return sum + ctx.measureText(p.t).width; }, 0);
    }
    function money(v) { return typeof v === 'number' ? yen(v) + '円' : v; }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, 100000);

    if (logo) {
      var lh = 64, lw = logo.naturalWidth * lh / logo.naturalHeight;
      ctx.drawImage(logo, (W - lw) / 2, y, lw, lh);
      y += lh + 20;
    }

    y += para('シミュレーション結果', PAD, y, W - PAD * 2, { size: 22, bold: true, align: 'center' }) + 10;
    y += filledNote('こちらは概算の目安です。詳細はご相談時にご確認ください。', PAD, y, W - PAD * 2,
      { size: 14, color: IMG.sub, align: 'center', bg: IMG.sec }) + 24;

    /* --- 料金カード --- */
    var cardTop = y, cx = PAD + 24, cw = W - PAD * 2 - 48;
    y += 24;
    y += para(c.heading, cx, y, cw, { size: 16, bold: true }) + 10;
    hline(cx, y, cw, IMG.border); y += 16;
    y += para(c.areaLabel + '／' + c.clLabel + '／' + c.brLabel + '負担', cx, y, cw,
      { size: 14, color: IMG.sub, align: 'center' }) + 8;

    if (c.totals.length === 1) {
      var parts = [{ t: '約 ', size: 32, bold: true }, { t: yen(c.totals[0].amount), size: 32, bold: true },
                   { t: ' ' + c.unit, size: 15 }];
      amount(parts, cx + cw / 2 + amountWidth(parts) / 2, y + 42);
      y += 60;
    } else {
      c.totals.forEach(function (t, i) {
        font(15, true); ctx.fillStyle = IMG.text; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(t.label, cx, y + 36);
        amount([{ t: '約 ', size: 24, bold: true }, { t: yen(t.amount), size: 24, bold: true },
                { t: ' ' + c.unit, size: 14 }], cx + cw, y + 36);
        y += 54;
        if (i < c.totals.length - 1) hline(cx, y, cw, IMG.line);
      });
      y += 4;
    }
    y += para('（概算・目安）', cx, y, cw, { size: 13, color: IMG.sub, align: 'center' }) + 16;

    /* --- 内訳 --- */
    var bTop = y, bx = cx + 16, bw = cw - 32;
    box(cx, y, cw, 48, [14, 14, 0, 0], IMG.sec);
    para('費用の内訳', bx, y + 12, bw, { size: 15, bold: true });
    y += 48 + 16;

    function group(title, rows, subtotal) {
      y += para(title, bx, y, bw, { size: 14, bold: true, color: IMG.sub }) + 6;
      rows.concat(subtotal === undefined ? [] : [{ label: '小計', val: subtotal, sub: true }]).forEach(function (r) {
        if (r.sub) { hline(bx, y, bw, IMG.border, 2); y += 2; }
        var v = money(r.val);
        font(14, true);
        var vw = ctx.measureText(v).width;
        var top = y + 8;
        var h = para(r.label, bx, top, bw - vw - 20, { size: 14, bold: !!r.sub });
        font(14, true); ctx.fillStyle = IMG.text; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(v, bx + bw, top + h / 2);
        y = top + h + 8;
        if (!r.sub) hline(bx, y, bw, IMG.line);
      });
      y += 14;
    }
    group('介護保険サービス費', c.insRows, c.insRows.length > 1 ? c.insSubtotal : undefined);
    group('介護保険外（実費）', c.nonRows, c.nonSubtotal);
    y += 2;
    box(cx, bTop, cw, y - bTop, [14, 14, 14, 14], null, IMG.border);
    y += 14;

    c.notes.forEach(function (n) {
      y += filledNote(n, cx, y, cw, { size: 13, color: IMG.accent, bg: IMG.accentBg }) + 12;
    });
    y += 12;
    box(PAD, cardTop, W - PAD * 2, y - cardTop, [16, 16, 16, 16], null, IMG.border);
    y += 24;

    y += para('ご不安な点はお気軽にご相談ください。', PAD, y, W - PAD * 2,
      { size: 15, color: IMG.sub, align: 'center' }) + 24;

    /* --- 書類カード --- */
    cardTop = y; y += 24;
    y += para('ご相談時にお持ちいただく書類', cx, y, cw, { size: 16, bold: true }) + 10;
    hline(cx, y, cw, IMG.border); y += 8;
    CONFIG.documentsToBring.forEach(function (d, i) {
      y += 12;
      box(cx, y + 3, 20, 20, [4, 4, 4, 4], null, '#cccccc');
      y += para(d.label, cx + 32, y, cw - 32, { size: 15, bold: true });
      y += para(d.note, cx + 32, y, cw - 32, { size: 13, color: IMG.sub }) + 12;
      if (i < CONFIG.documentsToBring.length - 1) hline(cx, y, cw, IMG.line);
    });
    y += 12;
    box(PAD, cardTop, W - PAD * 2, y - cardTop, [16, 16, 16, 16], null, IMG.border);
    y += 24;

    /* --- 注意事項 --- */
    y += para('注意事項', PAD, y, W - PAD * 2, { size: 15, bold: true }) + 6;
    CONFIG.disclaimers.forEach(function (d) {
      para('※', PAD, y, 18, { size: 13, color: IMG.sub });
      y += para(d, PAD + 18, y, W - PAD * 2 - 18, { size: 13, color: IMG.sub }) + 6;
    });
    y += 14;
    hline(PAD, y, W - PAD * 2, IMG.border); y += 12;
    y += para(document.getElementById('result-foot').textContent, PAD, y, W - PAD * 2,
      { size: 13, color: IMG.sub, align: 'center' });

    return y + 28;
  }

  function loadLogo() {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = 'nijiiro-logo.png';
    });
  }

  async function buildResultCanvas() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    var logo = await loadLogo();
    var probe = document.createElement('canvas');
    var height = paintResult(probe.getContext('2d'), lastResult, logo);
    var canvas = document.createElement('canvas');
    canvas.width = IMG.W * IMG.SCALE;
    canvas.height = Math.ceil(height) * IMG.SCALE;
    var ctx = canvas.getContext('2d');
    ctx.scale(IMG.SCALE, IMG.SCALE);
    paintResult(ctx, lastResult, logo);
    return canvas;
  }

  async function downloadResultImage() {
    var btn = document.getElementById('btn-download');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '画像を作成中…';
    try {
      var canvas = await buildResultCanvas();
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
      var now = new Date();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nijiiro_ryokin_' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
    } catch (e) {
      alert('画像の作成に失敗しました。お手数ですが、画面のスクリーンショットをご利用ください。');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  /* ---------- Helpers ---------- */
  function money(val) { return typeof val === 'number' ? yen(val) + '円' : esc(val); }
  function row(tbl, lbl, val, sub) {
    var tr = document.createElement('tr');
    if (sub) tr.className = 'subtotal';
    tr.innerHTML = '<td>' + esc(lbl) + '</td><td>' + money(val) + '</td>';
    tbl.appendChild(tr);
  }
  function yen(n) { return Math.round(n).toLocaleString('ja-JP'); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ---------- Events ---------- */
  function bindEvents() {
    document.getElementById('btn-unlock').addEventListener('click', handleUnlock);
    document.getElementById('lock-password').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleUnlock();
    });

    function handleUnlock() {
      var pw = document.getElementById('lock-password').value;
      if (pw === 'nijiiro') {
        sessionStorage.setItem('nijiiro_unlocked', '1');
        showScreen('screen-top');
      } else {
        document.getElementById('lock-error').style.display = 'block';
        document.getElementById('lock-password').value = '';
        document.getElementById('lock-password').focus();
      }
    }

    document.getElementById('btn-start').addEventListener('click', function () {
      showScreen('screen-form'); showStep(1);
    });

    document.getElementById('btn-next').addEventListener('click', function () {
      if (!validateCurrentStep()) return;
      if (currentStep < TOTAL_STEPS) { showStep(currentStep + 1); }
      else { renderResult(); showScreen('screen-result'); }
    });

    document.getElementById('btn-prev').addEventListener('click', function () {
      if (currentStep > 1) showStep(currentStep - 1);
    });

    document.getElementById('btn-download').addEventListener('click', downloadResultImage);

    document.getElementById('btn-back-to-form').addEventListener('click', function () {
      showScreen('screen-form');
      showStep(TOTAL_STEPS);
    });

    document.getElementById('btn-restart').addEventListener('click', function () {
      document.querySelectorAll('input[type="radio"]').forEach(function (r) { r.checked = false; });
      Object.keys(answers).forEach(function (k) { delete answers[k]; });
      showScreen('screen-top');
    });

    // Glossary modal
    var modalBody = document.getElementById('modal-body');
    var imgWrap = document.getElementById('glossary-img-wrap');
    var imgEl = document.getElementById('glossary-img');

    function closeModal() {
      document.getElementById('glossary-modal').style.display = 'none';
      imgWrap.style.display = 'none';
      imgEl.src = '';
      modalBody.classList.remove('modal-body--has-img');
    }

    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('help-btn')) {
        var term = e.target.getAttribute('data-term');
        if (CONFIG.glossary[term]) {
          document.getElementById('glossary-term').textContent = term;
          document.getElementById('glossary-desc').textContent = CONFIG.glossary[term];

          var imgFile = CONFIG.glossaryImages && CONFIG.glossaryImages[term];
          if (imgFile) {
            imgEl.src = imgFile;
            imgEl.alt = term + ' の説明画像';
            imgWrap.style.display = 'block';
            modalBody.classList.add('modal-body--has-img');
          } else {
            imgWrap.style.display = 'none';
            imgEl.src = '';
            modalBody.classList.remove('modal-body--has-img');
          }

          document.getElementById('glossary-modal').style.display = 'flex';
        }
      }
    });
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('glossary-modal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
