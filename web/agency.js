(() => {
  const byId = id => document.getElementById(id);
  const date = value => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const states = { beklemede: "İlk giriş bekleniyor", aktif: "Aktif", iptal: "İptal edildi", arsivlendi: "Kapatıldı", suresi_doldu: "Süresi doldu" };
  function status(message = "", error = false) { byId("status").textContent = message; byId("status").classList.toggle("error", error); }
  function loggedOut() {
    byId("loginPanel").hidden = false;
    byId("dashboard").hidden = true;
    byId("publishers").replaceChildren();
    byId("legacy").replaceChildren();
    byId("agencyName").textContent = "";
  }
  async function api(route, body) {
    const response = await fetch(`/api/agency/${route}`, { method: body === undefined ? "GET" : "POST",
      credentials: "same-origin", cache: "no-store", headers: body === undefined ? {} : { "Content-Type": "application/json", "X-TikMnG-Agency": "1" },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) loggedOut();
      throw new Error(data.error || "İşlem tamamlanamadı. Tekrar deneyin.");
    }
    return data;
  }
  async function busy(form, action) {
    const buttons = [...form.querySelectorAll("button")];
    buttons.forEach(button => { button.disabled = true; });
    status();
    try { await action(); } catch (error) { status(error.message, true); }
    finally { buttons.forEach(button => { if (button.isConnected) button.disabled = button.dataset.full === "true"; }); }
  }
  function render(data) {
    byId("loginPanel").hidden = true;
    byId("dashboard").hidden = false;
    byId("agencyName").textContent = data.ajans_adi;
    byId("period").textContent = data.bitis_zamani ? `Ajans süresi: ${date(data.bitis_zamani)} tarihine kadar.`
      : data.sure_birim === "sinirsiz" ? "Ajans süresi: sınırsız." : "Ajans süresi ilk yayıncı aktivasyonunda başlayacak.";
    for (const [id, key] of [["used", "kullanilan"], ["capacity", "kapasite"], ["remaining", "bos"]]) byId(id).textContent = data[key];
    byId("createPublisher").disabled = data.bos < 1;
    byId("createPublisher").dataset.full = String(data.bos < 1);
    byId("empty").hidden = data.yayincilar.length > 0;
    byId("publishers").replaceChildren();
    for (const publisher of data.yayincilar) {
      const row = document.createElement("li");
      const info = document.createElement("div"); info.className = "publisher-info";
      for (const [tag, text] of [["strong", publisher.ad], ["code", publisher.kod], ["small", `${states[publisher.durum] || "Kapalı"}${publisher.bitis_zamani ? ` · ${date(publisher.bitis_zamani)}` : ""}`]]) {
        const element = document.createElement(tag); element.textContent = text; info.append(element);
      }
      row.append(info);
      if (!["iptal", "arsivlendi"].includes(publisher.durum)) {
        const actions = document.createElement("div"); actions.className = "row-actions";
        const copy = document.createElement("button"); copy.type = "button"; copy.className = "secondary"; copy.textContent = "Kodu kopyala";
        copy.addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(publisher.kod); status("Yayıncı kodu kopyalandı."); }
          catch { status("Kopyalanamadı. Görünen kodu seçip elle kopyalayabilirsiniz.", true); }
        });
        const revoke = document.createElement("button"); revoke.type = "button"; revoke.className = "danger"; revoke.textContent = "İptal et";
        revoke.addEventListener("click", () => {
          if (!window.confirm(`${publisher.ad} için yayıncı lisansı iptal edilsin mi? Bu kod tekrar kullanılamaz.`)) return;
          busy(actions, async () => { render(await api(`publishers/${encodeURIComponent(publisher.id)}/revoke`, {})); status("Yayıncı lisansı iptal edildi."); });
        });
        actions.append(copy, revoke); row.append(actions);
      }
      byId("publishers").append(row);
    }
    byId("legacyPanel").hidden = data.mevcut_cihazlar.length === 0;
    byId("legacy").replaceChildren();
    data.mevcut_cihazlar.forEach((member, index) => {
      const row = document.createElement("li"); row.textContent = member.ad || `Mevcut yayıncı ${index + 1}`; byId("legacy").append(row);
    });
  }
  byId("loginForm").addEventListener("submit", event => {
    event.preventDefault();
    busy(event.currentTarget, async () => {
      const code = byId("agencyCode").value.trim();
      if (!/^MNGA-[A-F0-9]{64}$/i.test(code)) {
        throw new Error("Panel için MNGA- ile başlayan giriş kodunu kullanın. Yönetici bu kodu “Panel giriş kodu oluştur” düğmesinden alabilir.");
      }
      await api("login", { code });
      byId("agencyCode").value = "";
      render(await api("session")); byId("logout").focus();
    });
  });
  byId("publisherForm").addEventListener("submit", async event => {
    event.preventDefault();
    await busy(event.currentTarget, async () => {
      render(await api("publishers", { ad: byId("publisherName").value }));
      byId("publisherName").value = ""; status("Yayıncı lisansı oluşturuldu. Kodu yayıncınızla paylaşabilirsiniz.");
    });
  });
  byId("logout").addEventListener("click", () => busy(byId("dashboard"), async () => {
    await api("logout", {}); loggedOut(); byId("agencyCode").focus(); status("Oturum kapatıldı.");
  }));
  api("session").then(render).catch(error => { loggedOut(); if (!error.message.startsWith("Ajans oturumu gerekli")) status(error.message, true); });
})();
