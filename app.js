/* ==========================================================
   入居相談＆概算見積シミュレーター — App Logic
   ========================================================== */
(function () {
  'use strict';

  var CONFIG = null;
  var currentStep = 1;
  var TOTAL_STEPS = 6;
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
    showScreen('screen-top');
    document.getElementById('facility-name-top').textContent =
      CONFIG.facilityName + '（' + CONFIG.facilityType + '）';
  }

  /* ---------- Dynamic UI Build ---------- */
  function buildDynamicUI() {
    buildRadios('q-purpose',    'purpose',    CONFIG.purposes);
    buildRadios('q-timeline',   'timeline',   CONFIG.timelines);
    buildRadios('q-careLevel',  'careLevel',  CONFIG.careLevels);
    buildRadios('q-burdenRate', 'burdenRate', CONFIG.burdenRates);
    buildRadios('q-dementia',   'dementia',   CONFIG.dementia);
    buildChecks('q-medical',    'medical',    CONFIG.medicalCareItems);
    buildRoomCards();
    buildRadios('q-mealType',   'mealType',   CONFIG.meals);
    buildChecks('q-options',    'options',     CONFIG.options);
    buildRadios('q-share',      'share',       CONFIG.shareOptions);
  }

  function buildRadios(containerId, name, items) {
    var c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    items.forEach(function (item) {
      var lbl = document.createElement('label');
      lbl.className = 'choice';
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = name; inp.value = item.id;
      var sp = document.createElement('span');
      sp.textContent = item.label;
      lbl.appendChild(inp);
      lbl.appendChild(sp);
      c.appendChild(lbl);
    });
  }

  function buildRoomCards() {
    var c = document.getElementById('q-roomType');
    c.innerHTML = '';
    CONFIG.roomTypes.forEach(function (r) {
      var lbl = document.createElement('label');
      lbl.className = 'choice';
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = 'roomType'; inp.value = r.id;
      var sp = document.createElement('span');
      sp.innerHTML = r.label + '<span class="card-desc">' + r.description + '</span>';
      lbl.appendChild(inp);
      lbl.appendChild(sp);
      c.appendChild(lbl);
    });
  }

  function buildChecks(containerId, groupName, items) {
    var c = document.getElementById(containerId);
    c.innerHTML = '';
    items.forEach(function (item) {
      var lbl = document.createElement('label');
      lbl.className = 'choice';
      var inp = document.createElement('input');
      inp.type = 'checkbox'; inp.name = groupName; inp.value = item.id;

      if (item.id === 'none') {
        inp.addEventListener('change', function () {
          if (this.checked) {
            c.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
              if (cb.value !== 'none') cb.checked = false;
            });
            var oc = document.getElementById(groupName + '-other-container');
            if (oc) oc.style.display = 'none';
          }
        });
      } else {
        inp.addEventListener('change', function () {
          if (this.checked) {
            var none = c.querySelector('input[value="none"]');
            if (none) none.checked = false;
          }
          if (item.id === 'other') {
            var oc = document.getElementById(groupName + '-other-container');
            if (oc) oc.style.display = this.checked ? 'block' : 'none';
          }
        });
      }
      var sp = document.createElement('span');
      sp.textContent = item.label;
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
    ['purpose','timeline','careLevel','burdenRate','reduction',
     'mobility','eating','toilet','bathing','dementia',
     'roomType','mealType','share'].forEach(function (n) {
      var el = document.querySelector('input[name="' + n + '"]:checked');
      answers[n] = el ? el.value : null;
    });
    ['medical','options'].forEach(function (n) {
      var els = document.querySelectorAll('input[name="' + n + '"]:checked');
      answers[n] = Array.from(els).map(function (cb) { return cb.value; });
    });
    var ot = document.getElementById('medical-other-text');
    if (ot) answers.medicalOtherText = ot.value;
  }

  /* ---------- Validation ---------- */
  function validateCurrentStep() {
    collectAnswers();
    var req = [];
    switch (currentStep) {
      case 1: req = ['purpose','timeline']; break;
      case 2: req = ['careLevel','burdenRate','reduction']; break;
      case 3: req = ['mobility','eating','toilet','bathing']; break;
      case 4: req = ['dementia']; break;
      case 5: req = ['roomType','mealType']; break;
      case 6: req = ['share']; break;
    }
    for (var i = 0; i < req.length; i++) {
      if (answers[req[i]] === null || answers[req[i]] === undefined) {
        alert('すべての質問にお答えください。');
        return false;
      }
    }
    if (currentStep === 4 && answers.medical.length === 0) {
      alert('医療的ケアについて選択してください（該当しない場合は「特になし」を選んでください）。');
      return false;
    }
    return true;
  }

  /* ---------- Calculation ---------- */
  function floorTo10(n) { return Math.floor(n / 10) * 10; }

  function findById(arr, id) {
    for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) return arr[i]; }
    return null;
  }

  function calculate() {
    var cl = findById(CONFIG.careLevels, answers.careLevel);
    var br = findById(CONFIG.burdenRates, answers.burdenRate);
    var rt = findById(CONFIG.roomTypes, answers.roomType);
    var ml = findById(CONFIG.meals, answers.mealType);

    var baseFee = cl ? cl.baseCareFeeMonthly : 0;
    var rate    = br ? br.rate : 0.1;

    var addTotal = 0;
    var addDetails = [];
    CONFIG.additions.forEach(function (a) {
      if (a.defaultOn) {
        addTotal += a.feeMonthly;
        addDetails.push({ label: a.label, fee: a.feeMonthly });
      }
    });

    var insPart = (baseFee + addTotal) * rate;

    var housing  = rt ? rt.housingFeeMonthly : 0;
    var mealFee  = ml ? ml.mealFeeMonthly : 0;
    var mealAdd  = ml ? ml.addOnMonthly : 0;
    var optFee = 0;
    var optDetails = [];
    if (answers.options) {
      answers.options.forEach(function (id) {
        var o = findById(CONFIG.options, id);
        if (o) { optFee += o.feeMonthly; optDetails.push({ label: o.label, fee: o.feeMonthly }); }
      });
    }

    var nonIns = housing + mealFee + mealAdd + optFee;
    var total  = insPart + nonIns;

    var redApplied = false;
    var totalRed = total;
    if (answers.reduction === 'yes') {
      redApplied = true;
      var rh = housing * CONFIG.burdenReduction.discountRate;
      var rm = mealFee * CONFIG.burdenReduction.discountRate;
      totalRed = insPart + rh + rm + mealAdd + optFee;
    }

    return {
      baseFee: baseFee, rate: rate,
      brLabel: br ? br.label : '', brNote: br ? br.note : '',
      addTotal: addTotal, addDetails: addDetails,
      insPart: floorTo10(insPart),
      housing: housing, roomLabel: rt ? rt.label : '',
      mealFee: mealFee, mealAdd: mealAdd, mealLabel: ml ? ml.label : '',
      optFee: optFee, optDetails: optDetails,
      nonIns: nonIns,
      total: floorTo10(total),
      redApplied: redApplied, totalRed: floorTo10(totalRed),
      clLabel: cl ? cl.label : '',
      isNone: answers.careLevel === 'none'
    };
  }

  /* ---------- Acceptance ---------- */
  function evaluateAcceptance() {
    var reasons = [];
    var status = 'ok';

    var d = findById(CONFIG.dementia, answers.dementia);
    if (d && d.requiresConsultation) { status = 'consult'; reasons.push(d.reason); }

    if (answers.medical) {
      answers.medical.forEach(function (id) {
        var m = findById(CONFIG.medicalCareItems, id);
        if (m && m.requiresConsultation) {
          status = 'consult';
          reasons.push(m.label + '：' + m.reason);
        }
      });
    }
    return { status: status, reasons: reasons };
  }

  /* ---------- Render Result ---------- */
  function renderResult() {
    var c = calculate();
    var a = evaluateAcceptance();

    // Badge
    var badge = document.getElementById('acceptance-badge');
    if (a.status === 'ok') {
      badge.textContent = '対応可能（目安）';
      badge.className = 'badge ok';
    } else {
      badge.textContent = '要相談';
      badge.className = 'badge consult';
    }

    // Reasons
    var rl = document.getElementById('acceptance-reasons');
    rl.innerHTML = '';
    a.reasons.forEach(function (r) { appendLi(rl, r); });
    if (c.isNone) appendLi(rl, '要介護認定がまだの場合、介護保険分の費用は認定後に確定します。');

    // Total
    document.getElementById('total-amount').innerHTML =
      '月額 約 <strong>' + yen(c.total) + '</strong><small>円/月</small>';

    // Breakdown insurance
    var ins = document.getElementById('breakdown-insurance');
    ins.innerHTML = '';
    row(ins, '基本介護サービス費（' + c.clLabel + '）', c.baseFee);
    c.addDetails.forEach(function (d) { row(ins, d.label, d.fee); });
    row(ins, '小計（' + c.brLabel + '負担）', c.insPart, true);

    // Breakdown non-insurance
    var non = document.getElementById('breakdown-non-insurance');
    non.innerHTML = '';
    row(non, '居住費（' + c.roomLabel + '）', c.housing);
    row(non, '食費（' + c.mealLabel + '）', c.mealFee);
    if (c.mealAdd > 0) row(non, '食事形態加算', c.mealAdd);
    c.optDetails.forEach(function (d) { row(non, d.label, d.fee); });
    row(non, '小計', c.nonIns, true);

    // Notes
    var bn = document.getElementById('burden-note');
    bn.style.display = c.brNote ? 'block' : 'none';
    bn.textContent = c.brNote || '';

    var rn = document.getElementById('reduction-note');
    if (c.redApplied) {
      rn.innerHTML = CONFIG.burdenReduction.note +
        '<br>軽減適用後の目安：<strong>' + yen(c.totalRed) + '円/月</strong>';
      rn.style.display = 'block';
    } else { rn.style.display = 'none'; }

    // FAQ (top 3)
    var fq = document.getElementById('faq-cards');
    fq.innerHTML = '';
    CONFIG.faq.slice(0, 3).forEach(function (f) {
      var div = document.createElement('div');
      div.className = 'faq-item';
      div.innerHTML = '<div class="faq-q">' + esc(f.question) + '</div>' +
        '<div class="faq-a">' + esc(f.answer) + '</div>';
      fq.appendChild(div);
    });

    // Documents
    var dl = document.getElementById('doc-checklist');
    dl.innerHTML = '';
    CONFIG.documentsToBring.forEach(function (d) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="doc-check"></span><div><span class="doc-label">' +
        esc(d.label) + '</span><br><span class="doc-note">' + esc(d.note) + '</span></div>';
      dl.appendChild(li);
    });

    renderPrint(c, a);
  }

  /* ---------- Render Print ---------- */
  function renderPrint(c, a) {
    var now = new Date();
    document.getElementById('print-date').textContent =
      now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 作成';
    document.getElementById('print-facility-name').textContent =
      CONFIG.facilityName + '（' + CONFIG.facilityType + '）';

    var pa = document.getElementById('print-acceptance');
    if (a.status === 'ok') {
      pa.innerHTML = '<strong style="color:#4a7c12;">対応可能（目安）</strong>';
    } else {
      var h = '<strong style="color:#D84F83;">要相談</strong><ul style="margin-top:4px;font-size:0.85rem;">';
      a.reasons.forEach(function (r) { h += '<li>' + esc(r) + '</li>'; });
      h += '</ul>';
      pa.innerHTML = h;
    }

    document.getElementById('print-total').textContent = '月額 約 ' + yen(c.total) + '円';

    var t = document.getElementById('print-breakdown-table');
    t.innerHTML = '<tr><th>項目</th><td>金額（月額）</td></tr>';
    prow(t, '基本介護サービス費（' + c.clLabel + ' × ' + c.brLabel + '）', c.insPart);
    c.addDetails.forEach(function (d) { prow(t, d.label + '（' + c.brLabel + '）', floorTo10(d.fee * c.rate)); });
    prow(t, '居住費（' + c.roomLabel + '）', c.housing);
    prow(t, '食費（' + c.mealLabel + '）', c.mealFee);
    if (c.mealAdd > 0) prow(t, '食事形態加算', c.mealAdd);
    c.optDetails.forEach(function (d) { prow(t, d.label, d.fee); });
    var tr = document.createElement('tr');
    tr.className = 'total-row';
    tr.innerHTML = '<th>合計（税込目安）</th><td>' + yen(c.total) + '円</td>';
    t.appendChild(tr);
    if (c.redApplied) {
      var rr = document.createElement('tr');
      rr.innerHTML = '<th>負担軽減適用後（目安）</th><td>' + yen(c.totalRed) + '円</td>';
      t.appendChild(rr);
    }

    var at = document.getElementById('print-answers-table');
    at.innerHTML = '';
    [['ご相談目的', label(CONFIG.purposes, answers.purpose)],
     ['入居希望時期', label(CONFIG.timelines, answers.timeline)],
     ['要介護度', c.clLabel], ['自己負担割合', c.brLabel],
     ['お部屋タイプ', c.roomLabel], ['食事形態', c.mealLabel]
    ].forEach(function (p) {
      var r = document.createElement('tr');
      r.innerHTML = '<th>' + esc(p[0]) + '</th><td style="text-align:left;">' + esc(p[1]) + '</td>';
      at.appendChild(r);
    });

    var pd = document.getElementById('print-doc-checklist');
    pd.innerHTML = '';
    CONFIG.documentsToBring.forEach(function (d) {
      var li = document.createElement('li'); li.textContent = d.label; pd.appendChild(li);
    });

    var di = document.getElementById('print-disclaimers');
    di.innerHTML = '';
    CONFIG.disclaimers.forEach(function (d) {
      var li = document.createElement('li'); li.textContent = d; di.appendChild(li);
    });
  }

  /* ---------- Helpers ---------- */
  function row(tbl, lbl, val, sub) {
    var tr = document.createElement('tr');
    if (sub) tr.className = 'subtotal';
    tr.innerHTML = '<td>' + esc(lbl) + '</td><td>' + yen(val) + '円</td>';
    tbl.appendChild(tr);
  }
  function prow(tbl, lbl, val) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<th>' + esc(lbl) + '</th><td>' + yen(val) + '円</td>';
    tbl.appendChild(tr);
  }
  function appendLi(ul, text) {
    var li = document.createElement('li'); li.textContent = text; ul.appendChild(li);
  }
  function yen(n) { return Math.round(n).toLocaleString('ja-JP'); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function label(arr, id) { var o = findById(arr, id); return o ? o.label : ''; }

  /* ---------- Events ---------- */
  function bindEvents() {
    document.getElementById('btn-start').addEventListener('click', function () {
      showScreen('screen-form'); showStep(1);
    });

    document.getElementById('btn-next').addEventListener('click', function () {
      if (!validateCurrentStep()) return;
      if (currentStep < TOTAL_STEPS) { showStep(currentStep + 1); }
      else { collectAnswers(); renderResult(); showScreen('screen-result'); }
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
      document.querySelectorAll('input[type="checkbox"]').forEach(function (c) { c.checked = false; });
      var ot = document.getElementById('medical-other-text');
      if (ot) ot.value = '';
      var oc = document.getElementById('medical-other-container');
      if (oc) oc.style.display = 'none';
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

          // Image support
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
