"use strict";

const $ = id => document.getElementById(id);
const form = $("entryForm");
const state = { data: null, kind: "games", mode: "draft", selected: null, dirty: false, busy: false };
const icons = () => window.lucide?.createIcons();
const field = name => form.elements.namedItem(name);
const catalog = () => state.data[state.mode];
const changed = () => JSON.stringify(state.data.draft.games) !== JSON.stringify(state.data.published.games)
    || JSON.stringify(state.data.draft.media) !== JSON.stringify(state.data.published.media)
    || JSON.stringify(state.data.draft.launcher) !== JSON.stringify(state.data.published.launcher);

function error(message = "") { $("error").textContent = message; $("error").hidden = !message; }
function allowLeave() { return !state.dirty || window.confirm("Kaydedilmemiş değişiklikler silinsin mi?"); }
function markDirty() { state.dirty = true; $("editStatus").textContent = "Kaydedilmedi"; controls(); }
function controls() {
    for (const id of ["reload", "add", "gamesTab", "mediaTab", "launcherTab", "draftMode", "publishedMode"]) $(id).disabled = state.busy;
    for (const button of $("rows").querySelectorAll("button")) button.disabled = state.busy;
    $("entryFields").disabled = state.busy;
    $("launcherFields").disabled = state.busy;
    $("publish").disabled = state.busy || state.dirty || !state.data || !changed();
}
async function operation(action) {
    if (state.busy) return;
    state.busy = true; error(); controls();
    try { await action(); }
    catch (e) { error(e.message || "İşlem tamamlanamadı."); }
    finally { state.busy = false; controls(); }
}
async function api(method = "GET", body) {
    const response = await fetch(`/api/admin/content${method === "PUBLISH" ? "/publish" : ""}`, {
        method: method === "PUBLISH" ? "POST" : method, credentials: "same-origin", cache: "no-store",
        headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined
    });
    if (response.status === 401) {
        $("catalogApp").hidden = true; $("authRequired").hidden = false;
        throw new Error("Oturum sona erdi. Yönetici girişi gerekli.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(response.status === 409 ? "Katalog başka bir oturumda değişti. Yenileyip tekrar deneyin." : result.error || "İşlem tamamlanamadı.");
    return result;
}
function iconButton(name, title, action) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "icon"; button.title = title; button.setAttribute("aria-label", title);
    const icon = document.createElement("i"); icon.dataset.lucide = name; button.append(icon);
    button.addEventListener("click", action);
    return button;
}
function node(tag, value, className) {
    const element = document.createElement(tag); element.textContent = value;
    if (className) element.className = className;
    return element;
}
function render() {
    const { draft, published } = state.data;
    $("draftRevision").textContent = draft.revision;
    $("publishedRevision").textContent = published.revision;
    $("publishedAt").textContent = published.publishedAt ? new Date(published.publishedAt).toLocaleString("tr-TR") : "Henüz yok";
    $("status").textContent = changed() ? "Taslak değişiklikleri yayın bekliyor" : "Yayımlanan katalog ile güncel";
    $("gameCount").textContent = catalog().games.length;
    $("mediaCount").textContent = catalog().media.length;
    for (const kind of ["games", "media", "launcher"]) $(kind + "Tab").setAttribute("aria-selected", String(state.kind === kind));
    for (const mode of ["draft", "published"]) $(mode + "Mode").setAttribute("aria-pressed", String(state.mode === mode));
    $("add").hidden = state.mode === "published";
    $("add").lastChild.textContent = state.kind === "games" ? " Yeni oyun" : " Yeni medya";
    $("categoryFilter").hidden = state.kind !== "media";
    $("detailHeading").textContent = state.kind === "games" ? "Paket sürümü" : "Kategori";
    document.querySelector(".filterbar").hidden = state.kind === "launcher";
    document.querySelector(".content-grid").hidden = state.kind === "launcher";
    $("launcherEditor").hidden = state.kind !== "launcher";
    if (state.kind === "launcher") renderLauncher();
    const categories = [...new Set(catalog().media.map(item => item.category))].sort();
    const selectedCategory = $("categoryFilter").value;
    $("categoryFilter").replaceChildren(new Option("Tüm kategoriler", ""), ...categories.map(value => new Option(value, value)));
    if (categories.includes(selectedCategory)) $("categoryFilter").value = selectedCategory;
    $("categories").replaceChildren(...categories.map(value => new Option(value, value)));
    renderRows(); controls();
}
function renderRows() {
    if (state.kind === "launcher") return;
    const search = $("search").value.trim().toLocaleLowerCase("tr-TR");
    const category = state.kind === "media" ? $("categoryFilter").value : "";
    const items = catalog()[state.kind].filter(item => `${item.title} ${item.id}`.toLocaleLowerCase("tr-TR").includes(search) && (!category || item.category === category));
    $("rows").replaceChildren();
    for (const item of items) {
        const tr = document.createElement("tr");
        if (state.selected === item.id) tr.className = "selected";
        const title = document.createElement("td");
        title.append(node("span", item.title, "item-title"), node("span", item.id, "item-id"));
        const bytes = item.bytes === null ? "—" : `${(item.bytes / 1024 ** 2).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} MB`;
        const actions = document.createElement("td");
        actions.append(iconButton(state.mode === "published" ? "eye" : "pencil", `${item.title} ${state.mode === "published" ? "görüntüle" : "düzenle"}`, () => { if (allowLeave()) openEditor(item); }));
        tr.append(title, node("td", state.kind === "games" ? item.version : item.category), node("td", bytes), actions);
        $("rows").append(tr);
    }
    if (!items.length) { const tr = document.createElement("tr"); const td = node("td", "Kayıt bulunamadı", "empty"); td.colSpan = 4; tr.append(td); $("rows").append(tr); }
    $("resultCount").textContent = `${items.length} / ${catalog()[state.kind].length} kayıt`;
    icons();
}
function closeEditor() {
    state.selected = null; state.dirty = false; $("editor").hidden = true;
    document.querySelector(".content-grid").classList.remove("editing");
    if (state.data) { renderRows(); controls(); }
}
function resourceRow(resource = { title: "", url: "" }, readOnly = false) {
    const row = document.createElement("div"); row.className = "resource-row";
    for (const [name, label] of [["title", "Başlık"], ["url", "Kaynak URL"]]) {
        const wrapper = node("label", label); const input = document.createElement("input");
        input.dataset.resource = name; input.value = resource[name]; input.maxLength = name === "title" ? 120 : 2048;
        input.required = true; input.readOnly = readOnly; wrapper.append(input); row.append(wrapper);
    }
    if (!readOnly) row.append(iconButton("trash-2", "Kaynağı sil", () => { row.remove(); markDirty(); }));
    $("resources").append(row); icons();
}
function patchRow(file = { path: "", url: "", sha256: "", bytes: "" }, readOnly = false) {
    const row = document.createElement("div"); row.className = "patch-row";
    const heading = document.createElement("div"); heading.className = "patch-heading";
    for (const [name, title, max] of [["path", "Göreli dosya yolu", 240], ["url", "Dosya URL", 2048], ["sha256", "SHA-256", 64], ["bytes", "Byte", 20]]) {
        const label = node("label", title), input = document.createElement("input");
        input.dataset.patch = name; input.value = file[name]; input.maxLength = max; input.required = true; input.readOnly = readOnly;
        if (name === "bytes") { input.type = "number"; input.min = "1"; input.step = "1"; }
        if (name === "sha256") input.pattern = "[a-f0-9]{64}";
        label.append(input);
        if (name === "path") heading.append(label); else row.append(label);
    }
    if (!readOnly) heading.append(iconButton("trash-2", "Yama dosyasını sil", () => { row.remove(); markDirty(); }));
    row.prepend(heading); $("files").append(row); icons();
}
function openEditor(item = null) {
    state.selected = item?.id ?? ""; state.dirty = !item;
    form.reset(); $("resources").replaceChildren(); $("files").replaceChildren();
    $("uploadStatus").textContent = ""; $("uploadProgress").hidden = true;
    const isGame = state.kind === "games", readOnly = state.mode === "published";
    for (const name of ["id", "title", "description", "version", "requirements", "category", "url", "sha256", "bytes"]) {
        field(name).value = item?.[name] ?? ""; field(name).readOnly = readOnly || (name === "id" && !!item);
    }
    field("version").required = isGame; field("category").required = !isGame;
    $("gameFields").hidden = !isGame; $("mediaFields").hidden = isGame;
    $("resourcesSection").hidden = !isGame;
    $("filesSection").hidden = !isGame;
    $("videoFile").disabled = readOnly;
    $("upload").hidden = readOnly;
    $("urlLabel").firstChild.textContent = isGame ? "Paket URL" : "Video URL";
    $("editorTitle").textContent = `${item ? (readOnly ? "Yayımlanan" : "Düzenle:") : "Yeni"} ${isGame ? "oyun" : "medya"}`;
    $("editStatus").textContent = readOnly ? "Yayımlanan kayıt" : item ? "Taslak" : "Kaydedilmedi";
    $("save").hidden = readOnly; $("deleteEntry").hidden = readOnly || !item; $("addResource").hidden = readOnly; $("addFile").hidden = readOnly;
    for (const resource of item?.resources || []) resourceRow(resource, readOnly);
    for (const file of item?.files || []) patchRow(file, readOnly);
    $("editor").hidden = false; document.querySelector(".content-grid").classList.add("editing");
    renderRows(); controls(); field(item ? "title" : "id").focus();
}
async function saveDraft(next) {
    state.data = await api("PUT", { expectedRevision: state.data.draft.revision, draft: next });
    state.dirty = false; render();
}
form.addEventListener("input", () => { if (state.mode === "draft") markDirty(); });
form.addEventListener("submit", event => {
    event.preventDefault();
    if (state.mode !== "draft") return;
    operation(async () => {
        const item = {};
        for (const name of ["id", "title", "url", "sha256"]) item[name] = field(name).value.trim();
        item.sha256 ||= null; item.bytes = field("bytes").value ? Number(field("bytes").value) : null;
        if (state.kind === "games") {
            for (const name of ["description", "version", "requirements"]) item[name] = field(name).value.trim();
            item.resources = [...$("resources").children].map(row => ({ title: row.querySelector('[data-resource="title"]').value.trim(), url: row.querySelector('[data-resource="url"]').value.trim() }));
            const files = [...$("files").children].map(row => ({ path: row.querySelector('[data-patch="path"]').value.trim(), url: row.querySelector('[data-patch="url"]').value.trim(), sha256: row.querySelector('[data-patch="sha256"]').value.trim(), bytes: Number(row.querySelector('[data-patch="bytes"]').value) }));
            const existing = state.data.draft.games.find(entry => entry.id === state.selected);
            if (files.length || existing?.files !== undefined) item.files = files;
        } else item.category = field("category").value.trim();
        const next = structuredClone(state.data.draft);
        const index = next[state.kind].findIndex(entry => entry.id === state.selected);
        if (index < 0) next[state.kind].push(item); else next[state.kind][index] = item;
        await saveDraft(next); openEditor(state.data.draft[state.kind].find(entry => entry.id === item.id));
        $("editStatus").textContent = "Taslak kaydedildi";
    });
});
$("deleteEntry").addEventListener("click", () => {
    if (!window.confirm("Bu içerik taslaktan silinsin mi?")) return;
    operation(async () => {
        const next = structuredClone(state.data.draft);
        next[state.kind] = next[state.kind].filter(item => item.id !== state.selected);
        await saveDraft(next); closeEditor();
    });
});
$("addResource").addEventListener("click", () => { if ($("resources").children.length < 8) { resourceRow(); markDirty(); } });
$("addFile").addEventListener("click", () => { if ($("files").children.length < 256) { patchRow(); markDirty(); } });
$("closeEditor").addEventListener("click", () => { if (allowLeave()) closeEditor(); });
$("add").addEventListener("click", () => { if (allowLeave()) openEditor(); });
$("search").addEventListener("input", renderRows);
$("categoryFilter").addEventListener("change", renderRows);
for (const kind of ["games", "media", "launcher"]) $(kind + "Tab").addEventListener("click", () => {
    if (!allowLeave()) return; closeEditor(); state.kind = kind; $("search").value = ""; render();
});
for (const mode of ["draft", "published"]) $(mode + "Mode").addEventListener("click", () => {
    if (!allowLeave()) return; closeEditor(); state.mode = mode; render();
});
$("reload").addEventListener("click", () => {
    if (!allowLeave()) return;
    operation(async () => { const data = await api(); state.data = data; closeEditor(); render(); });
});
$("publish").addEventListener("click", () => {
    if (!window.confirm(`Taslak revizyon ${state.data.draft.revision} yayımlansın mı?`)) return;
    operation(async () => { state.data = await api("PUBLISH", { expectedRevision: state.data.draft.revision }); closeEditor(); render(); });
});
function launcherAvailability() {
    const enabled = $("launcherEnabled").checked;
    $("launcherValues").hidden = !enabled;
    for (const id of ["launcherVersion", "launcherUrl", "launcherHash", "launcherBytes"]) $(id).required = enabled;
}
function renderLauncher() {
    const value = catalog().launcher, readOnly = state.mode === "published";
    $("launcherEnabled").checked = !!value; $("launcherEnabled").disabled = readOnly;
    for (const [id, name] of [["launcherVersion", "version"], ["launcherUrl", "downloadUrl"], ["launcherHash", "sha256"], ["launcherBytes", "bytes"], ["launcherChangelog", "changelog"]]) {
        $(id).value = value?.[name] ?? ""; $(id).readOnly = readOnly;
    }
    $("launcherStatus").textContent = value ? (readOnly ? "Yayımlanan kayıt" : "Taslak") : "Launcher kaydı yok";
    $("saveLauncher").hidden = readOnly; launcherAvailability();
}
$("launcherForm").addEventListener("input", () => {
    if (state.mode === "draft") { markDirty(); $("launcherStatus").textContent = "Kaydedilmedi"; launcherAvailability(); }
});
$("launcherForm").addEventListener("submit", event => {
    event.preventDefault();
    if (state.mode !== "draft") return;
    operation(async () => {
        const next = structuredClone(state.data.draft);
        if (!$("launcherEnabled").checked) delete next.launcher;
        else next.launcher = { version: $("launcherVersion").value.trim(), downloadUrl: $("launcherUrl").value.trim(), sha256: $("launcherHash").value.trim(), bytes: Number($("launcherBytes").value), changelog: $("launcherChangelog").value.trim() };
        await saveDraft(next); $("launcherStatus").textContent = "Taslak kaydedildi";
    });
});
$("upload").addEventListener("click", () => operation(async () => {
    const file = $("videoFile").files[0];
    if (!file || !/\.(mp4|webm)$/i.test(file.name)) throw new Error("MP4 veya WebM video seçin.");
    if (file.size > 100 * 1024 ** 2) throw new Error("Video en fazla 100 MB olabilir.");
    const extension = file.name.split(".").pop().toLowerCase();
    $("uploadProgress").hidden = false; $("uploadProgress").value = 0; $("uploadStatus").textContent = "Yükleniyor";
    try {
        const result = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `/api/admin/content/upload?filename=${encodeURIComponent(file.name)}`);
            xhr.setRequestHeader("Content-Type", `video/${extension}`); xhr.timeout = 10 * 60 * 1000;
            xhr.upload.onprogress = event => { if (event.lengthComputable) $("uploadProgress").value = event.loaded / event.total * 100; };
            xhr.onerror = () => reject(new Error("Video yüklenemedi."));
            xhr.ontimeout = () => reject(new Error("Video yüklemesi zaman aşımına uğradı."));
            xhr.onload = () => {
                if (xhr.status === 401) { $("catalogApp").hidden = true; $("authRequired").hidden = false; }
                let data; try { data = JSON.parse(xhr.responseText); } catch { reject(new Error("Video yüklenemedi.")); return; }
                if (xhr.status !== 201) reject(new Error(data.error || "Video yüklenemedi.")); else resolve(data);
            };
            xhr.send(file);
        });
        for (const name of ["url", "sha256", "bytes"]) field(name).value = result[name];
        if (!field("id").value) field("id").value = result.id;
        if (!field("title").value) field("title").value = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
        $("uploadStatus").textContent = "Yüklendi"; markDirty();
    } catch (e) { $("uploadStatus").textContent = "Yüklenemedi"; throw e; }
}));
window.addEventListener("beforeunload", event => { if (state.dirty || state.busy) { event.preventDefault(); event.returnValue = ""; } });
icons();
operation(async () => {
    state.data = await api(); $("catalogApp").hidden = false; render();
}).finally(() => { $("loading").hidden = true; });
