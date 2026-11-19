/* ==========================================================
   ご利用料金 概算シミュレーター — App Logic
   ========================================================== */
(function () {
  'use strict';

  var CONFIG = null;
  var currentStep = 1;
  var TOTAL_STEPS = 3;
  var answers = {};

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

    renderPrint(c);
  }

  /* ---------- Render Print ---------- */
  function renderPrint(c) {
    var now = new Date();
    document.getElementById('print-date').textContent =
      now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 作成';
    document.getElementById('print-facility-name').textContent = CONFIG.facilityName;
    document.getElementById('print-heading').textContent = c.heading + '（概算）';

    var at = document.getElementById('print-answers-table');
    at.innerHTML = '';
    [['エリア', c.areaLabel], ['ご利用方法', c.usageLabel],
     ['要介護度', c.clLabel], ['自己負担割合', c.brLabel]
    ].forEach(function (p) {
      var r = document.createElement('tr');
      r.innerHTML = '<th>' + esc(p[0]) + '</th><td style="text-align:left;">' + esc(p[1]) + '</td>';
      at.appendChild(r);
    });

    var t = document.getElementById('print-breakdown-table');
    t.innerHTML = '<tr><th>項目</th><td>金額</td></tr>';
    c.insRows.concat(c.nonRows).forEach(function (d) { prow(t, d.label, d.val); });
    c.totals.forEach(function (tt) {
      var tr = document.createElement('tr');
      tr.className = 'total-row';
      tr.innerHTML = '<th>' + esc(tt.label) + '</th><td>約 ' + yen(tt.amount) + '円</td>';
      t.appendChild(tr);
    });

    var pd = document.getElementById('print-doc-checklist');
    pd.innerHTML = '';
    CONFIG.documentsToBring.forEach(function (d) {
      var li = document.createElement('li'); li.textContent = d.label; pd.appendChild(li);
    });

    var di = document.getElementById('print-disclaimers');
    di.innerHTML = '';
    c.notes.filter(function (n) { return n !== CONFIG.notes.additions; })
      .map(function (n) { return n.replace(/^※/, ''); })
      .concat(CONFIG.disclaimers)
      .forEach(function (d) {
        var li = document.createElement('li'); li.textContent = d; di.appendChild(li);
      });
  }

  /* ---------- Helpers ---------- */
  function money(val) { return typeof val === 'number' ? yen(val) + '円' : esc(val); }
  function row(tbl, lbl, val, sub) {
    var tr = document.createElement('tr');
    if (sub) tr.className = 'subtotal';
    tr.innerHTML = '<td>' + esc(lbl) + '</td><td>' + money(val) + '</td>';
    tbl.appendChild(tr);
  }
  function prow(tbl, lbl, val) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<th>' + esc(lbl) + '</th><td>' + money(val) + '</td>';
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

    document.getElementById('btn-print').addEventListener('click', function () {
      showScreen('screen-print');
    });

    document.getElementById('btn-back-result').addEventListener('click', function () {
      showScreen('screen-result');
    });

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
