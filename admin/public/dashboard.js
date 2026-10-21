"use strict";

const $ = id => document.getElementById(id);
const state = { licenses: [], requests: [], view: "licenses", mode: "agency", expanded: new Set(), details: new Map(), loading: false, authenticated: false };
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const date = value => value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "Kayıt yok";
const statusLabels = { aktif: "Aktif", beklemede: "Beklemede", suresi_doldu: "Süresi dolmuş", iptal: "İptal", arsivlendi: "Arşiv" };
const icons = () => window.lucide?.createIcons();
let toastTimer;

function toast(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4000);
}

async function api(url, body, method = body === undefined ? "GET" : "POST") {
    const response = await fetch(url, {
        method, cache: "no-store", credentials: "same-origin",
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) showLogin();
    if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
    return result;
}

function showLogin() {
    state.authenticated = false;
    $("loginPage").hidden = false;
    $("adminPanel").hidden = true;
}

function showPanel() {
    state.authenticated = true;
    $("loginPage").hidden = true;
    $("adminPanel").hidden = false;
    $("adminPassword").value = "";
}

function currentStatus(license) {
    return license.durum === "aktif" && license.sure_birim !== "sinirsiz"
        && license.bitis_zamani && license.bitis_zamani <= Date.now() ? "suresi_doldu" : license.durum;
}

function usage(license) {
    const used = new Set(Array.isArray(license.cihazlar) ? license.cihazlar : []).size;
    return { used, capacity: Number(license.max_cihaz) || 1 };
}

function durationLabel(license) {
    if (license.sure_birim === "sinirsiz" || license.sure_miktar === -1) return "Sınırsız";
    return `${license.sure_miktar} ${license.sure_birim === "dakika" ? "dakika" : "gün"}`;
}

function remainingLabel(license) {
    const status = currentStatus(license);
    if (status === "beklemede") return "İlk girişte başlar";
    if (status !== "aktif") return statusLabels[status] || "—";
    if (!license.bitis_zamani) return "Süresiz kullanım";
    const minutes = Math.max(0, Math.ceil((license.bitis_zamani - Date.now()) / 60000));
    if (minutes >= 1440) return `${Math.ceil(minutes / 1440)} gün kaldı`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)} saat ${minutes % 60} dk`;
    return `${minutes} dakika kaldı`;
}

function refreshStats() {
    const agencies = state.licenses.filter(l => l.tip === "ajans");
    const usable = agencies.filter(l => ["aktif", "beklemede"].includes(currentStatus(l)));
    const used = usable.reduce((total, l) => total + usage(l).used, 0);
    const capacity = usable.reduce((total, l) => total + usage(l).capacity, 0);
    $("licenseCount").textContent = state.licenses.length;
    $("agencyCount").textContent = agencies.length;
    $("requestCount").textContent = state.requests.length;
    $("statTotal").textContent = state.licenses.length;
    $("statActive").textContent = state.licenses.filter(l => currentStatus(l) === "aktif").length;
    $("statSeats").textContent = `${used} / ${capacity}`;
    $("statAvailable").textContent = Math.max(0, capacity - used);
}

function actionButton(action, code, name, title, extraClass = "") {
    return `<button type="button" class="icon-button ${extraClass}" data-action="${action}" data-code="${escapeHtml(code)}" title="${title}" aria-label="${title}">${icon(name)}</button>`;
}

function renderLicenses() {
    const query = $("search").value.toLocaleLowerCase("tr").trim();
    const filtered = state.licenses.filter(l => {
        if (state.view === "agencies" && l.tip !== "ajans") return false;
        if ($("statusFilter").value !== "all" && currentStatus(l) !== $("statusFilter").value) return false;
        return !query || [l.kod, l.ajans_adi, l.notlar, l.cihaz_kimlik,
            ...(l.yayinci_kayitlari || []).map(m => `${m.ad} ${m.cihaz_kimlik}`)]
            .join(" ").toLocaleLowerCase("tr").includes(query);
    });
    $("resultCount").textContent = `${filtered.length} kayıt`;
    $("listSummary").textContent = `${filtered.length} / ${state.licenses.length} lisans`;
    $("licensesBody").innerHTML = filtered.length ? filtered.map(licenseRow).join("")
        : '<tr><td colspan="6" class="empty">Bu filtrede lisans bulunamadı.</td></tr>';
    icons();
}

function licenseRow(l) {
    const agency = l.tip === "ajans";
    const expanded = state.expanded.has(l.kod);
    const status = currentStatus(l);
    const { used, capacity } = usage(l);
    const code = escapeHtml(l.kod);
    const name = agency ? (l.ajans_adi || "Ajans") : "Bireysel lisans";
    const members = agency ? `<div class="usage-label">${used} / ${capacity}<small>${Math.max(0, capacity - used)} boş</small></div><div class="usage-track ${used >= capacity ? "full" : ""}"><span style="width:${Math.min(100, used / capacity * 100)}%"></span></div>`
        : `<span class="muted">${l.cihaz_kimlik ? "1 kayıtlı cihaz" : "Henüz giriş yok"}</span>`;
    return `<tr>
      <td><div class="license-title">${agency ? `<button type="button" class="expand-button" data-action="expand" data-code="${code}" aria-expanded="${expanded}" aria-label="${escapeHtml(name)} yayıncılarını ${expanded ? "kapat" : "göster"}">${icon("chevron-right")}</button>` : icon("key-round")}<span>${escapeHtml(name)}</span></div><code class="license-code">${code}</code></td>
      <td><span class="state ${statusLabels[status] ? status : "arsivlendi"}">${escapeHtml(statusLabels[status] || status)}</span></td>
      <td>${members}</td><td class="time-cell">${durationLabel(l)}<br><span class="muted" title="${date(l.bitis_zamani)}">${remainingLabel(l)}</span></td>
      <td class="notes-cell">${escapeHtml(l.notlar || "—")}</td>
      <td><div class="row-actions">${actionButton("copy", l.kod, "copy", "Lisansı kopyala")}${status === "iptal" || status === "arsivlendi"
        ? actionButton("activate", l.kod, "rotate-ccw", "Lisansı yeniden aç") : actionButton("revoke", l.kod, "ban", "Lisansı iptal et", "danger")}${status !== "arsivlendi" ? actionButton("archive", l.kod, "archive", "Lisansı arşivle") : ""}</div></td>
    </tr>${agency && expanded ? `<tr class="agency-detail" data-detail="${code}"><td colspan="6">${detailMarkup(l)}</td></tr>` : ""}`;
}

function detailMarkup(license) {
    const detail = state.details.get(license.kod);
    if (!detail) return '<p class="muted" role="status">Yayıncı kayıtları yükleniyor…</p>';
    if (detail.error) return `<p class="error">${escapeHtml(detail.error)}</p>${actionButton("retry", license.kod, "refresh-cw", "Yeniden dene")}`;
    const code = escapeHtml(license.kod);
    return `<div class="detail-header"><div><h3>Kayıtlı yayıncılar <span class="muted">${detail.kullanilan} / ${detail.kapasite}</span></h3><p>${detail.bos} boş kontenjan · Son kontrol, lisans doğrulama zamanıdır.</p></div>
      <form class="capacity-form" data-code="${code}"><label for="capacity-${code}">Kapasite</label><input id="capacity-${code}" type="number" min="${Math.max(1, detail.kullanilan)}" max="1000" step="1" value="${detail.kapasite}" required><button type="submit">Kaydet</button></form></div>
      <table class="member-table"><thead><tr><th>Yayıncı adı</th><th>Cihaz kimliği</th><th>İlk giriş</th><th>Son kontrol</th><th>Giriş</th><th class="align-right">Erişim</th></tr></thead><tbody>${detail.yayincilar.length ? detail.yayincilar.map((member, index) => `<tr>
      <td><form class="member-name" data-code="${code}" data-device="${escapeHtml(member.cihaz_kimlik)}"><input maxlength="80" value="${escapeHtml(member.ad)}" placeholder="Yayıncı ${index + 1}" aria-label="Yayıncı ${index + 1} adı"><button type="submit" class="icon-button" title="Yayıncı adını kaydet" aria-label="Yayıncı adını kaydet">${icon("check")}</button></form></td>
      <td><code class="device-id">${escapeHtml(member.cihaz_kimlik)}</code></td><td>${date(member.ilk_giris)}</td><td>${date(member.son_kontrol)}</td><td>${member.giris_sayisi || "—"}</td><td class="align-right"><button type="button" class="icon-button danger" data-action="block" data-code="${code}" data-device="${escapeHtml(member.cihaz_kimlik)}" title="Cihaz erişimini kaldır" aria-label="Cihaz erişimini kaldır">${icon("user-minus")}</button></td></tr>`).join("") : '<tr><td colspan="6" class="empty">Bu ajans anahtarıyla henüz giriş yapılmadı.</td></tr>'}</tbody></table>
      ${detail.engelli_cihazlar.length ? `<details class="blocked-members"><summary>Erişimi kaldırılan cihazlar (${detail.engelli_cihazlar.length})</summary>${detail.engelli_cihazlar.map(id => `<div class="blocked-member"><code>${escapeHtml(id)}</code><button type="button" data-action="unblock" data-code="${code}" data-device="${escapeHtml(id)}">Yeniden izin ver</button></div>`).join("")}</details>` : ""}
      <p class="member-note">Yayıncı adı yönetici etiketidir. Eski kayıtlarda tarih ve giriş sayısı bulunmayabilir.</p>`;
}

async function loadDetail(code) {
    try { state.details.set(code, await api(`/api/admin/ajans/${encodeURIComponent(code)}`)); }
    catch (error) { state.details.set(code, { error: error.message }); }
}

async function refresh() {
    if (state.loading || !state.authenticated) return;
    state.loading = true;
    $("refresh").disabled = true;
    $("pageError").hidden = true;
    try {
        const licenses = await api("/api/admin/lisanslar");
        const requests = await api("/api/admin/talepler");
        if (!Array.isArray(licenses) || !Array.isArray(requests)) throw new Error("Sunucunun yanıtı okunamadı.");
        state.licenses = licenses;
        state.requests = requests;
        for (const code of state.expanded) await loadDetail(code);
        $("syncStatus").textContent = `Güncel · ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
        $("syncStatus").classList.remove("failed");
        checkBrowserBackup();
        refreshStats();
        renderLicenses();
        renderRequests();
    } catch (error) {
        $("pageError").textContent = error.message + " Görünen kayıtlar güncel olmayabilir.";
        $("pageError").hidden = false;
        $("syncStatus").textContent = "Bağlantı kesildi";
        $("syncStatus").classList.add("failed");
    } finally {
        state.loading = false;
        $("refresh").disabled = false;
    }
}

function switchView(view) {
    state.view = view;
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    $("viewTitle").textContent = { licenses: "Lisans yönetimi", agencies: "Ajanslar ve yayıncılar", requests: "Gelen talepler" }[view];
    $("listTitle").textContent = view === "agencies" ? "Ajans lisansları" : "Lisans havuzu";
    $("licensesSection").hidden = view === "requests";
    $("requestsSection").hidden = view !== "requests";
    $("createSection").hidden = view === "requests";
    $("toggleCreate").setAttribute("aria-expanded", String(view !== "requests"));
    if (view === "agencies") setMode("agency");
    renderLicenses();
}

function setMode(mode) {
    state.mode = mode;
    const agency = mode === "agency";
    $("agencyNameField").hidden = !agency;
    $("capacityField").hidden = !agency;
    $("agencyName").required = agency;
    $("agencyCapacity").required = agency;
    document.querySelectorAll("[data-mode]").forEach(button => {
        button.classList.toggle("active", button.dataset.mode === mode);
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
    $("createButton").innerHTML = icon("plus") + (agency ? " Ajans lisansı oluştur" : " Bireysel lisans oluştur");
    $("durationHint").textContent = agency ? "Ortak süre, ilk yayıncının girişinde başlar." : "Süre, ilk cihazın girişinde başlar. Tek cihazla kullanılır.";
    $("newLicense").hidden = true;
    updateKeyPreview();
    icons();
}

function updateKeyPreview() {
    const slug = $("agencyName").value.replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);
    $("keyPreview").textContent = state.mode === "agency" ? `${slug.slice(0, 7) || "AJANSAD"}-XXXXXXXX-XXXXXXXX` : "MNG · Bireysel lisans";
    $("durationAmount").disabled = $("durationUnit").value === "sinirsiz";
}

async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
        const input = document.createElement("textarea");
        input.value = text;
        input.style.position = "fixed";
        input.style.left = "-9999px";
        document.body.append(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("Kopyalanamadı. Lisans kodunu seçerek kopyalayın.");
    }
    toast("Lisans kodu kopyalandı.");
}

async function run(button, operation) {
    if (button.disabled) return;
    button.disabled = true;
    try { await operation(); }
    catch (error) { toast(error.message); }
    finally { button.disabled = false; }
}

$("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter;
    $("loginError").hidden = true;
    await run(button, async () => {
        try {
            await api("/api/admin/giris", { sifre: $("adminPassword").value.trim() });
            showPanel();
            await refresh();
        } catch (error) {
            $("loginError").textContent = error.message;
            $("loginError").hidden = false;
        }
    });
});

$("logout").addEventListener("click", async () => {
    try { await api("/api/admin/cikis", {}, "POST"); }
    catch (error) { toast("Çıkış tamamlanamadı: " + error.message); return; }
    state.licenses = [];
    state.requests = [];
    state.expanded.clear();
    state.details.clear();
    $("newCode").textContent = "";
    $("licensesBody").replaceChildren();
    $("requestsBody").replaceChildren();
    $("newLicense").hidden = true;
    showLogin();
});
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
$("refresh").addEventListener("click", refresh);
$("search").addEventListener("input", renderLicenses);
$("statusFilter").addEventListener("change", renderLicenses);
$("agencyName").addEventListener("input", updateKeyPreview);
$("durationUnit").addEventListener("change", updateKeyPreview);
$("copyNew").addEventListener("click", event => run(event.currentTarget, () => copy($("newCode").textContent)));
$("toggleCreate").addEventListener("click", () => {
    if (state.view === "requests") switchView("licenses");
    else $("createSection").hidden = !$("createSection").hidden;
    $("toggleCreate").setAttribute("aria-expanded", String(!$("createSection").hidden));
});

$("createForm").addEventListener("submit", async event => {
    event.preventDefault();
    await run(event.submitter, async () => {
        $("createError").hidden = true;
        try {
            let unit = $("durationUnit").value;
            let amount = Number($("durationAmount").value);
            if (unit === "saat") { unit = "dakika"; amount *= 60; }
            if (unit === "ay") { unit = "gun"; amount *= 30; }
            if (unit === "yil") { unit = "gun"; amount *= 365; }
            if (unit === "sinirsiz") amount = -1;
            const payload = { sure_birim: unit, sure_miktar: amount, notlar: $("licenseNote").value.trim() };
            const agency = state.mode === "agency";
            if (agency) Object.assign(payload, { ajans_adi: $("agencyName").value.trim(), max_yayinci: Number($("agencyCapacity").value) });
            const result = await api(agency ? "/api/admin/ajans-lisansi-olustur" : "/api/admin/lisans-olustur", payload);
            $("newCode").textContent = result.kod;
            $("newLicense").hidden = false;
            toast("Lisans oluşturuldu.");
            await refresh();
        } catch (error) {
            $("createError").textContent = error.message;
            $("createError").hidden = false;
        }
    });
});

$("licensesBody").addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, code, device } = button.dataset;
    await run(button, async () => {
        if (action === "copy") return copy(code);
        if (action === "expand") {
            if (state.expanded.has(code)) state.expanded.delete(code);
            else { state.expanded.add(code); renderLicenses(); await loadDetail(code); }
            renderLicenses();
            return;
        }
        if (action === "retry") { await loadDetail(code); renderLicenses(); return; }
        if (action === "block" || action === "unblock") {
            if (!confirm(action === "block" ? "Bu cihazın ajans erişimi kaldırılsın mı? Kontenjan boşalır ve cihaz yeniden izin verilene kadar giriş yapamaz." : "Bu cihaza yeniden giriş izni verilsin mi? Sonraki girişte boş kontenjan kullanır.")) return;
            await api(`/api/admin/ajans/${encodeURIComponent(code)}/erisim`, { deviceId: device, engelli: action === "block" });
        } else {
            const label = { revoke: "iptal edilsin", activate: "yeniden açılsın", archive: "arşivlensin ve erişimi kapatılsın" }[action];
            if (!label || !confirm(`Bu lisans ${label} mi?`)) return;
            const suffix = { revoke: "/iptal", activate: "/aktif-et", archive: "" }[action];
            await api(`/api/admin/lisans/${encodeURIComponent(code)}${suffix}`, {}, action === "archive" ? "DELETE" : "POST");
        }
        toast("Değişiklik kaydedildi.");
        await refresh();
    });
});

$("licensesBody").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.target;
    await run(event.submitter, async () => {
        const code = encodeURIComponent(form.dataset.code);
        if (form.classList.contains("capacity-form")) await api(`/api/admin/ajans/${code}/kapasite`, { max_yayinci: Number(form.querySelector("input").value) });
        else if (form.classList.contains("member-name")) await api(`/api/admin/ajans/${code}/yayinci`, { deviceId: form.dataset.device, ad: form.querySelector("input").value });
        toast("Değişiklik kaydedildi.");
        await refresh();
    });
});

function renderRequests() {
    $("requestsBody").innerHTML = state.requests.length ? state.requests.map(request => `<tr><td>${date(request.tarih)}<br><span class="muted">${{ oneri: "Öneri", "öneri": "Öneri", soru: "Soru", lisans: "Lisans", hata: "Hata bildirimi" }[request.tur] || "Talep"}</span></td><td><strong>${escapeHtml(request.ad)}</strong><br><span class="muted">${escapeHtml(request.tiktok_kullanici || "")}</span></td><td>${escapeHtml(request.iletisim)}</td><td>${request.konu ? `<strong>${escapeHtml(request.konu)}</strong><br>` : ""}${escapeHtml(request.mesaj)}</td><td><div class="row-actions"><button data-request="prepare" data-id="${escapeHtml(request.id)}">Lisans hazırla</button><button data-request="delete" data-id="${escapeHtml(request.id)}" class="danger" title="Talebi sil" aria-label="Talebi sil">${icon("trash-2")}</button></div></td></tr>`).join("") : '<tr><td colspan="5" class="empty">Henüz talep yok.</td></tr>';
    icons();
}

$("requestsBody").addEventListener("click", async event => {
    const button = event.target.closest("[data-request]");
    if (!button) return;
    const request = state.requests.find(item => item.id === button.dataset.id);
    if (!request) return;
    if (button.dataset.request === "prepare") {
        switchView("licenses");
        setMode("standard");
        $("licenseNote").value = `${request.ad} (${request.iletisim})`;
        $("createSection").scrollIntoView({ block: "center" });
    } else if (confirm("Bu talep silinsin mi?")) await run(button, async () => {
        await api(`/api/admin/talep/${encodeURIComponent(request.id)}`, {}, "DELETE");
        await refresh();
    });
});

function downloadBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.licenses, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `tikmng-lisans-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("export").addEventListener("click", downloadBackup);
$("import").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const licenses = JSON.parse(await file.text());
        if (!Array.isArray(licenses) || !licenses.length) throw new Error("Geçerli bir lisans yedeği seçin.");
        if (!confirm(`${licenses.length} lisans sunucuyla birleştirilsin mi? Mevcut lisansların kontenjan ve cihaz kayıtları değişmez.`)) return;
        const result = await api("/api/admin/lisanslar-senkronize", { lisanslar: licenses });
        toast(`${result.eklenen} lisans eklendi.`);
        await refresh();
    } catch (error) { toast(error.message); }
    finally { event.target.value = ""; }
});

// Older panels kept a browser backup. Recovery is explicit; stale data never replaces server membership.
function checkBrowserBackup() {
    try {
        const saved = JSON.parse(localStorage.getItem("mng_admin_lisans_yedek") || "[]");
        const missing = Array.isArray(saved) ? saved.filter(l => l?.kod && !state.licenses.some(current => current.kod === l.kod)) : [];
        let button = $("browserRecovery");
        if (!button && missing.length) {
            button = document.createElement("button");
            button.id = "browserRecovery";
            button.className = "secondary";
            $("import").parentElement.append(button);
            button.addEventListener("click", () => run(button, async () => {
                if (!confirm("Eski tarayıcı yedeğindeki eksik lisanslar sunucuya eklensin mi?")) return;
                await api("/api/admin/lisanslar-senkronize", { lisanslar: missing });
                await refresh();
            }));
        }
        if (button) { button.hidden = !missing.length; button.textContent = `Eski yedeği kurtar (${missing.length})`; }
    } catch { /* An invalid local backup must not prevent the server list from loading. */ }
}

async function init() {
    localStorage.removeItem("mng_admin_token");
    icons();
    try { await api("/api/admin/oturum"); showPanel(); await refresh(); }
    catch { showLogin(); }
}
init();
setInterval(() => {
    if (state.authenticated && !document.hidden && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) refresh();
}, 60000);
