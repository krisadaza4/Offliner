/* ============================================================
   App logic + GSAP motion choreography
   Backend socket protocol is preserved verbatim:
     emit  'request' { token, website }
     on     token -> { progress: <string|"Converting"|"Completed">, file }
     fetch '/sites/<file>.zip'
   ============================================================ */
(function () {
  "use strict";

  var hasGSAP = typeof gsap !== "undefined";
  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  if (hasGSAP && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ---------- element refs ---------- */
  var $ = function (s) { return document.querySelector(s); };
  var input        = $("#website");
  var goBtn        = $("#download-btn");
  var consoleEl    = $("#console");
  var statusPill   = $("#status-pill");
  var statusText   = $("#status-text");
  var hostPill     = $("#host-pill");
  var hostName     = $("#host-name");
  var statFiles    = $("#stat-files");
  var statProgress = $("#stat-progress");
  var statTime     = $("#stat-time");
  var bar          = $("#bar");
  var progressPct  = $("#progress-pct");
  var progressLbl  = $("#progress-label");
  var term         = $("#term");
  var downloadReady= $("#download-ready");
  var getZip       = $("#get-zip");
  var restart      = $("#restart");

  /* ============================================================
     1. Entrance + scroll choreography (GSAP)
     ============================================================ */
  function splitTitle(el) {
    if (!el) return [];
    var words = [];
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.innerHTML = "";
    nodes.forEach(function (node) {
      if (node.nodeType === 3) { // text
        node.textContent.split(/(\s+)/).forEach(function (chunk) {
          if (chunk.trim() === "") { el.appendChild(document.createTextNode(chunk)); return; }
          var w = document.createElement("span");
          w.className = "reveal-word";
          w.textContent = chunk;
          el.appendChild(w);
          words.push(w);
        });
      } else { // element (e.g. the .grad span) — animate as one unit
        var w = document.createElement("span");
        w.className = "reveal-word";
        w.appendChild(node);
        el.appendChild(w);
        words.push(w);
      }
    });
    return words;
  }

  function intro() {
    if (!hasGSAP || reduce) {
      document.querySelectorAll("[data-reveal]").forEach(function (n) { n.style.opacity = 1; });
      // jump count-ups straight to their final values (no animation)
      document.querySelectorAll("[data-count]").forEach(function (el) {
        el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
      });
      return;
    }
    var title = document.querySelector("[data-hero-title]");
    var words = splitTitle(title);

    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from("[data-hero]", { y: 18, opacity: 0, duration: 0.7, stagger: 0.12 }, 0.1)
      .from(words, { yPercent: 120, opacity: 0, duration: 0.9, stagger: 0.06, ease: "power4.out" }, 0.18)
      .from("[data-hero-window]", { y: 60, opacity: 0, scale: 0.97, duration: 1.0, ease: "power3.out" }, 0.4);

    // scroll reveals
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      gsap.fromTo(el, { y: 40, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%" }
      });
    });

    // count-up trust stats
    gsap.utils.toArray("[data-count]").forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-suffix") || "";
      var obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.4, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 92%" },
        onUpdate: function () { el.textContent = Math.round(obj.v) + suffix; }
      });
    });
  }

  /* ---------- magnetic buttons ---------- */
  function magnetic(el, strength) {
    if (!hasGSAP || reduce || isTouch || !el) return;
    strength = strength || 0.4;
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) * strength;
      var y = (e.clientY - r.top - r.height / 2) * strength;
      gsap.to(el, { x: x, y: y, duration: 0.4, ease: "power3.out" });
    });
    el.addEventListener("mouseleave", function () {
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    });
  }

  /* ---------- app-window tilt parallax ---------- */
  function tilt() {
    if (!hasGSAP || reduce || isTouch) return;
    var win = document.querySelector("[data-hero-window]");
    var hero = document.querySelector(".hero");
    if (!win || !hero) return;
    gsap.set(win, { transformPerspective: 1200, transformOrigin: "center" });
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      var rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
      var ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
      gsap.to(win, { rotateX: rx, rotateY: ry, duration: 0.6, ease: "power2.out" });
    });
    hero.addEventListener("mouseleave", function () {
      gsap.to(win, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "power2.out" });
    });
  }

  intro();
  magnetic(goBtn, 0.35);
  magnetic($(".nav-cta"), 0.3);
  tilt();

  /* ============================================================
     2. Download state + helpers
     ============================================================ */
  var numberOfFiles = 0;
  var startTime = 0;
  var timer = null;
  var lastFile = null;
  var filesProxy = { v: 0 };

  function escapeHTML(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(line) {
    var s = escapeHTML(line);
    s = s.replace(/(200 OK|saved)/g, '<span class="ok">$1</span>');
    s = s.replace(/(https?:\/\/[^\s'"]+)/g, '<span class="url">$1</span>');
    s = s.replace(/(\b\d+%)/g, '<span class="num">$1</span>');
    return s;
  }

  function pushLine(text) {
    var line = (text || "").trim();
    if (!line) return;
    var el = document.createElement("span");
    el.className = "ln";
    el.innerHTML = highlight(line);
    term.appendChild(el);
    // cap DOM size
    while (term.children.length > 80) term.removeChild(term.firstChild);
    term.scrollTop = term.scrollHeight;
    if (hasGSAP && !reduce) {
      gsap.fromTo(el, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" });
    } else {
      el.style.opacity = 1;
    }
  }

  function setProgress(pct, label) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    bar.style.width = pct + "%";
    progressPct.textContent = pct + "%";
    statProgress.innerHTML = pct + '<small>%</small>';
    if (label) progressLbl.textContent = label;
  }

  function setFiles(n) {
    if (hasGSAP && !reduce) {
      gsap.to(filesProxy, {
        v: n, duration: 0.5, ease: "power2.out", overwrite: true,
        onUpdate: function () { statFiles.textContent = Math.round(filesProxy.v); }
      });
    } else {
      statFiles.textContent = n;
    }
  }

  // honest asymptotic bar: we don't know the total, so creep toward ~92%
  function fileProgress(files) {
    return Math.min(92, Math.round(92 * (1 - 1 / (1 + files * 0.12))));
  }

  function tick() {
    var s = Math.floor((Date.now() - startTime) / 1000);
    statTime.innerHTML = s + '<small>s</small>';
  }

  function normalizeUrl(v) {
    v = (v || "").trim();
    if (!v) return "";
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    return v;
  }

  function resetUI() {
    numberOfFiles = 0;
    filesProxy.v = 0;
    lastFile = null;
    term.innerHTML = "";
    setFiles(0);
    setProgress(0, "Resolving host…");
    statTime.innerHTML = '0<small>s</small>';
    downloadReady.classList.remove("is-active");
    statusPill.classList.remove("done");
    statusText.textContent = "Connecting…";
    hostPill.hidden = true;
  }

  function revealConsole() {
    if (consoleEl.classList.contains("is-active")) return;
    consoleEl.classList.add("is-active");
    if (hasGSAP && !reduce) {
      gsap.from(consoleEl, { height: 0, opacity: 0, duration: 0.5, ease: "power3.out",
        onComplete: function () { if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh(); } });
    }
  }

  function setBusy(b) {
    goBtn.setAttribute("data-busy", b ? "true" : "false");
    input.disabled = b;
  }

  /* ============================================================
     3. Socket wiring  (protocol preserved)
     ============================================================ */
  var socket = io();

  if (!localStorage["token"]) localStorage["token"] = generateToken(20);
  var token = localStorage["token"];

  socket.on(token, function (event) {
    if (!event || typeof event.progress === "undefined") return;

    if (event.progress === "Converting") {
      setProgress(100, "Compressing into a ZIP…");
      statusText.textContent = "Compressing";
      pushLine("Mirror complete — compressing files…");
      return;
    }

    if (event.progress === "Completed") {
      completeDownload(event.file);
      return;
    }

    var msg = String(event.progress);

    // capture the resolved host for the pill
    if (hostPill.hidden) {
      var hostMatch = msg.match(/Resolving\s+([^\s]+)\s+\(/) ||
                      msg.match(/Connecting to\s+([^\s|(]+)/);
      if (hostMatch && hostMatch[1]) {
        hostName.textContent = hostMatch[1];
        hostPill.hidden = false;
        if (hasGSAP && !reduce) gsap.from(hostPill, { scale: 0.7, opacity: 0, duration: 0.4, ease: "back.out(2)" });
      }
    }

    // count saved files exactly like the original
    if (msg.includes("200 OK")) {
      numberOfFiles++;
      setFiles(numberOfFiles);
      setProgress(fileProgress(numberOfFiles), "Downloading assets…");
      statusText.textContent = "Mirroring";
    }

    pushLine(msg);
  });

  function completeDownload(file) {
    if (timer) { clearInterval(timer); timer = null; }
    lastFile = file;
    setProgress(100, "Done — your archive is ready");
    statusText.textContent = "Completed";
    statusPill.classList.add("done");
    setBusy(false);
    pushLine("Archive ready: " + file + ".zip");
    downloadReady.classList.add("is-active");

    if (hasGSAP && !reduce) {
      gsap.fromTo(downloadReady, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
      gsap.fromTo("#get-zip", { scale: 0.9 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)", delay: 0.1 });
    }
    magnetic(getZip, 0.3);
  }

  /* ---------- start a download ---------- */
  function startDownload() {
    var website = normalizeUrl(input.value);
    if (!website) {
      input.focus();
      if (hasGSAP && !reduce) gsap.fromTo(".url-field", { x: -6 }, { x: 0, duration: 0.4, ease: "elastic.out(1.5, 0.4)" });
      return;
    }
    input.value = website;

    setBusy(true);
    revealConsole();
    resetUI();
    statusText.textContent = "Starting…";

    startTime = Date.now();
    if (timer) clearInterval(timer);
    tick();
    timer = setInterval(tick, 1000);

    socket.emit("request", { token: token, website: website });

    if (hasGSAP && !reduce) {
      consoleEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  goBtn.addEventListener("click", startDownload);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); startDownload(); }
  });

  // sample chips
  document.querySelectorAll(".sample").forEach(function (chip) {
    chip.addEventListener("click", function () {
      input.value = chip.getAttribute("data-url");
      startDownload();
    });
  });

  // grab the finished zip
  getZip.addEventListener("click", function () {
    if (lastFile) window.location = "/sites/" + lastFile + ".zip";
  });

  // mirror another site
  restart.addEventListener("click", function () {
    resetUI();
    consoleEl.classList.remove("is-active");
    input.value = "";
    input.focus();
    if (hasGSAP && !reduce) {
      var win = document.querySelector("[data-hero-window]");
      if (win) win.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  /* ---------- token helper (unchanged) ---------- */
  function generateToken(n) {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var t = "";
    for (var i = 0; i < n; i++) t += chars[Math.floor(Math.random() * chars.length)];
    return t;
  }
})();
