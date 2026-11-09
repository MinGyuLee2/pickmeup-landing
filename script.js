(() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const span = (p, a, b) => clamp((p - a) / (b - a));
  const $ = (id) => document.getElementById(id);

  // 0..1 progress of a tall .scene while its sticky child is pinned
  const progress = (el) => {
    const r = el.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total) : 0;
  };
  const stageOf = (p, stops) => stops.reduce((s, v, i) => (p >= v ? i : s), 0);
  const setBeats = (scene, beat) => {
    scene.querySelectorAll('.beat').forEach((el, i) => {
      el.classList.toggle('is-on', i === beat);
      el.classList.toggle('is-past', i < beat);
    });
    const n = scene.querySelector('[data-num]');
    if (n) n.textContent = String(beat + 1).padStart(2, '0');
  };
  const typed = (text, t) => text.slice(0, Math.round(clamp(t) * text.length));
  const setText = (el, v) => { if (el.textContent !== v) el.textContent = v; };

  /* ---------- Hero ---------- */
  const hero = $('hero');
  const heroSteps = [...hero.querySelectorAll('[data-step]')];
  const heroScene = hero.querySelector('.hero');
  const updateHero = () => {
    const p = progress(hero);
    const idx = Math.min(heroSteps.length - 1, Math.floor(p * heroSteps.length * 1.05));
    heroSteps.forEach((el, i) => {
      el.classList.toggle('is-on', i === idx);
      el.classList.toggle('is-past', i < idx);
    });
    const brand = idx === heroSteps.length - 1;
    heroScene.classList.toggle('is-brand', brand);
    hero.dataset.theme = brand ? 'dark' : 'light';
  };

  /* ---------- Before: everything follows the scroll — messages, the one unanswered call, then the calm text ---------- */
  const before = $('before');
  const chatPhone = $('chatPhone');
  const items = [...document.querySelectorAll('#thread .tb')];
  const MSG_N = items.length - 1; // the last item is the call card
  const typing = $('typing');
  const titles = [...$('beforeTitle').children];
  const calm = $('beforeCalm'), beforeNotif = $('beforeNotif');
  const clock = $('chatClock'), callScr = $('callScr'), callText = $('callText');
  const CLOCKS = ['6:28', '6:29', '6:31', '6:34', '6:37', '6:39'];
  // scroll timeline (0..1 of the pinned scene)
  const B = { msgs: [0.03, 0.42], call: 0.44, fail: 0.58, card: 0.64, after: 0.76, notif: 0.8 };
  const updateBefore = () => {
    const p = progress(before);
    const f = span(p, B.msgs[0], B.msgs[1]) * (MSG_N + 0.6);
    const n = Math.min(Math.floor(f), MSG_N);
    items.forEach((m, i) => m.classList.toggle('is-on', i < MSG_N ? i < n : p >= B.card));
    const next = items[n];
    typing.classList.toggle('is-on', p < B.msgs[1] && n < MSG_N && next.classList.contains('tb--in') && f - n > 0.4);

    const calling = p >= B.call && p < B.card;
    const failed = p >= B.fail && p < B.card;
    const after = p >= B.after;
    chatPhone.dataset.screen = after ? 'lock' : calling ? 'call' : 'thread';
    callScr.classList.toggle('is-failed', failed);
    setText(callText, failed ? '응답 없음' : '호출 중');
    setText(clock, after ? '6:28' : p >= B.card ? '6:41' : calling ? '6:40' : CLOCKS[Math.min(n, CLOCKS.length - 1)]);
    beforeNotif.classList.toggle('is-on', p >= B.notif);
    calm.classList.toggle('is-on', after);
    titles[0].classList.toggle('is-on', !after);
    titles[1].classList.toggle('is-on', after);
  };

  /* ---------- Fit fixed-size device mockups into their slots ---------- */
  const fit = (wrap, el, max = 1.2, apply = true) => {
    const w = el.offsetWidth, h = el.offsetHeight;
    const s = Math.min(wrap.clientWidth / w, wrap.clientHeight / h, max);
    const x = (wrap.clientWidth - w * s) / 2, y = (wrap.clientHeight - h * s) / 2;
    if (apply) el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    return { x, y, s };
  };
  const cdWrap = $('cdWrap'), cd = $('cd'), ipWrap = $('ipWrap'), iphone = $('iphone'), chatWrap = $('chatWrap');
  let ipScale = 1;
  const fitAll = () => { fit(cdWrap, cd, 1.15); ipScale = fit(ipWrap, iphone, 1.15).s; fit(chatWrap, chatPhone, 1.15); };

  /* ---------- Driver: Gleo + vehicle display ---------- */
  const driver = $('driver');
  const cdRoute = $('cdRoute'), cdTrace = $('cdTrace');
  const CL = cdRoute.getTotalLength();
  const cdCar = $('cdCar'), cdApp = $('cdApp'), cdEta = $('cdEta'), cdGuide = $('cdGuide');
  const cdState = $('cdState'), cdStateText = $('cdStateText'), cdToast = $('cdToast');
  const gleo = $('gleo'), gleoUser = $('gleoUser'), gleoReply = $('gleoReply');
  const D_BEATS = [0, 0.18, 0.36, 0.62, 0.82];
  const D_DRIVE = [0.22, 0.8];
  const ALERT = 7 / 12; // 5 of 12 minutes left
  const D_ALERT = D_DRIVE[0] + (D_DRIVE[1] - D_DRIVE[0]) * ALERT;
  const GLEO = [
    { from: 0.02, to: 0.32, user: '지연이에게 도착 예정이라고 알려줘', reply: '지연 님에게 도착 예정 문자를 보냈어요.', replyAt: 0.19 },
    { from: 0.65, to: 0.8, user: '지연이 나왔어?', reply: '네, 지연 님이 방금 나왔어요.', replyAt: 0.72 },
    { from: 0.83, to: 0.98, user: '픽업 끝났어, 공유 종료해', reply: '공유를 종료했어요. 좋은 하루 보내세요!', replyAt: 0.9 },
  ];

  const updateDriver = () => {
    const p = progress(driver);
    const beat = stageOf(p, D_BEATS);
    setBeats(driver, beat);

    // route + car
    const t = span(p, D_DRIVE[0], D_DRIVE[1]);
    const drawn = span(p, 0.18, 0.24);
    if (p < D_DRIVE[0]) {
      cdRoute.style.strokeDasharray = `${drawn * CL} ${CL}`;
      cdTrace.style.opacity = 0;
    } else {
      cdRoute.style.strokeDasharray = `0 ${t * CL} ${CL}`;
      cdTrace.style.opacity = 1;
    }
    const over = p >= 0.9;
    cdRoute.style.opacity = over ? 0 : 1;
    if (over) cdTrace.style.opacity = 0;
    const guide = t >= 1 ? '<b>도착</b> 회사 정문 부근' : t > 0.8 ? '<b>150m</b> 좌회전 · 국제금융로' : '<b>300m</b> 우회전 · 여의대로';
    if (cdGuide.innerHTML !== guide) cdGuide.innerHTML = guide;
    const a = cdRoute.getPointAtLength(t * CL);
    const b = cdRoute.getPointAtLength(Math.min(CL, t * CL + 6));
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
    cdCar.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${ang.toFixed(0)})`);

    // vehicle app
    cdApp.dataset.state = p < 0.19 ? 'idle' : p < 0.9 ? 'share' : 'ended';
    const mins = Math.max(1, Math.ceil(12 * (1 - t) - 1e-6));
    setText(cdEta, t >= 1 ? '0' : String(mins));
    let s = 'wait', st = '링크 확인 대기';
    if (p >= D_ALERT) { s = 'alerted'; st = '‘곧 도착’ 알림 보냄'; }
    if (beat >= 3) { s = 'out'; st = '지연 님이 나왔어요'; }
    cdState.dataset.s = s;
    setText(cdStateText, st);
    cdToast.classList.toggle('is-on', p >= D_ALERT && p < D_ALERT + 0.05);

    // Gleo
    const g = GLEO.find((x) => p >= x.from && p < x.to);
    gleo.classList.toggle('is-on', !!g);
    if (g) {
      setText(gleoUser, typed(g.user, span(p, g.from, g.from + 0.05)));
      const showReply = p >= g.replyAt;
      setText(gleoReply, showReply ? g.reply : '');
      gleoReply.classList.toggle('is-on', showReply);
    }
  };

  /* ---------- Rider: lock screen → Messages → link → live page ---------- */
  const rider = $('rider');
  const lockNotif = $('lockNotif'), smsLink = $('smsLink'), webReady = $('webReady');
  const webRoute = $('webRoute'), webCar = $('webCar'), webEta = $('webEta');
  const webLoad = $('webLoad'), webPage = $('webPage'), banner = $('iosBanner'), tap = $('tap');
  const WL = webRoute.getTotalLength();
  const R_DRIVE = [0.3, 0.86];
  const R_ALERT = R_DRIVE[0] + (R_DRIVE[1] - R_DRIVE[0]) * ALERT;
  const R_BEATS = [0, 0.14, 0.3, R_ALERT, 0.72, 0.88];
  const screenRect = () => iphone.querySelector('.iphone__screen').getBoundingClientRect();
  const placeTap = (el) => {
    const sr = screenRect(), r = el.getBoundingClientRect();
    tap.style.left = ((r.left + r.width / 2 - sr.left) / ipScale) + 'px';
    tap.style.top = ((r.top + r.height / 2 - sr.top) / ipScale) + 'px';
  };

  const updateRider = () => {
    const p = progress(rider);
    const beat = stageOf(p, R_BEATS);
    setBeats(rider, beat);

    iphone.dataset.screen = p < 0.14 ? 'lock' : p < 0.3 ? 'msg' : 'web';
    lockNotif.classList.toggle('is-on', p >= 0.04);

    // simulated taps: notification → link → "나왔어요"
    let target = null;
    if (p >= 0.1 && p < 0.14) target = lockNotif;
    else if (p >= 0.24 && p < 0.3) target = smsLink;
    else if (p >= 0.72 && p < 0.76) target = webReady;
    tap.classList.toggle('is-on', !!target);
    if (target) placeTap(target);

    // page load
    const load = span(p, 0.3, 0.34);
    webLoad.style.width = load * 100 + '%';
    webLoad.style.opacity = load > 0 && load < 1 ? 1 : 0;
    webPage.style.opacity = 0.2 + 0.8 * span(p, 0.31, 0.34);

    // live car
    const t = span(p, R_DRIVE[0], R_DRIVE[1]);
    const pt = webRoute.getPointAtLength(t * WL);
    webCar.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    const mins = Math.max(1, Math.ceil(12 * (1 - t) - 1e-6));
    setText(webEta, t >= 1 ? '곧 만나요 ·' : `약 ${mins}분`);

    banner.classList.toggle('is-on', beat === 3);
    webReady.classList.toggle('is-pressed', p >= 0.76);
    iphone.classList.toggle('is-ended', p >= 0.88);
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateHero(); updateBefore(); updateDriver(); updateRider();
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { fitAll(); onScroll(); });
  fitAll();
  onScroll();
  document.fonts?.ready.then(() => { fitAll(); onScroll(); });

  /* ---------- Fade-in blocks ---------- */
  const fades = document.querySelectorAll('.block .title, .promise, .moment, .flow li, .outro > *');
  fades.forEach((el) => el.setAttribute('data-fade', ''));
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }),
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );
  fades.forEach((el) => io.observe(el));
})();
