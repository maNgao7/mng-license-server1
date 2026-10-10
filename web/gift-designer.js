(() => {
  const $ = id => document.getElementById(id);
  const state = { catalog: [], filtered: [], items: [], selectedId: "", addRegion: "top", range: "all", images: new Map() };
  const canvas = $("designCanvas");
  const ctx = canvas.getContext("2d");
  const designControls = ["layoutType","fontFamily","giftSize","giftGap","textGap","textSize","textColor","strokeColor","strokeWidth","shadowBlur"];
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const imageUrl = gift => `gift-assets/${encodeURIComponent(gift.file || "")}`;
  const selected = () => state.items.find(item => item.uid === state.selectedId);
  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  async function loadCatalog() {
    try {
      const raw = await fetch("gift-assets/katalog_tam.json", { cache: "no-store" }).then(response => {
        if (!response.ok) throw new Error("Katalog bulunamadı");
        return response.json();
      });
      state.catalog = raw.filter(gift => gift.file).map(gift => ({
        id: String(gift.id || ""), name: String(gift.trName || gift.name || "Hediye"),
        originalName: String(gift.name || ""), coins: Math.max(0, Number(gift.coins) || 0), file: gift.file
      }));
      state.filtered = state.catalog;
      filterCatalog();
    } catch {
      $("catalogCount").textContent = "Katalog yüklenemedi";
    }
  }

  function inRange(gift) {
    if (state.range === "1-99") return gift.coins >= 1 && gift.coins <= 99;
    if (state.range === "100-999") return gift.coins >= 100 && gift.coins <= 999;
    if (state.range === "1000+") return gift.coins >= 1000;
    return true;
  }

  function filterCatalog() {
    const query = $("giftSearch").value.trim().toLocaleLowerCase("tr-TR");
    state.filtered = state.catalog.filter(gift => inRange(gift) && (!query || [gift.name, gift.originalName, gift.coins].some(value => String(value).toLocaleLowerCase("tr-TR").includes(query))));
    $("catalogCount").textContent = `${state.filtered.length} / ${state.catalog.length}`;
    const fragment = document.createDocumentFragment();
    state.filtered.forEach(gift => {
      const button = document.createElement("button");
      button.className = "gift-card";
      button.innerHTML = `<img loading="lazy" src="${imageUrl(gift)}" alt=""><strong>${safe(gift.name)}</strong><small>${gift.coins.toLocaleString("tr-TR")} coin</small>`;
      button.onclick = () => addGift(gift);
      fragment.appendChild(button);
    });
    $("giftGrid").replaceChildren(fragment);
  }

  function openCatalog(region) {
    state.addRegion = region;
    $("catalogModal").hidden = false;
    $("giftSearch").focus();
  }

  function addGift(gift) {
    const item = { uid: makeId(), region: state.addRegion, gift, caption: "", captionColor: "#ffffff", badgeData: "", badgeImage: null };
    state.items.push(item);
    state.selectedId = item.uid;
    $("catalogModal").hidden = true;
    renderAll();
  }

  function renderZones() {
    ["top","left","right"].forEach(region => {
      const list = $(`${region}List`);
      list.innerHTML = "";
      state.items.filter(item => item.region === region).forEach(item => {
        const row = document.createElement("div");
        row.className = `zone-item${item.uid === state.selectedId ? " active" : ""}`;
        row.innerHTML = `<img src="${imageUrl(item.gift)}" alt=""><div><b>${safe(item.gift.name)}</b><small>${item.gift.coins.toLocaleString("tr-TR")} coin</small></div><button title="Sil" aria-label="Sil">×</button>`;
        row.onclick = event => {
          if (event.target.closest("button")) removeItem(item.uid);
          else { state.selectedId = item.uid; renderAll(); }
        };
        list.appendChild(row);
      });
    });
    $("selectedCount").textContent = `${state.items.length} hediye`;
  }

  function getImage(source) {
    if (!source) return null;
    if (state.images.has(source)) return state.images.get(source);
    const image = new Image();
    image.onload = draw;
    image.src = source;
    state.images.set(source, image);
    return image;
  }

  function drawText(text, x, y, maxWidth, color, fontSize) {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `900 ${fontSize}px "${$("fontFamily").value}", sans-serif`;
    ctx.lineWidth = Number($("strokeWidth").value);
    ctx.strokeStyle = $("strokeColor").value;
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,0,0,.88)";
    ctx.shadowBlur = Number($("shadowBlur").value);
    if (ctx.lineWidth) ctx.strokeText(text, x, y, maxWidth);
    ctx.fillText(text, x, y, maxWidth);
  }

  function drawItem(item, x, y) {
    const size = Number($("giftSize").value);
    const textGap = Number($("textGap").value);
    const textSize = Number($("textSize").value);
    const image = getImage(imageUrl(item.gift));
    ctx.save();
    if (image?.complete && image.naturalWidth) ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    drawText(item.gift.name, x, y + size / 2 + textGap, size * 1.65, $("textColor").value, textSize);
    drawText(`${item.gift.coins.toLocaleString("tr-TR")} coin`, x, y + size / 2 + textGap + textSize * 1.18, size * 1.5, "#ffd84d", Math.max(16, textSize * .72));
    if (item.badgeData) {
      const badge = item.badgeImage || getImage(item.badgeData);
      if (badge?.complete && badge.naturalWidth) {
        const badgeSize = size * .34;
        ctx.drawImage(badge, x - size * .62, y + size * .42, badgeSize, badgeSize);
      }
    }
    if (item.caption) drawText(item.caption, x, y + size / 2 + textGap + textSize * 2.12, size * 2, item.captionColor || "#fff", Math.max(16, textSize * .78));
    ctx.restore();
  }

  function positions(region, items) {
    const size = Number($("giftSize").value);
    const gap = Number($("giftGap").value);
    if (region === "top") {
      const width = size + gap;
      return items.map((_, index) => ({ x: 960 + (index - (items.length - 1) / 2) * width, y: 150 }));
    }
    const height = size + gap + Number($("textSize").value) * 2.8;
    const x = region === "left" ? 190 : 1730;
    return items.map((_, index) => ({ x, y: 430 + (index - (items.length - 1) / 2) * height }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const layout = $("layoutType").value;
    const activeRegions = layout === "top" ? ["top"] : layout === "sides" ? ["left","right"] : ["top","left","right"];
    activeRegions.forEach(region => {
      const items = state.items.filter(item => item.region === region);
      positions(region, items).forEach((position, index) => drawItem(items[index], position.x, position.y));
    });
    $("emptyPreview").hidden = state.items.length > 0;
  }

  function updateSelectedTools() {
    const item = selected();
    $("selectedTools").hidden = !item;
    if (!item) return;
    $("selectedName").textContent = `${item.gift.name} · ${item.gift.coins} coin`;
    $("customCaption").value = item.caption || "";
    $("captionColor").value = item.captionColor || "#ffffff";
  }

  function renderAll() { renderZones(); updateSelectedTools(); draw(); }
  function removeItem(uid) {
    state.items = state.items.filter(item => item.uid !== uid);
    if (state.selectedId === uid) state.selectedId = "";
    renderAll();
  }

  function serializeDesign() {
    return {
      id: makeId(), name: $("designName").value.trim() || "Adsız Tasarım", updatedAt: Date.now(),
      settings: Object.fromEntries(designControls.map(id => [id, $(id).value])),
      items: state.items.map(item => ({ ...item, badgeImage: null }))
    };
  }

  function saveDesign() {
    const designs = JSON.parse(localStorage.getItem("mng-gift-designs-v605") || "[]");
    const design = serializeDesign();
    designs.unshift(design);
    localStorage.setItem("mng-gift-designs-v605", JSON.stringify(designs.slice(0, 30)));
    $("saveBtn").textContent = "Kaydedildi";
    setTimeout(() => $("saveBtn").textContent = "Tasarıma Kaydet", 1200);
  }

  function renderSaved() {
    const designs = JSON.parse(localStorage.getItem("mng-gift-designs-v605") || "[]");
    $("savedList").innerHTML = designs.length ? designs.map(design => `<article class="saved-item"><div><b>${safe(design.name)}</b><small>${new Date(design.updatedAt).toLocaleString("tr-TR")} · ${design.items.length} hediye</small></div><button class="btn quiet" data-load="${design.id}">Aç</button><button class="btn danger" data-delete="${design.id}">Sil</button></article>`).join("") : '<div class="saved-empty">Henüz kayıtlı tasarım yok.</div>';
    $("savedList").onclick = event => {
      const loadId = event.target.dataset.load;
      const deleteId = event.target.dataset.delete;
      if (loadId) {
        const design = designs.find(entry => entry.id === loadId);
        if (!design) return;
        $("designName").value = design.name;
        Object.entries(design.settings || {}).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
        state.items = (design.items || []).map(item => ({ ...item, uid: makeId(), badgeImage: item.badgeData ? getImage(item.badgeData) : null }));
        state.selectedId = "";
        $("designsModal").hidden = true;
        renderAll();
      }
      if (deleteId) {
        localStorage.setItem("mng-gift-designs-v605", JSON.stringify(designs.filter(entry => entry.id !== deleteId)));
        renderSaved();
      }
    };
  }

  document.querySelectorAll("[data-add]").forEach(button => button.onclick = () => openCatalog(button.dataset.add));
  $("closeCatalog").onclick = () => $("catalogModal").hidden = true;
  $("catalogModal").onclick = event => { if (event.target === $("catalogModal")) $("catalogModal").hidden = true; };
  $("giftSearch").oninput = filterCatalog;
  $("coinFilters").onclick = event => {
    const button = event.target.closest("button");
    if (!button) return;
    state.range = button.dataset.range;
    [...$("coinFilters").children].forEach(item => item.classList.toggle("active", item === button));
    filterCatalog();
  };
  designControls.forEach(id => $(id).addEventListener("input", draw));
  $("customCaption").oninput = event => { const item = selected(); if (item) { item.caption = event.target.value; draw(); } };
  $("captionColor").oninput = event => { const item = selected(); if (item) { item.captionColor = event.target.value; draw(); } };
  $("badgeUpload").onchange = event => {
    const file = event.target.files?.[0], item = selected();
    if (!file || !item) return;
    const reader = new FileReader();
    reader.onload = () => { item.badgeData = reader.result; item.badgeImage = getImage(reader.result); draw(); };
    reader.readAsDataURL(file);
    event.target.value = "";
  };
  $("removeBadge").onclick = () => { const item = selected(); if (item) { item.badgeData = ""; item.badgeImage = null; draw(); } };
  $("removeGift").onclick = () => { if (state.selectedId) removeItem(state.selectedId); };
  $("clearBtn").onclick = () => { state.items = []; state.selectedId = ""; $("designName").value = "Yeni Hediye Tasarımım"; renderAll(); };
  $("saveBtn").onclick = saveDesign;
  $("designsBtn").onclick = () => { renderSaved(); $("designsModal").hidden = false; };
  $("closeDesigns").onclick = () => $("designsModal").hidden = true;
  $("downloadBtn").onclick = () => { draw(); const link = document.createElement("a"); link.download = `${$("designName").value.trim() || "mng-hediye-tasarimi"}.png`; link.href = canvas.toDataURL("image/png"); link.click(); };
  $("closeDesigner").onclick = () => { if (window.parent !== window) window.parent.postMessage({ type: "mng-close-gift-designer" }, "*"); else location.href = "/"; };
  loadCatalog();
  renderAll();
})();
