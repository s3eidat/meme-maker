/* Meme Maker — everything is drawn on one <canvas>; the PNG is made locally. No watermark. */
(function () {
  "use strict";
  const $ = S3.$, $$ = S3.$$;
  const MAX_SIDE = 4096;
  const FONT = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", Inter, sans-serif';
  const cv = $("#cv"), ctx = cv.getContext("2d");
  const saved = S3.store("meme") || {};
  let bg = null;              // HTMLImageElement or null (blank)
  let blank = { color: saved.blankColor || "#ffffff", ratio: 1 };
  let texts = [], sel = null, nextId = 1;

  function newText(text, y) {
    return { id: nextId++, text, x: 0.5, y, size: saved.size || 10, fill: saved.fill || "#ffffff", stroke: saved.stroke || "#000000", strokeW: saved.strokeW != null ? saved.strokeW : 8, upper: saved.upper !== false };
  }

  // ---------- drawing ----------
  function shown(t) { return t.upper ? t.text.toUpperCase() : t.text; }
  // Word-wrap each paragraph to maxW; very long words are split by character.
  function wrap(text, maxW, measure) {
    const out = [];
    const split = word => { const parts = []; let part = ""; for (const ch of word) { if (part && measure(part + ch) > maxW) { parts.push(part); part = ""; } part += ch; } parts.push(part); return parts; };
    text.split("\n").forEach(par => {
      let line = "";
      par.split(/[ \t]+/).filter(Boolean).forEach(word => {
        const t = line ? line + " " + word : word;
        if (measure(t) <= maxW) { line = t; return; }
        if (line) out.push(line);
        const parts = measure(word) > maxW ? split(word) : [word];
        line = parts.pop(); out.push.apply(out, parts);
      });
      out.push(line);
    });
    return out;
  }
  function layout(t, W, H, c) {
    const px = t.size / 100 * W, lh = px * 1.12;
    c.font = "900 " + px + "px " + FONT;
    const lines = wrap(shown(t), W * 0.94, s => c.measureText(s).width);
    const w = Math.max.apply(null, lines.map(l => c.measureText(l).width).concat([px * 0.5])), h = lines.length * lh;
    // Keep the whole block on the image even when it wraps near an edge.
    const m = px * 0.2, fitIn = (v, half, max) => half * 2 + m * 2 >= max ? max / 2 : Math.min(Math.max(v, half + m), max - half - m);
    const cx = fitIn(t.x * W, w / 2, W), cy = fitIn(t.y * H, h / 2, H);
    return { px, lh, lines, box: { x: cx - w / 2 - px * 0.15, y: cy - h / 2 - px * 0.1, w: w + px * 0.3, h: h + px * 0.2 }, cx, top: cy - h / 2 };
  }
  function paint(c, W, H, withUi) {
    c.clearRect(0, 0, W, H);
    if (bg) c.drawImage(bg, 0, 0, W, H); else { c.fillStyle = blank.color; c.fillRect(0, 0, W, H); }
    texts.forEach(t => {
      const L = layout(t, W, H, c);
      t._box = L.box;
      c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round"; c.miterLimit = 2;
      L.lines.forEach((ln, i) => {
        const y = L.top + L.lh * (i + 0.5);
        if (t.strokeW > 0) { c.strokeStyle = t.stroke; c.lineWidth = L.px * t.strokeW / 100 * 2; c.strokeText(ln, L.cx, y); }
        c.fillStyle = t.fill; c.fillText(ln, L.cx, y);
      });
      if (withUi && t === sel) {
        c.save(); c.setLineDash([Math.max(4, W / 120), Math.max(3, W / 160)]); c.lineWidth = Math.max(1.5, W / 500);
        c.strokeStyle = "rgba(61,214,208,.95)"; c.strokeRect(L.box.x, L.box.y, L.box.w, L.box.h); c.restore();
      }
    });
  }
  function size() {
    if (bg) {
      let w = bg.naturalWidth || 1000, h = bg.naturalHeight || 1000;
      const s = Math.min(1, MAX_SIDE / Math.max(w, h));
      return { w: Math.round(w * s), h: Math.round(h * s) };
    }
    return { w: 1200, h: Math.round(1200 / blank.ratio) };
  }
  function draw() {
    const s = size();
    if (cv.width !== s.w || cv.height !== s.h) { cv.width = s.w; cv.height = s.h; }
    paint(ctx, s.w, s.h, true);
  }
  function exportCanvas() {
    const s = size(), c = document.createElement("canvas"); c.width = s.w; c.height = s.h;
    paint(c.getContext("2d"), s.w, s.h, false);
    return c;
  }
  function hit(x, y) {
    for (let i = texts.length - 1; i >= 0; i--) { const b = texts[i]._box; if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return texts[i]; }
    return null;
  }

  // ---------- text list + props ----------
  function renderList() {
    const box = $("#texts"); box.textContent = "";
    texts.forEach((t, i) => {
      const ta = S3.h("textarea", { "class": "textarea", dir: "auto", rows: "1", "aria-label": "Text " + (i + 1), placeholder: "Text " + (i + 1) });
      ta.value = t.text;
      ta.addEventListener("focus", () => select(t, true));
      ta.addEventListener("input", () => { t.text = ta.value; draw(); });
      const row = S3.h("div", { "class": "mm-t" + (t === sel ? " is-sel" : "") }, [ta]);
      t._row = row; box.appendChild(row);
    });
    props();
  }
  function select(t, fromList) {
    sel = t;
    texts.forEach(x => x._row && x._row.classList.toggle("is-sel", x === t));
    props(); draw();
    if (t && !fromList) { const ta = $("textarea", t._row); if (ta && document.activeElement !== cv) ta.focus(); }
  }
  function props() {
    const p = $("#props"); p.hidden = !sel;
    if (!sel) return;
    $("#size").value = sel.size; $("#sv").textContent = sel.size + "%";
    $("#fill").value = sel.fill; $("#stroke").value = sel.stroke;
    $("#strokeW").value = sel.strokeW; $("#wv").textContent = sel.strokeW + "%";
    $("#upper").checked = sel.upper;
  }
  function setProp(key, val) {
    if (!sel) return;
    sel[key] = val; saved[key] = val; S3.store("meme", saved);
    props(); draw();
  }
  $("#size").addEventListener("input", e => setProp("size", +e.target.value));
  $("#fill").addEventListener("input", e => setProp("fill", e.target.value));
  $("#stroke").addEventListener("input", e => setProp("stroke", e.target.value));
  $("#strokeW").addEventListener("input", e => setProp("strokeW", +e.target.value));
  $("#upper").addEventListener("change", e => setProp("upper", e.target.checked));
  $("#add").addEventListener("click", () => {
    const t = newText("NEW TEXT", 0.5); texts.push(t); renderList(); select(t);
    const ta = $("textarea", t._row); ta.select();
  });
  $("#del").addEventListener("click", () => {
    if (!sel) return;
    texts = texts.filter(t => t !== sel); sel = texts[texts.length - 1] || null; renderList(); draw();
  });

  // ---------- dragging ----------
  let drag = null;
  function canvasPt(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height }; }
  cv.addEventListener("pointerdown", e => {
    const p = canvasPt(e), t = hit(p.x, p.y);
    select(t, true);
    // Start from where the text is drawn (it may be nudged inside the edges).
    if (t) { t.x = (t._box.x + t._box.w / 2) / cv.width; t.y = (t._box.y + t._box.h / 2) / cv.height; }
    if (t) { drag = { t, dx: p.x - t.x * cv.width, dy: p.y - t.y * cv.height }; cv.setPointerCapture(e.pointerId); cv.classList.add("is-drag"); }
  });
  cv.addEventListener("pointermove", e => {
    if (!drag) { const p = canvasPt(e); cv.style.cursor = hit(p.x, p.y) ? "grab" : "default"; return; }
    const p = canvasPt(e);
    drag.t.x = Math.min(1, Math.max(0, (p.x - drag.dx) / cv.width));
    drag.t.y = Math.min(1, Math.max(0, (p.y - drag.dy) / cv.height));
    draw();
  });
  const end = () => { drag = null; cv.classList.remove("is-drag"); };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  cv.addEventListener("keydown", e => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || !sel) return;
    e.preventDefault();
    const k = e.shiftKey ? 0.05 : 0.01;
    sel.x = Math.min(1, Math.max(0, sel.x + d[0] * k)); sel.y = Math.min(1, Math.max(0, sel.y + d[1] * k)); draw();
  });

  // ---------- background ----------
  async function setImage(file) {
    const url = URL.createObjectURL(file), img = new Image();
    img.src = url;
    try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); S3.toast("Can't read that image", "error"); return; }
    if (bg) URL.revokeObjectURL(bg.src);
    bg = img; $$("#blank button").forEach(b => b.setAttribute("aria-pressed", "false"));
    draw();
  }
  S3.drop($("#drop"), fs => setImage(fs[0]), { accept: "image/*", multiple: false });
  document.addEventListener("paste", e => {
    const f = Array.prototype.slice.call((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type))[0];
    if (f) { e.preventDefault(); setImage(f); }
  });
  $$("#blank button").forEach(b => b.addEventListener("click", () => {
    if (bg) { URL.revokeObjectURL(bg.src); bg = null; }
    blank.ratio = +b.dataset.v;
    $$("#blank button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  }));
  $("#blankColor").value = blank.color;
  $("#blankColor").addEventListener("input", e => { blank.color = e.target.value; saved.blankColor = blank.color; S3.store("meme", saved); if (!bg) draw(); });

  // ---------- export ----------
  $("#save").addEventListener("click", () => exportCanvas().toBlob(b => { S3.download(b, "meme.png"); S3.done(); }, "image/png"));
  $("#copyImg").addEventListener("click", () => {
    if (!navigator.clipboard || !window.ClipboardItem) return S3.toast("Your browser can't copy images; use Download", "error");
    exportCanvas().toBlob(b => navigator.clipboard.write([new ClipboardItem({ "image/png": b })])
      .then(() => { S3.toast("Image copied ✓"); S3.done(); }, () => S3.toast("Copy was blocked; use Download", "error")), "image/png");
  });

  // ---------- start ----------
  texts = [newText("TOP TEXT", 0.1), newText("BOTTOM TEXT", 0.9)];
  sel = texts[0];
  $$("#blank button")[0].setAttribute("aria-pressed", "true");
  renderList();
  const fontReady = (document.fonts && document.fonts.load ? document.fonts.load("900 40px Inter") : Promise.resolve()).catch(() => {});
  draw(); fontReady.then(draw);

  // ---------- sample scene (drawn locally) ----------
  function scene(w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#5fb8ff"); g.addColorStop(1, "#c9ecff");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = "#62c370"; x.beginPath(); x.ellipse(w / 2, h * 1.05, w * 0.8, h * 0.32, 0, 0, Math.PI * 2); x.fill();
    // a smug sun
    const cx = w / 2, cy = h * 0.5, r = h * 0.22;
    x.strokeStyle = "#ffb703"; x.lineWidth = r * 0.12; x.lineCap = "round";
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2); x.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5); x.stroke(); }
    x.fillStyle = "#ffd23f"; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#2b2d42";
    x.fillRect(cx - r * 0.55, cy - r * 0.25, r * 0.4, r * 0.12); x.fillRect(cx + r * 0.15, cy - r * 0.25, r * 0.4, r * 0.12);
    x.lineWidth = r * 0.08; x.strokeStyle = "#2b2d42"; x.beginPath(); x.arc(cx + r * 0.1, cy + r * 0.15, r * 0.35, 0.15 * Math.PI, 0.7 * Math.PI); x.stroke();
    return c;
  }
  window.S3_DEMO = async function () {
    await fontReady;
    const b = await new Promise(r => scene(1200, 900).toBlob(r, "image/png"));
    await setImage(new File([b], "sun.png", { type: "image/png" }));
    texts[0].text = "When the tool runs"; texts[1].text = "100% in your browser";
    renderList(); select(texts[1], true);
  };

  window.S3_SELFTEST = async function () {
    await fontReady;
    const keep = { bg, blank: Object.assign({}, blank), texts, sel };
    try {
      // Wrapping with a fixed-width "font" (10 px per char).
      const m = s => s.length * 10;
      const w1 = wrap("aaa bbb ccc", 75, m).join("|"), w2 = wrap("abcdefghij", 40, m).join("|"), w3 = wrap("one\ntwo", 1000, m).join("|");
      const okWrap = w1 === "aaa bbb|ccc" && w2 === "abcd|efgh|ij" && w3 === "one|two";
      // Real render: red 1:1 blank, one white "HI" with black outline in the middle.
      bg = null; blank = { color: "#ff0000", ratio: 1 };
      const t = newText("hi", 0.5); t.size = 20; t.fill = "#ffffff"; t.stroke = "#000000"; t.strokeW = 8; t.upper = true;
      texts = [t]; sel = t;
      draw();
      const c = exportCanvas(), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let white = 0, black = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) white++; else if (d[i] < 20 && d[i + 1] < 20 && d[i + 2] < 20) black++; }
      const corner = Array.from(d.slice(0, 3)).join();
      sel = null; const plain = exportCanvas().toDataURL(); sel = t; const withSel = exportCanvas().toDataURL();
      const blob = await new Promise(r => c.toBlob(r, "image/png")), head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      const okRender = c.width === 1200 && c.height === 1200 && corner === "255,0,0" && white > 500 && black > 500 &&
        plain === withSel && head[0] === 0x89 && head[1] === 0x50 && shown(t) === "HI" && hit(600, 600) === t && hit(5, 5) === null;
      return (okWrap && okRender) || { okWrap, w1, w2, okRender, white, black, corner, same: plain === withSel };
    } finally {
      bg = keep.bg; blank = keep.blank; texts = keep.texts; sel = keep.sel; draw();
    }
  };
})();
