(function () {
  'use strict';

  var NBSP = ' ';
  // Настройки компании приходят из index.html (window.SITE), их собирает leads-tools/make_site.py
  var SITE = window.SITE || {};
  var WA_NUMBER = SITE.wa || '77000000000';
  var CUR = SITE.currency || '₸';
  var PRICES = SITE.prices || {};
  var KK = document.documentElement.lang === 'kk'; // казахская версия страницы

  var TYPES = {
    cosmetic: { name: KK ? 'косметикалық' : 'косметический', price: PRICES.cosmetic || 18000, daysPerM2: 0.45, minDays: 14 },
    capital: { name: KK ? 'күрделі' : 'капитальный', price: PRICES.capital || 45000, daysPerM2: 1.0, minDays: 35 },
    design: { name: KK ? 'дизайн-жоба бойынша' : 'по дизайн-проекту', price: PRICES.design || 75000, daysPerM2: 1.35, minDays: 49 }
  };

  function money(n, sep) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep || NBSP);
  }
  function weeksWord(n) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return 'недели';
    return 'недель';
  }

  /* калькулятор */
  var area = document.getElementById('area');
  var areaOut = document.getElementById('area-out');
  var sum = document.getElementById('sum');
  var term = document.getElementById('term');
  var waCalc = document.getElementById('wa-calc');
  var waDock = document.getElementById('wa-dock');

  function update() {
    var m2 = Number(area.value);
    var checked = document.querySelector('input[name=type]:checked');
    var t = TYPES[checked ? checked.value : 'capital'];
    var step = t.price >= 5000 ? 50000 : 5000; // тенге и сумы округляем крупнее, рубли мельче
    var total = Math.round(m2 * t.price / step) * step;
    var weeks = Math.ceil(Math.max(t.minDays, m2 * t.daysPerM2) / 7);

    areaOut.textContent = m2 + NBSP + 'м²';
    sum.textContent = KK ? money(total) + NBSP + CUR + NBSP + 'бастап' : 'от' + NBSP + money(total) + NBSP + CUR;
    term.textContent = KK ? 'шамамен ' + weeks + NBSP + 'апта' : 'около ' + weeks + NBSP + weeksWord(weeks);
    area.setAttribute('aria-valuetext', m2 + (KK ? ' шаршы метр' : ' квадратных метров'));

    var msg = KK ? 'Сәлеметсіз бе! Жөндеу керек: ' + m2 + ' м², ' + t.name + '. Сайттағы есеп: ' + money(total, ' ') + ' ' + CUR + ' бастап, шамамен ' + weeks + ' апта. Өлшеуге қашан келе аласыздар?' : 'Здравствуйте! Нужен ремонт: ' + m2 + ' м², ' + t.name +
      '. Расчёт на сайте: от ' + money(total, ' ') + ' ' + CUR + ', около ' + weeks + ' ' + weeksWord(weeks) +
      '. Когда можно замер?';
    var href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);
    waCalc.href = href;
    if (waDock) waDock.href = href;
  }
  if (area) {
    area.addEventListener('input', update);
    document.querySelectorAll('input[name=type]').forEach(function (r) { r.addEventListener('change', update); });
    update();
  }

  /* этап ремонта: подпись и передача значения в 3D-сцену */
  var stage = document.getElementById('stage');
  var range = document.getElementById('stage-range');
  var stageName = document.getElementById('stage-name');
  var stageWeek = document.getElementById('stage-week');
  var STAGES = KK ? [
    [0.12, 'Бетон қорап', '1-күн'],
    [0.46, 'Сылақ және сырлау', '1–3-апта'],
    [0.63, 'Еден және плинтус', '4–5-апта'],
    [0.97, 'Жиһаз және жарық', '6–7-апта'],
    [2, 'Дайын бөлме', '8-апта']
  ] : [
    [0.12, 'Бетонная коробка', 'день 1'],
    [0.46, 'Штукатурка и покраска', 'недели 1–3'],
    [0.63, 'Полы и плинтус', 'недели 4–5'],
    [0.97, 'Мебель и свет', 'недели 6–7'],
    [2, 'Готовая комната', 'неделя 8']
  ];
  function setStage(p) {
    for (var i = 0; i < STAGES.length; i++) {
      if (p <= STAGES[i][0]) {
        stageName.textContent = STAGES[i][1];
        stageWeek.textContent = STAGES[i][2];
        break;
      }
    }
    document.dispatchEvent(new CustomEvent('room:stage', { detail: { p: p } }));
  }
  if (range) {
    var playing = null;
    range.addEventListener('input', function () {
      if (playing) { cancelAnimationFrame(playing); playing = null; }
      setStage(Number(range.value) / 100);
    });
    // 3D загрузилось: показываем ползунок и один раз проигрываем ремонт от бетона до готового
    document.addEventListener('room:ready', function () {
      stage.hidden = false;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { setStage(1); return; }
      var start = null, DUR = 5200;
      function tick(ts) {
        if (start === null) start = ts + 400;
        var k = Math.min(1, Math.max(0, (ts - start) / DUR));
        range.value = Math.round(k * 100);
        setStage(k);
        playing = k < 1 ? requestAnimationFrame(tick) : null;
      }
      // проигрываем, когда комната реально видна на экране; до этого она остаётся готовой
      var seen = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        seen.disconnect();
        playing = requestAnimationFrame(tick);
      }, { threshold: 0.6 });
      seen.observe(document.getElementById('room-view'));
    });
  }

  /* маска телефона +7 */
  var tel = document.getElementById('f-tel');
  function formatTel(value) {
    var d = value.replace(/\D/g, '');
    if (d.charAt(0) === '8' || d.charAt(0) === '7') d = d.slice(1);
    d = d.slice(0, 10);
    var s = '+7';
    if (d.length > 0) s += ' (' + d.slice(0, 3);
    if (d.length >= 3) s += ')';
    if (d.length > 3) s += ' ' + d.slice(3, 6);
    if (d.length > 6) s += '-' + d.slice(6, 8);
    if (d.length > 8) s += '-' + d.slice(8, 10);
    return { text: s, digits: d.length };
  }
  if (tel) {
    tel.addEventListener('focus', function () { if (!tel.value) tel.value = '+7 ('; });
    tel.addEventListener('input', function () { tel.value = formatTel(tel.value).text; });
    tel.addEventListener('blur', function () { if (formatTel(tel.value).digits === 0) tel.value = ''; });
  }

  /* форма заявки: в демо никуда не отправляется */
  var form = document.getElementById('lead-form');
  var err = document.getElementById('form-error');
  var done = document.getElementById('form-done');
  var started = Date.now();
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      if (form.company.value || Date.now() - started < 2500) return; // ловушка для ботов
      var problem = '';
      if (!form.name.value.trim()) problem = KK ? 'Атыңызды жазыңыз.' : 'Напишите, как к вам обращаться.';
      else if (formatTel(form.tel.value).digits < 10) problem = KK ? 'Нөмірде цифр жетпейді. +7-ден кейін 10 цифр керек.' : 'В номере не хватает цифр. Нужно 10 после +7.';
      else if (!form.agree.checked) problem = KK ? 'Деректерді өңдеуге келісім беріңіз, онсыз өтінімді қабылдай алмаймыз.' : 'Отметьте согласие на обработку данных, без него не можем принять заявку.';
      if (problem) { err.textContent = problem; err.hidden = false; return; }
      var btn = form.querySelector('button[type=submit]');
      var name = form.name.value.trim(), phone = form.tel.value;
      function finish(text) {
        if (text) done.textContent = text;
        btn.hidden = true;
        done.hidden = false;
      }
      if (SITE.form === 'whatsapp') {
        // заявка уходит владельцу сообщением в WhatsApp, сервер не нужен
        var text = KK ? 'Сайттан өлшеуге өтінім. Аты: ' + name + '. Телефон: ' + phone + '.' : 'Заявка на замер с сайта. Имя: ' + name + '. Телефон: ' + phone + '.';
        finish(KK ? 'WhatsApp ашылады. «Жіберу» батырмасын басыңыз, жұмыс күні ішінде қайта қоңырау шаламыз.' : 'Открываем WhatsApp. Нажмите «Отправить», и мы перезвоним в течение рабочего дня.');
        window.location.href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
      } else if (SITE.form === 'endpoint' && SITE.endpoint) {
        // заявка уходит на сервер-пересыльщик (leads-tools/telegram-worker.js), тот пишет в Telegram владельца
        btn.disabled = true;
        fetch(SITE.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, tel: phone, page: location.href })
        }).then(function (r) {
          if (!r.ok) throw new Error('status ' + r.status);
          finish();
        }).catch(function () {
          btn.disabled = false;
          err.textContent = (KK ? 'Өтінім жіберілмеді. Қайталап көріңіз немесе қоңырау шалыңыз: ' : 'Заявка не отправилась. Попробуйте ещё раз или позвоните: ') + (SITE.phone || '') + '.';
          err.hidden = false;
        });
      } else {
        finish(); // демо: заявка никуда не отправляется
      }
    });
  }
})();
