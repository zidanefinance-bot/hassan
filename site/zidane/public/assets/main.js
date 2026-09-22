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

  // Mobile menu
  var nav = $("nav"), menuBtn = $("menu-btn");
  if (nav && menuBtn) {
    var close = function () { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); menuBtn.textContent = "Menu"; };
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.textContent = open ? "Close" : "Menu";
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
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
    var fields = Array.prototype.slice.call(form.querySelectorAll(".field, .form-foot"));
    var saved = store.get("zidane.needs");
    if (saved && !needs.value) needs.value = saved;
    var freq = store.get("zidane.freq");
    if (freq) $("q-freq").value = freq;

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
        "Assalam o Alaikum Zidane team, I'd like a quote.",
        "",
        "Name: " + v("q-name"),
        v("q-company") ? "Organisation: " + v("q-company") : null,
        "Phone: " + v("q-phone"),
        v("q-industry") ? "Industry: " + v("q-industry") : null,
        "Delivery city: " + (v("q-city") || "Karachi"),
        "Frequency: " + v("q-freq"),
        "",
        "Items needed:",
        v("q-needs")
      ].filter(function (l) { return l !== null; });
      var text = lines.join("\n");
      $("msg").textContent = text;
      $("wa-link").href = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(text);
      $("mail-link").href = "mailto:" + CONFIG.email + "?subject=" + encodeURIComponent("Quote request from " + (v("q-company") || v("q-name"))) + "&body=" + encodeURIComponent(text);
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
