(function () {
  "use strict";
  var D = window.MEV_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var cssv = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };

  /* ---------------- theme ---------------- */
  var root = document.documentElement;
  try { var saved = localStorage.getItem("mev-theme"); if (saved) root.setAttribute("data-theme", saved); else if (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) root.setAttribute("data-theme", "dark"); } catch (e) {}
  $("#themeBtn").addEventListener("click", function () {
    var t = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("mev-theme", t); } catch (e) {}
    drawCharts();
  });

  /* ---------------- router ---------------- */
  var pages = $$(".page");
  var order = pages.map(function (p) { return p.id.slice(2); });
  var navLinks = $$("#nav a");
  function current() { var h = location.hash.replace("#", ""); var id = h.split("/")[0]; return order.indexOf(id) >= 0 ? id : "overview"; }
  function show() {
    var id = current(), sub = location.hash.split("/")[1];
    pages.forEach(function (p) { p.classList.toggle("on", p.id === "p-" + id); });
    navLinks.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + id); });
    var pg = $("#p-" + id);
    $("#crumb").innerHTML = "Docs / <b>" + pg.getAttribute("data-title") + "</b>";
    document.title = pg.getAttribute("data-title") + " · MEV Detector Docs";
    buildToc(pg); addPager(pg, id);
    $("#rail").classList.remove("open");
    drawCharts();
    if (sub) { var t = document.getElementById(sub); if (t) t.scrollIntoView(); } else window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", show);

  function buildToc(pg) {
    var hs = $$("h2[id]", pg), toc = $("#toc");
    if (!hs.length) { toc.style.visibility = "hidden"; return; }
    toc.style.visibility = "visible";
    toc.innerHTML = "<h6>On this page</h6>" + hs.map(function (h) { return '<a href="#' + current() + "/" + h.id + '" data-id="' + h.id + '">' + h.textContent + "</a>"; }).join("");
    $$("a", toc).forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); var t = document.getElementById(a.dataset.id); history.replaceState(null, "", a.getAttribute("href")); t.scrollIntoView({ behavior: "smooth" }); }); });
  }
  window.addEventListener("scroll", function () {
    var hs = $$(".page.on h2[id]"), cur = null;
    hs.forEach(function (h) { if (h.getBoundingClientRect().top < 140) cur = h.id; });
    $$("#toc a").forEach(function (a) { a.classList.toggle("on", a.dataset.id === cur); });
  }, { passive: true });

  function addPager(pg, id) {
    var old = $(".pager", pg); if (old) old.remove();
    var i = order.indexOf(id), prev = order[i - 1], next = order[i + 1];
    var title = function (k) { return $("#p-" + k).getAttribute("data-title"); };
    var d = document.createElement("div"); d.className = "pager";
    d.innerHTML = (prev ? '<a href="#' + prev + '"><small>Previous</small>← ' + title(prev) + "</a>" : "<span></span>") + (next ? '<a class="r" href="#' + next + '"><small>Next</small>' + title(next) + " →</a>" : "<span></span>");
    var foot = $("footer", pg); if (foot) pg.insertBefore(d, foot); else pg.appendChild(d);
  }

  $("#burger").addEventListener("click", function () { $("#rail").classList.toggle("open"); });

  /* ---------------- copy buttons and tabs ---------------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]");
    if (b) {
      var pre = b.closest(".codebox").querySelector("pre"); var txt = pre.innerText;
      var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done); else done();
    }
    var t = e.target.closest("[data-tabs] button");
    if (t) {
      var box = t.closest(".codebox");
      $$("[data-tabs] button", box).forEach(function (x) { x.classList.toggle("on", x === t); });
      $$(".tabpane", box).forEach(function (p) { p.classList.toggle("on", p.dataset.p === t.dataset.t); });
    }
  });

  /* ---------------- rules ---------------- */
  var RULES = [
    { id: "R1", name: "Gas reordering", key: "Gas Reordering", py: "detect_gas_reordering", sol: "checkReordering", sev: 15, cx: "O(n)",
      cond: "At least three transactions have a positive gas price, and the largest gas price exceeds three times the smallest.",
      why: "A wide spread of gas prices in the window can mean that some transactions were placed ahead of others by paying more.", watch: "Gas price spread is common in ordinary traffic, so this rule fires on almost every transaction." },
    { id: "R2", name: "Front-run", key: "Front-Run", py: "detect_front_run", sol: "checkFrontRun", sev: 25, cx: "O(1) on the last two",
      cond: "g(n-1) > 2·g(n), v(n) > 0 and v(n-1) < 0.3·v(n): the previous transaction pays more than twice the gas price of the latest and carries less than 30% of its value.",
      why: "A small, high-gas transaction placed just before a larger one is the shape of a front-run.", watch: "Looks only at the last two transactions in the window." },
    { id: "R3", name: "Back-run", key: "Back-Run", py: "detect_back_run", sol: "checkBackRun", sev: 15, cx: "O(1) on the last two",
      cond: "g(n) > 2·g(n-1), v(n-1) > 0 and v(n) < 0.3·v(n-1): the latest transaction pays more than twice the gas price of the previous one and carries less than 30% of its value.",
      why: "A small, high-gas transaction placed just after a larger one is the shape of a back-run.", watch: "Looks only at the last two transactions in the window." },
    { id: "R4", name: "Repeated transaction", key: "Repeated Transaction", py: "detect_repeated_transaction", sol: "checkRepeatedTransactions", sev: 10, cx: "O(n)",
      cond: "One sender appears at least three times in the window.",
      why: "Attackers and bots often send several transactions in a short time.", watch: "Busy legitimate senders and bots also repeat." },
    { id: "R5", name: "Direction reversal", key: "Direction Reversal", py: "detect_direction_reversal", sol: "checkDirectionReversal", sev: 10, cx: "O(1) on the last two",
      cond: "The last two transactions have the same sender, both have non-empty calldata, and the calldata differs.",
      why: "A sender that does one action and then a different one can be opening and closing a position.", watch: "Calldata is compared as raw data. The rule does not know the swap direction." },
    { id: "R6", name: "Sudden insertion", key: "Sudden Insertion", py: "detect_sudden_insertion", sol: "checkSuddenInsertion", sev: 20, cx: "O(n)",
      cond: "At least three positive gas prices exist, and the latest gas price exceeds three times the mean positive gas price of the window.",
      why: "A late transaction with a much higher gas price can be trying to jump the queue.", watch: "Urgent legitimate transactions also pay more." },
    { id: "R7", name: "Liquidity impact", key: "Liquidity Impact", py: "detect_liquidity_impact", sol: "checkLiquidityImpact", sev: 10, cx: "O(n)",
      cond: "One transaction carries more than half of the total ETH value of the window: 2·v(i) > Σ v(j) with v(i) > 0.",
      why: "A dominant transfer can move a market more than the others.", watch: "Uses ETH value, not pool reserves. Many swaps carry no ETH, so this is a value-concentration rule." },
    { id: "R8", name: "Sandwich pattern", key: "Sandwich Attack", py: "detect_sandwich", sol: "checkSandwich", sev: 40, cx: "O(n³)",
      cond: "There are positions i < j < k such that the transactions at i and k have the same sender, the transaction at j has a different sender, and i and k have the same non-empty calldata.",
      why: "Two matching transactions from one account around a victim transaction are the shape of a sandwich.", watch: "Tests ordered triples (at most 1,140 for n = 20) and takes about 91% of the analysis time. An attacker who changes the calldata of the back-run is not matched." }
  ];
  var total = D.totals.tx, pooled = {};
  RULES.forEach(function (r) { pooled[r.key] = 0; [100, 300, 500, 1000].forEach(function (n) { pooled[r.key] += D.rules.fired[n][r.key]; }); });
  var list = $("#ruleList");
  list.innerHTML = RULES.map(function (r) {
    var c = pooled[r.key], pct = (100 * c / total).toFixed(1);
    return '<details class="rule" data-text="' + (r.id + " " + r.name + " " + r.cond + " " + r.why + " " + r.watch + " " + r.py + " " + r.sol + " " + r.cx).toLowerCase() + '">' +
      '<summary><span class="rid">' + r.id + "</span><h4>" + r.name + '</h4><span class="sev">severity ' + r.sev + " · " + r.cx + "</span></summary>" +
      '<div class="body"><dl><dt>Condition</dt><dd>' + r.cond + "</dd><dt>Idea</dt><dd>" + r.why + "</dd><dt>Watch out</dt><dd>" + r.watch +
      "</dd><dt>Code</dt><dd><code>" + r.py + "</code> · <code>" + r.sol + "</code></dd><dt>Observed</dt><dd>Fired on <b>" + c.toLocaleString() + "</b> of " + total.toLocaleString() + " recorded transactions (" + pct + "%).</dd></dl></div></details>";
  }).join("");
  $("#ruleFilter").addEventListener("input", function () {
    var q = this.value.trim().toLowerCase();
    $$(".rule", list).forEach(function (d) { d.style.display = !q || d.dataset.text.indexOf(q) >= 0 ? "" : "none"; if (q && d.style.display === "") d.open = true; });
  });
  $("#expandAll").addEventListener("click", function () { $$(".rule", list).forEach(function (d) { d.open = true; }); });
  $("#collapseAll").addEventListener("click", function () { $$(".rule", list).forEach(function (d) { d.open = false; }); });

  /* ---------------- score calculator (mirrors calculate_risk_score) ---------------- */
  var ORDER = [["R8", "Sandwich pattern", 40], ["R2", "Front-run", 25], ["R6", "Sudden insertion", 20], ["R1", "Gas reordering", 15], ["R3", "Back-run", 15], ["R4", "Repeated transaction", 10], ["R5", "Direction reversal", 10], ["R7", "Liquidity impact", 10]];
  var checks = $("#checks");
  RULES.forEach(function (r) { checks.insertAdjacentHTML("beforeend", '<label><input type="checkbox" data-r="' + r.id + '"> <b>' + r.id + "</b> " + r.name + "</label>"); });
  function calc() {
    var on = {}; $$("input[data-r]", checks).forEach(function (i) { on[i.dataset.r] = i.checked; });
    var c = Object.keys(on).filter(function (k) { return on[k]; }).length;
    var w = c <= 1 ? 10 : c <= 3 ? 20 : 30, s = 0, name = "Normal";
    for (var i = 0; i < ORDER.length; i++) { if (on[ORDER[i][0]]) { s = ORDER[i][2]; name = ORDER[i][1]; break; } }
    var a = $("#gasAnom").checked ? 10 : 0, S = Math.min(100, w + s + a);
    var lvl = S <= 34 ? "LOW" : S <= 69 ? "MEDIUM" : "HIGH";
    $("#scoreVal").textContent = S; var l = $("#scoreLvl"); l.textContent = lvl; l.className = "lvl " + lvl;
    $("#cVal").textContent = c; $("#wVal").textContent = w; $("#sName").textContent = name; $("#sVal").textContent = s; $("#aVal").textContent = a;
    $("#gaugeMark").style.left = "calc(" + S + "% - 2px)";
    $("#advice").textContent = lvl === "LOW" ? "[ALLOW]  The monitor would not raise this window." : lvl === "MEDIUM" ? "[MONITOR]  The window shows signals worth watching." : "[BLOCK]  Reachable only with the sandwich rule. The monitor still only labels.";
  }
  $$("input", $("#p-scoring")).forEach(function (i) { i.addEventListener("change", calc); }); calc();

  /* ---------------- charts (inline SVG) ---------------- */
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, txt) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; }
  function svg(w, h) { return el("svg", { viewBox: "0 0 " + w + " " + h, role: "img" }); }
  function fmt(v, d) { return v >= 100 ? v.toFixed(0) : v.toFixed(d == null ? 2 : d); }
  var COL = function () { return { a: cssv("--accent"), b: cssv("--accent2"), line: cssv("--line"), ink: cssv("--ink"), muted: cssv("--muted"), ok: cssv("--ok"), warn: cssv("--warn"), bad: cssv("--bad") }; };

  function bars(host, labels, vals, o) {
    o = o || {}; var C = COL(), W = 760, H = o.h || 250, L = o.left || 44, B = 36, T = 16, R = 10, n = vals.length;
    var s = svg(W, H), max = o.max || Math.max.apply(null, vals) * 1.15, log = o.log, lo = o.lo || 1e-4;
    var sc = function (v) { return log ? (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(max) - Math.log10(lo)) : v / max; };
    var ticks = log ? [1e-3, 1e-2, 1e-1, 1] : [0, .25, .5, .75, 1].map(function (f) { return f * max; });
    ticks.forEach(function (t) { var y = H - B - sc(t) * (H - B - T); s.appendChild(el("line", { x1: L, x2: W - R, y1: y, y2: y, stroke: C.line })); s.appendChild(el("text", { x: L - 6, y: y + 4, "text-anchor": "end" }, log ? t : fmt(t, max < 5 ? 1 : 0))); });
    var bw = (W - L - R) / n;
    vals.forEach(function (v, i) {
      var h = sc(v) * (H - B - T), x = L + i * bw + bw * .18, w = bw * .64, col = o.colors ? o.colors[i] : C.a;
      var r = el("rect", { x: x, y: H - B - h, width: w, height: Math.max(h, 1), rx: 4, fill: col }); r.appendChild(el("title", {}, labels[i] + ": " + fmt(v, o.d == null ? 2 : o.d) + (o.unit || ""))); s.appendChild(r);
      s.appendChild(el("text", { x: x + w / 2, y: H - B - h - 5, "text-anchor": "middle", style: "fill:" + C.ink }, fmt(v, o.d == null ? 2 : o.d)));
      var lab = labels[i].split("|"); lab.forEach(function (t, k) { s.appendChild(el("text", { x: x + w / 2, y: H - B + 14 + k * 12, "text-anchor": "middle" }, t)); });
    });
    host.innerHTML = ""; host.appendChild(s);
  }
  function stacked(host, labels, parts, colors) {
    var C = COL(), W = 760, H = 230, L = 70, B = 30, T = 10, s = svg(W, H), n = labels.length, bh = (H - B - T) / n * .62;
    labels.forEach(function (lab, i) {
      var y = T + i * ((H - B - T) / n) + 6, x = L, tot = parts.reduce(function (a, p) { return a + p[i]; }, 0);
      s.appendChild(el("text", { x: L - 8, y: y + bh / 2 + 4, "text-anchor": "end" }, lab));
      parts.forEach(function (p, k) { var w = p[i] / tot * (W - L - 20); if (w <= 0) return; var r = el("rect", { x: x, y: y, width: w, height: bh, fill: colors[k] }); r.appendChild(el("title", {}, (100 * p[i] / tot).toFixed(1) + "%")); s.appendChild(r); if (w > 40) s.appendChild(el("text", { x: x + w / 2, y: y + bh / 2 + 4, "text-anchor": "middle", style: "fill:#fff;font-weight:600" }, (100 * p[i] / tot).toFixed(1) + "%")); x += w; });
    });
    host.innerHTML = ""; host.appendChild(s);
  }
  function line(host, xs, ys, o) {
    o = o || {}; var C = COL(), W = 760, H = 250, L = 46, B = 34, T = 14, R = 12, s = svg(W, H);
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs), ymax = (o.ymax || Math.max.apply(null, ys)) * 1.08;
    var X = function (x) { return L + (x - xmin) / (xmax - xmin) * (W - L - R); }, Y = function (y) { return H - B - y / ymax * (H - B - T); };
    for (var i = 0; i <= 4; i++) { var v = ymax * i / 4, y = Y(v); s.appendChild(el("line", { x1: L, x2: W - R, y1: y, y2: y, stroke: C.line })); s.appendChild(el("text", { x: L - 6, y: y + 4, "text-anchor": "end" }, v.toFixed(2))); }
    var xt = o.xticks || [xmin, Math.round((xmin + xmax) / 2), xmax]; xt.forEach(function (t) { s.appendChild(el("text", { x: X(t), y: H - B + 16, "text-anchor": "middle" }, t)); });
    s.appendChild(el("text", { x: (L + W) / 2, y: H - 4, "text-anchor": "middle" }, o.xlabel || ""));
    var d = xs.map(function (x, i) { return (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(ys[i]).toFixed(1); }).join("");
    s.appendChild(el("path", { d: d, fill: "none", stroke: C.a, "stroke-width": o.thin ? 1 : 2, "stroke-linejoin": "round" }));
    if (!o.thin) xs.forEach(function (x, i) { var c = el("circle", { cx: X(x), cy: Y(ys[i]), r: 3, fill: C.a }); c.appendChild(el("title", {}, x + ": " + ys[i] + " ms")); s.appendChild(c); });
    if (o.hline) { var yy = Y(o.hline[0]); s.appendChild(el("line", { x1: L, x2: W - R, y1: yy, y2: yy, stroke: C.b, "stroke-dasharray": "5 4" })); s.appendChild(el("text", { x: W - R - 4, y: yy - 5, "text-anchor": "end", style: "fill:" + C.b }, o.hline[1])); }
    host.innerHTML = ""; host.appendChild(s);
  }

  var latMode = "mean";
  var RUNS = [100, 300, 500, 1000];
  function drawLat() {
    var key = { mean: "mean", p95: "p95", e2e: "e2e_mean" }[latMode], t = { mean: "Mean detection latency per run", p95: "95th-percentile detection latency per run", e2e: "Mean end-to-end latency per run" }[latMode];
    $("#latTitle").textContent = t;
    bars($("#latChart"), RUNS.map(function (n) { return n + " tx"; }), RUNS.map(function (n) { return D.runs[n][key]; }), { d: 3, unit: " ms", max: 1.6 });
  }
  function drawCharts() {
    if (!$("#p-results").classList.contains("on") && !$("#p-results").dataset.drawn) { /* draw lazily but allow theme redraw */ }
    if (!$("#p-results").classList.contains("on")) return;
    var C = COL();
    drawLat();
    var rows = RUNS.map(function (n) { var r = D.runs[n]; return "<tr><td class='n'>" + n + "</td><td class='n'>" + r.time_s + "</td><td class='n'>" + r.tps + "</td><td class='n'>" + r.mean.toFixed(3) + "</td><td class='n'>" + r.median.toFixed(3) + "</td><td class='n'>" + r.p95.toFixed(3) + "</td><td class='n'>" + r.max.toFixed(3) + "</td><td class='n'>" + r.e2e_mean.toFixed(3) + "</td></tr>"; }).join("");
    $("#latTable").innerHTML = "<thead><tr><th class='n'>Tx</th><th class='n'>Time (s)</th><th class='n'>tx/s</th><th class='n'>Mean</th><th class='n'>Median</th><th class='n'>p95</th><th class='n'>Max</th><th class='n'>E2E mean</th></tr></thead><tbody>" + rows + "</tbody>";
    var ser = D.series1000; line($("#seriesChart"), ser.map(function (_, i) { return i + 1; }), ser, { thin: true, xlabel: "transaction number", xticks: [1, 250, 500, 750, 1000] });
    line($("#fillChart"), D.windowfill.map(function (r) { return r.k; }), D.windowfill.map(function (r) { return r.mean; }), { xlabel: "transactions in the window", xticks: [3, 5, 10, 15, 20] });
    var names = D.rules.time.filter(function (r) { return r.rule !== "Risk Scoring"; }), all = D.rules.time;
    bars($("#costChart"), all.map(function (r) { return r.rule.replace(" ", "|"); }), all.map(function (r) { return r.mean; }), { log: true, lo: 1e-3, max: 2, d: 4, unit: " ms", h: 270, colors: all.map(function (r) { return r.rule === "Sandwich Attack" ? C.bad : C.b; }) });
    bars($("#tpsChart"), RUNS.map(function (n) { return n + " tx"; }), RUNS.map(function (n) { return D.runs[n].tps; }), { d: 2, unit: " tx/s", max: 12, colors: [C.b, C.b, C.b, C.b] });
    drawFire();
    stacked($("#riskChart"), RUNS.map(function (n) { return n + " tx"; }), [RUNS.map(function (n) { return D.runs[n].low; }), RUNS.map(function (n) { return D.runs[n].medium; }), RUNS.map(function (n) { return D.runs[n].high; })], [C.ok, C.warn, C.bad]);
    $("#comboTable").innerHTML = "<thead><tr><th>Rules that fired</th><th class='n'>Tx</th><th class='n'>Share %</th><th>Scores</th></tr></thead><tbody>" + D.combos.map(function (r) { return "<tr><td>" + r[0] + "</td><td class='n'>" + r[1] + "</td><td class='n'>" + r[2] + "</td><td>" + r[3] + "</td></tr>"; }).join("") + "</tbody>";
    bars($("#ablChart"), D.ablation.map(function (r) { return r[0].replace("Without ", "Without|").replace("All rules", "All|rules"); }), D.ablation.map(function (r) { return r[1]; }), { d: 1, unit: "%", max: 80, colors: [C.a, C.b, C.b, C.b] });
  }
  var fireRun = "all";
  function drawFire() {
    var C = COL(), keys = RULES.map(function (r) { return r.key; }), vals;
    if (fireRun === "all") vals = keys.map(function (k) { return 100 * pooled[k] / total; });
    else vals = keys.map(function (k) { return 100 * D.rules.fired[fireRun][k] / D.runs[fireRun].n; });
    $("#fireTitle").textContent = "Share of transactions on which each rule fired (" + (fireRun === "all" ? "all 1,900" : fireRun + "-transaction run") + ")";
    bars($("#fireChart"), RULES.map(function (r) { return r.id + "|" + r.name.split(" ")[0]; }), vals, { d: 1, unit: "%", max: 100, colors: RULES.map(function (r) { return r.id === "R8" ? C.bad : C.a; }) });
  }
  function seg(host, items, cb, init) {
    host.innerHTML = items.map(function (i) { return '<button data-v="' + i[0] + '"' + (i[0] === init ? ' class="on"' : "") + ">" + i[1] + "</button>"; }).join("");
    host.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; $$("button", host).forEach(function (x) { x.classList.toggle("on", x === b); }); cb(b.dataset.v); });
  }
  $("#latSeg").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; $$("button", this).forEach(function (x) { x.classList.toggle("on", x === b); }); latMode = b.dataset.m; drawLat(); });
  seg($("#fireSeg"), [["all", "All runs"], ["100", "100 tx"], ["300", "300 tx"], ["500", "500 tx"], ["1000", "1000 tx"]], function (v) { fireRun = v; drawFire(); }, "all");

  /* ---------------- plot gallery ---------------- */
  var PL = [["lat", "Detection latency"], ["e2e", "End-to-end latency"], ["rulemean", "Mean time per rule"], ["rulep95z", "95th percentile per rule (no sandwich)"]];
  var plotKind = "lat";
  function gal() {
    $("#gallery").innerHTML = RUNS.map(function (n) { var f = "assets/plots/fig_" + plotKind + "_" + n + ".png"; return '<figure><img loading="lazy" src="' + f + '" alt="' + n + ' transactions"><figcaption>' + n + " transactions</figcaption></figure>"; }).join("");
  }
  seg($("#plotSeg"), PL, function (v) { plotKind = v; gal(); }, "lat"); gal();
  $("#gallery").addEventListener("click", function (e) { var i = e.target.closest("img"); if (!i) return; $("#lb img").src = i.src; $("#lb").classList.add("on"); });
  $("#lb").addEventListener("click", function () { this.classList.remove("on"); });

  /* ---------------- search ---------------- */
  var index = [];
  pages.forEach(function (p) {
    var pid = p.id.slice(2), pt = p.getAttribute("data-title");
    var cur = { page: pid, title: pt, head: pt, id: "", text: "" };
    var flush = function () { if (cur.text.trim() || cur.head) index.push({ page: cur.page, title: cur.title, head: cur.head, id: cur.id, text: cur.text.replace(/\s+/g, " ").trim() }); };
    $$("h1,h2,h3,p,li,td,summary,.card", p).forEach(function (n) {
      if (n.matches("h2")) { flush(); cur = { page: pid, title: pt, head: n.textContent, id: n.id, text: "" }; }
      else cur.text += " " + n.textContent;
    }); flush();
  });
  RULES.forEach(function (r) { index.push({ page: "rules", title: "Detection rules", head: r.id + " " + r.name, id: "", text: r.cond + " " + r.why + " " + r.py + " " + r.sol }); });
  var pal = $("#pal"), inp = $("#palIn"), res = $("#palRes"), sel = 0, hits = [];
  function openPal() { pal.classList.add("on"); inp.value = ""; render(""); inp.focus(); }
  function closePal() { pal.classList.remove("on"); }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function render(q) {
    q = q.trim().toLowerCase(); sel = 0;
    if (!q) { hits = index.filter(function (x) { return x.id; }).slice(0, 12); }
    else {
      var words = q.split(/\s+/);
      hits = index.map(function (x) { var h = (x.head + " " + x.title).toLowerCase(), t = x.text.toLowerCase(), sc = 0; for (var i = 0; i < words.length; i++) { var w = words[i]; if (h.indexOf(w) >= 0) sc += 5; if (t.indexOf(w) >= 0) sc += 1; else if (h.indexOf(w) < 0) { sc = -1; break; } } return { x: x, s: sc }; }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 12).map(function (r) { return r.x; });
    }
    res.innerHTML = hits.length ? hits.map(function (h, i) {
      var snip = h.text.slice(0, 110); var t = q ? h.text.toLowerCase().indexOf(q.split(/\s+/)[0]) : -1; if (t > 40) snip = "…" + h.text.slice(t - 30, t + 90);
      snip = esc(snip); if (q) q.split(/\s+/).forEach(function (w) { if (w) snip = snip.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); });
      return '<a href="#' + h.page + (h.id ? "/" + h.id : "") + '" class="' + (i === 0 ? "sel" : "") + '"><b>' + esc(h.head) + "</b><span>" + h.title + " — " + snip + "</span></a>";
    }).join("") : '<a><b>No matches</b><span>Try a rule name, a function name or a number.</span></a>';
  }
  inp.addEventListener("input", function () { render(inp.value); });
  inp.addEventListener("keydown", function (e) {
    var items = $$("a", res);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items.forEach(function (a, i) { a.classList.toggle("sel", i === sel); }); items[sel].scrollIntoView({ block: "nearest" }); }
    if (e.key === "Enter" && items[sel] && items[sel].getAttribute("href")) { location.hash = items[sel].getAttribute("href"); closePal(); }
  });
  res.addEventListener("click", function () { closePal(); });
  pal.addEventListener("mousedown", function (e) { if (e.target === pal) closePal(); });
  $("#searchBtn").addEventListener("click", openPal);
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPal(); }
    else if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openPal(); }
    else if (e.key === "Escape") { closePal(); $("#lb").classList.remove("on"); }
  });

  show();
})();
