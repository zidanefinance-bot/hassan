(function () {
  // Business details: change these in one place.
  var CONFIG = {
    whatsapp: "923001234567",
    phoneDisplay: "+92 300 1234567",
    email: "sales@zidane.com.pk",
    city: "Karachi, Pakistan"
  };

  var $ = function (id) { return document.getElementById(id); };
  var pkr = function (v) { return "PKR " + Math.round(v).toLocaleString("en-US"); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };

  document.querySelectorAll("[data-cfg]").forEach(function (n) { var v = CONFIG[n.dataset.cfg]; if (v) n.textContent = v; });
  document.querySelectorAll("[data-wa]").forEach(function (a) { a.href = "https://wa.me/" + CONFIG.whatsapp; });
  if ($("year")) $("year").textContent = new Date().getFullYear();

  // Island nav: burger morphs to X and opens the full-screen menu
  var burger = $("burger"), overlay = $("overlay");
  if (burger && overlay) {
    var setMenu = function (open) {
      overlay.classList.toggle("open", open);
      overlay.setAttribute("aria-hidden", String(!open));
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.documentElement.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", function () { setMenu(!overlay.classList.contains("open")); });
    overlay.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  }

  // Scroll entry: arm only what starts below the first screen, reveal as it enters
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.remove("pre"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    document.querySelectorAll(".rv").forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add("pre"); io.observe(el); }
    });
  }

  // Anything marked data-item adds that item to the quote request
  document.querySelectorAll("[data-item]").forEach(function (a) {
    a.addEventListener("click", function () {
      var cur = store.get("zidane.needs") || "";
      var item = a.dataset.item;
      if (cur.indexOf(item) === -1) store.set("zidane.needs", (cur ? cur + "\n" : "") + item + ": ");
    });
  });

  // Ration calculator
  var calc = $("calc");
  if (calc) {
    var fam = $("families"), totalEl = $("total");
    var selectedPack = function () { return calc.querySelector('input[name="pack"]:checked'); };
    var families = function () { var n = Math.floor(Number(fam.value)); return n > 0 ? Math.min(n, 100000) : 0; };
    var updateTotal = function () { totalEl.textContent = pkr(families() * Number(selectedPack().dataset.price)); };
    calc.querySelectorAll('input[name="pack"]').forEach(function (r) { r.addEventListener("change", updateTotal); });
    fam.addEventListener("input", updateTotal);
    fam.addEventListener("blur", function () { if (!families()) fam.value = 1; updateTotal(); });
    var bump = function (d) { fam.value = Math.max(1, families() + d); updateTotal(); };
    $("minus").addEventListener("click", function () { bump(families() > 50 ? -50 : -10); });
    $("plus").addEventListener("click", function () { bump(families() >= 50 ? 50 : 10); });
    updateTotal();
    calc.addEventListener("submit", function (e) {
      e.preventDefault();
      var p = selectedPack(), price = Number(p.dataset.price);
      store.set("zidane.needs", families() + " x " + p.value + " ration packs (" + pkr(price) + " each, est. " + pkr(families() * price) + ")");
      store.set("zidane.freq", "Ramadan or seasonal");
      window.location.href = calc.getAttribute("action") || "contact.html";
    });
  }

  // Quote form
  var form = $("quote-form");
  if (form) {
    var needs = $("q-needs"), done = $("done");
    var fields = Array.prototype.slice.call(form.querySelectorAll(".field, .form-foot, .seg"));
    var saved = store.get("zidane.needs");
    if (saved && !needs.value) needs.value = saved;
    var freq = store.get("zidane.freq");
    if (freq) $("q-freq").value = freq;

    // Two intents share one form: a quote, or opening a customer account (#customer)
    var mode = function () { return $("q-type-customer").checked ? "customer" : "quote"; };
    var applyMode = function () {
      var c = mode() === "customer";
      $("c-title").innerHTML = c ? 'Become a customer. <em class="red">Order at wholesale rates.</em>' : 'Tell us what you need. <em class="red">We\'ll price it.</em>';
      $("q-needs-label").textContent = c ? "What will you order regularly?" : "What do you need?";
    };
    var fromHash = function () { if (location.hash === "#customer") { $("q-type-customer").checked = true; applyMode(); } };
    form.querySelectorAll('input[name="q-type"]').forEach(function (r) { r.addEventListener("change", applyMode); });
    window.addEventListener("hashchange", fromHash);
    fromHash();

    var setErr = function (id, msg) {
      var input = $(id), err = $(id + "-err");
      err.textContent = msg || "";
      if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
      return !msg;
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (id) { return $(id).value.trim(); };
      var ok = true, first = null;
      var check = function (id, msg) { var good = setErr(id, msg); if (!good && !first) first = id; ok = ok && good; };
      check("q-name", v("q-name") ? "" : "Add your name so we know who to reply to.");
      check("q-phone", v("q-phone").replace(/\D/g, "").length >= 10 ? "" : "Enter a phone number with at least 10 digits.");
      check("q-needs", v("q-needs") ? "" : "List the items and rough quantities you need.");
      if (!ok) { $(first).focus(); return; }
      var lines = [
        mode() === "customer" ? "Assalam o Alaikum Zidane team, I'd like to become a customer." : "Assalam o Alaikum Zidane team, I'd like a quote.",
        "",
        "Name: " + v("q-name"),
        v("q-company") ? "Organisation: " + v("q-company") : null,
        "Phone: " + v("q-phone"),
        v("q-industry") ? "Industry: " + v("q-industry") : null,
        "Delivery city: " + (v("q-city") || "Karachi"),
        "Frequency: " + v("q-freq"),
        "",
        mode() === "customer" ? "Regular order:" : "Items needed:",
        v("q-needs")
      ].filter(function (l) { return l !== null; });
      var text = lines.join("\n");
      $("msg").textContent = text;
      $("wa-link").href = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(text);
      $("mail-link").href = "mailto:" + CONFIG.email + "?subject=" + encodeURIComponent((mode() === "customer" ? "New customer: " : "Quote request from ") + (v("q-company") || v("q-name"))) + "&body=" + encodeURIComponent(text);
      store.del("zidane.needs"); store.del("zidane.freq");
      fields.forEach(function (f) { f.hidden = true; });
      done.hidden = false;
      var h = done.querySelector("h3"); h.setAttribute("tabindex", "-1"); h.focus();
    });
    ["q-name", "q-phone", "q-needs"].forEach(function (id) { $(id).addEventListener("input", function () { setErr(id, ""); }); });
    $("edit-btn").addEventListener("click", function () { done.hidden = true; fields.forEach(function (f) { f.hidden = false; }); needs.focus(); });
    var copyBtn = $("copy-btn");
    copyBtn.addEventListener("click", function () {
      var label = copyBtn.lastChild, msg = $("msg");
      var selectIt = function () { var r = document.createRange(); r.selectNodeContents(msg); var s = getSelection(); s.removeAllRanges(); s.addRange(r); label.textContent = "Selected, press Ctrl+C"; };
      try {
        navigator.clipboard.writeText(msg.textContent).then(function () { label.textContent = "Copied"; setTimeout(function () { label.textContent = "Copy message"; }, 2000); }, selectIt);
      } catch (err) { selectIt(); }
    });
  }
})();
