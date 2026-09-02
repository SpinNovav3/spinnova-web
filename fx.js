/* ============================================================
   fx.js — couche d'effets « pro & futuriste » (additive)
   - fond vivant : grille néon en perspective + particules (canvas)
   - apparitions au scroll (IntersectionObserver, cascade)
   - cartes en relief qui suivent la souris (tilt)
   - hero orchestré : titre mot par mot, parallaxe de la table
   - compteurs animés, bande rooms défilante, barre de lecture,
     curseur lumineux
   Léger : un seul canvas, DPR plafonné, pause onglet caché,
   tout coupé si « réduire les animations ».
   ============================================================ */
(function () {
    'use strict';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var root = document.documentElement;
    root.classList.add('fx');

    /* ---------- éléments d'ambiance ---------- */
    var bg = document.createElement('canvas'); bg.id = 'fx-bg'; document.body.prepend(bg);
    var grain = document.createElement('div'); grain.id = 'fx-grain'; document.body.appendChild(grain);
    var prog = document.createElement('div'); prog.id = 'fx-progress'; document.body.appendChild(prog);
    var cursor = document.createElement('div'); cursor.id = 'fx-cursor'; document.body.appendChild(cursor);

    /* ---------- fond : grille perspective + particules ---------- */
    var ctx = bg.getContext('2d'), W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    var parts = [], t = 0, running = !reduce;
    function resize() {
        W = window.innerWidth; H = window.innerHeight;
        bg.width = W * DPR; bg.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        parts = [];
        var n = Math.min(140, Math.floor(W * H / 14000));
        for (var i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, v: Math.random() * 0.25 + 0.08, a: Math.random() * Math.PI * 2, c: Math.random() < 0.6 ? '56,214,245' : '124,77,255' });
    }
    function draw() {
        if (!running) return;
        t += 0.004;
        ctx.clearRect(0, 0, W, H);
        /* grille néon en perspective, bas de l'écran, très discrète */
        var horizon = H * 0.62, gy = H * 0.72;
        ctx.lineWidth = 1;
        for (var i = 0; i < 14; i++) {
            var p = ((i / 14) + (t * 0.35 % 1)) % 1;
            var y = horizon + (H - horizon) * (p * p);
            var al = 0.10 * p;
            ctx.strokeStyle = 'rgba(124,77,255,' + al.toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        for (var k = -10; k <= 10; k++) {
            var x0 = W / 2 + k * (W / 20), x1 = W / 2 + k * (W * 0.16);
            ctx.strokeStyle = 'rgba(56,214,245,0.06)';
            ctx.beginPath(); ctx.moveTo(x0, horizon); ctx.lineTo(x1, H + 40); ctx.stroke();
        }
        /* voile qui fond la grille dans le fond */
        var g = ctx.createLinearGradient(0, horizon - 40, 0, gy + 80);
        g.addColorStop(0, 'rgba(6,4,15,1)'); g.addColorStop(1, 'rgba(6,4,15,0)');
        ctx.fillStyle = g; ctx.fillRect(0, horizon - 40, W, 120);
        /* particules */
        for (var j = 0; j < parts.length; j++) {
            var q = parts[j];
            q.y -= q.v; q.x += Math.sin(t * 3 + q.a) * 0.15;
            if (q.y < -4) { q.y = H + 4; q.x = Math.random() * W; }
            var tw = 0.35 + 0.35 * Math.sin(t * 6 + q.a);
            ctx.fillStyle = 'rgba(' + q.c + ',' + tw.toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
        }
        requestAnimationFrame(draw);
    }
    resize(); window.addEventListener('resize', resize);
    if (running) requestAnimationFrame(draw);
    document.addEventListener('visibilitychange', function () {
        if (reduce) return;
        if (document.hidden) { running = false; } else if (!running) { running = true; requestAnimationFrame(draw); }
    });

    /* ---------- barre de lecture + topbar ---------- */
    function onScroll() {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
        root.classList.toggle('fx-scrolled', window.scrollY > 24);
    }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    /* ---------- curseur lumineux ---------- */
    if (!reduce && window.matchMedia('(pointer: fine)').matches) {
        var cx = -999, cy = -999, tx = cx, ty = cy;
        window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; root.classList.add('fx-mouse'); }, { passive: true });
        (function loop() { cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18; cursor.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; requestAnimationFrame(loop); })();
    }

    /* ---------- apparitions au scroll ---------- */
    /* Les titres de section restent toujours visibles : seules les cartes apparaissent. */
    var revealSel = '.step, .pillar, .tool-card, .price, .feat-card, .brick, .geste, .tool-block, .showcase, .final-box, .faq-item, .mode';
    var items = Array.prototype.slice.call(document.querySelectorAll(revealSel));
    var groups = {};
    items.forEach(function (el) {
        el.classList.add('fx-reveal');
        var parent = el.parentElement; var key = parent ? parent : el;
        groups[key.dataset.fxg || (key.dataset.fxg = Math.random().toString(36).slice(2))] = (groups[key.dataset.fxg] || 0) + 1;
        el.style.setProperty('--fx-delay', ((groups[key.dataset.fxg] - 1) % 6) * 80 + 'ms');
    });
    function revealAll() { items.forEach(function (el) { el.classList.add('fx-in'); }); }
    /* Vérification directe (en plus de l'observer) : rien ne doit rester invisible,
       même si l'observer ne se déclenche pas (onglet en arrière-plan, viewport nul...). */
    function revealCheck() {
        var vh = window.innerHeight || 900;
        items.forEach(function (el) {
            if (el.classList.contains('fx-in')) return;
            var r = el.getBoundingClientRect();
            if (r.top < vh * 1.05) el.classList.add('fx-in');
        });
    }
    if (reduce) { revealAll(); }
    else {
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('fx-in'); io.unobserve(en.target); } });
            }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
            items.forEach(function (el) { io.observe(el); });
        }
        window.addEventListener('scroll', revealCheck, { passive: true });
        window.addEventListener('resize', revealCheck);
        window.addEventListener('load', revealCheck);
        setTimeout(revealCheck, 250);
        setTimeout(revealCheck, 1200);
        setTimeout(revealAll, 5000); /* filet de sécurité absolu */
    }

    /* ---------- cartes en relief ---------- */
    if (!reduce && window.matchMedia('(pointer: fine)').matches) {
        document.querySelectorAll('.pillar, .tool-card, .price, .step, .feat-card, .brick, .mode').forEach(function (card) {
            card.classList.add('fx-tilt');
            card.addEventListener('mousemove', function (e) {
                var r = card.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
                card.style.setProperty('--mx', (px * 100) + '%'); card.style.setProperty('--my', (py * 100) + '%');
                card.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
                card.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg');
            });
            card.addEventListener('mouseleave', function () { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
        });
    }

    /* ---------- hero : titre mot par mot + parallaxe de la table ---------- */
    var h1 = document.querySelector('.hero h1');
    if (h1 && !reduce) {
        var idx = 0;
        function wrapWords(node) {
            Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
                if (ch.nodeType === 3) {
                    var frag = document.createDocumentFragment();
                    ch.textContent.split(/(\s+)/).forEach(function (w) {
                        if (!w) return;
                        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
                        var s = document.createElement('span'); s.className = 'fx-word'; s.textContent = w;
                        s.style.setProperty('--d', (120 + idx++ * 90) + 'ms'); frag.appendChild(s);
                    });
                    node.replaceChild(frag, ch);
                } else if (ch.nodeType === 1 && ch.tagName !== 'BR') { wrapWords(ch); }
            });
        }
        wrapWords(h1);
    }
    var scene = document.querySelector('.spin-scene');
    if (scene && !reduce && window.matchMedia('(pointer: fine)').matches) {
        var hero = scene.closest('.hero') || document.body;
        hero.addEventListener('mousemove', function (e) {
            var r = hero.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
            scene.style.transform = 'perspective(1200px) rotateY(' + (px * 8).toFixed(2) + 'deg) rotateX(' + (-py * 6).toFixed(2) + 'deg)';
        });
        hero.addEventListener('mouseleave', function () { scene.style.transform = ''; });
    }

    /* ---------- compteurs (prix) ---------- */
    var amounts = document.querySelectorAll('.price .amount');
    if (amounts.length && !reduce && 'IntersectionObserver' in window) {
        var io2 = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return; io2.unobserve(en.target);
                var el = en.target, textNode = null;
                el.childNodes.forEach(function (n) { if (n.nodeType === 3 && /\d/.test(n.textContent)) textNode = n; });
                if (!textNode) return;
                var target = parseInt(textNode.textContent.replace(/\D/g, ''), 10); if (isNaN(target)) return;
                var start = performance.now(), dur = 900;
                (function step(now) {
                    var p = Math.min(1, (now - start) / dur); p = 1 - Math.pow(1 - p, 3);
                    textNode.textContent = String(Math.round(target * p));
                    if (p < 1) requestAnimationFrame(step);
                })(start);
            });
        }, { threshold: 0.4 });
        amounts.forEach(function (a) { io2.observe(a); });
    }

    /* ---------- bande rooms défilante ---------- */
    var band = document.querySelector('.rooms-band');
    if (band && !reduce) {
        var lab = band.querySelector('.lab');
        var names = Array.prototype.filter.call(band.children, function (c) { return c !== lab; });
        if (names.length) {
            var track = document.createElement('div'); track.className = 'fx-marquee';
            for (var rpt = 0; rpt < 2; rpt++) names.forEach(function (n) { track.appendChild(rpt === 0 ? n : n.cloneNode(true)); });
            band.appendChild(track);
        }
    }
})();
