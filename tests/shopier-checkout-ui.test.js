import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { salesPlans } from "../web/sales-catalog.js";

const html = readFileSync(new URL("../web/shopier-checkout.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../web/shopier-checkout.js", import.meta.url), "utf8")
    .replace(/^\uFEFF?import[^\n]+\n/, "");
const storageKey = "tikmng-shopier-checkout";
const origin = "https://tikmng.test";
const quote = (overrides = {}) => ({
    token: "signed-token", paymentUrl: "/satin-al/odeme?token=signed-token", amountMinor: 30000,
    planId: "individual-weekly", username: "@ornek", ...overrides,
});
const response = (body, status = 200, headers = {}) => status === 204
    ? new Response(null, { status }) : Response.json(body, { status, headers });
const pending = () => response({ error: "legacy reference text must never reach pending UI" }, 409);
const issued = (overrides = {}) => response({ code: "MNG-TEST-1234", planId: "individual-weekly", ...overrides });
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function untilAbort(_url, options) {
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
    }, { once: true }));
}

function harness({ saved, mode = "shopier-individual", search = "", popup = true, storageFails = false,
    current = () => response(null, 204), open = () => response(quote()), redeem = pending,
    clipboardFails = false } = {}) {
    let now = 0;
    let timerId = 0;
    const timers = new Map();
    const log = [];
    const calls = [];
    const elements = new Map();
    const storage = new Map(saved === undefined ? [] : [[storageKey, typeof saved === "string" ? saved : JSON.stringify(saved)]]);
    class Target {
        listeners = new Map();
        addEventListener(type, action) {
            const actions = this.listeners.get(type) || [];
            actions.push(action);
            this.listeners.set(type, actions);
        }
        emit(type, extras = {}) {
            const event = { preventDefault() {}, ...extras };
            return Promise.all((this.listeners.get(type) || []).map(action => action(event)));
        }
    }
    class Element extends Target {
        value = "";
        textContent = "";
        hidden = false;
        disabled = false;
        options = [];
        attributes = new Map();
        add(option) { this.options.push(option); if (!this.value) this.value = option.value; }
        setAttribute(name, value) { this.attributes.set(name, value); }
        removeAttribute(name) { this.attributes.delete(name); }
        reportValidity() { return this.valid !== false; }
        focus() { this.focused = true; }
        select() { this.selected = true; }
    }
    for (const [tag, id] of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
        const element = new Element();
        element.hidden = /\shidden(?:\s|>)/.test(tag);
        elements.set(id, element);
    }
    const el = id => {
        assert.ok(elements.has(id), `UI uses an element in its HTML: ${id}`);
        return elements.get(id);
    };
    const document = new Target();
    document.hidden = false;
    document.getElementById = el;
    document.querySelector = () => ({ content: mode });
    const paymentTab = { closed: false, opener: {},
        location: { replace(url) { log.push(["navigate-popup", url, storage.get(storageKey)]); } },
        close() { this.closed = true; log.push(["close-popup"]); },
    };
    const window = new Target();
    window.open = (...args) => { log.push(["open", ...args]); paymentTab.closed = false; return popup ? paymentTab : null; };
    const location = { origin, search, assign(url) { log.push(["navigate-page", url, storage.get(storageKey)]); } };
    const context = {
        salesPlans, document, window, location, URL, URLSearchParams, Intl, AbortController,
        Date: class extends Date { static now() { return now; } },
        Option: class { constructor(text, value) { this.text = text; this.value = value; } },
        sessionStorage: {
            getItem(key) { return storage.get(key) ?? null; },
            setItem(key, value) { if (storageFails) throw Error("storage unavailable"); storage.set(key, value); },
        },
        navigator: { clipboard: { async writeText(value) { if (clipboardFails) throw Error("denied"); log.push(["copy", value]); } } },
        setTimeout(callback, delay = 0) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        fetch(url, options) {
            calls.push({ url, method: options.method, payload: options.body ? JSON.parse(options.body) : undefined, signal: options.signal });
            log.push(["fetch", url]);
            const action = url.endsWith("/current") ? current : url.endsWith("/checkout") ? open : redeem;
            return Promise.resolve(action(url, options));
        },
    };
    vm.runInNewContext(script, context, { filename: "web/shopier-checkout.js" });
    async function advance(ms = 0) {
        await flush();
        const end = now + ms;
        let steps = 0;
        while (true) {
            const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            assert.ok(++steps < 100, "bounded timers");
            const [id, timer] = next;
            timers.delete(id);
            now = timer.at;
            timer.callback();
            await flush();
        }
        now = end;
        await flush();
    }
    return { el, document, window, paymentTab, storage, log, calls, timers, advance,
        submits: () => el("start-checkout").emit("submit"),
        requests: suffix => calls.filter(call => call.url.endsWith(suffix)),
    };
}

test("checkout has one prominent payment action and no manual matching fields", () => {
    assert.equal([...html.matchAll(/type="submit"/g)].length, 1);
    assert.match(html, /id="pay-button" class="checkout-primary"/);
    assert.doesNotMatch(html, /id="(?:reference|order-id|copy-reference|confirm-payment|shopier-link)"/);
    assert.match(html, /Lisans süren ilk etkinleştirmede başlar\./);
    const css = readFileSync(new URL("../web/purchase-preview.css", import.meta.url), "utf8")
        .split("/* Shopier checkout only; shared purchase and admin previews keep their layouts. */")[1];
    assert.ok(css);
    for (const match of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
        const selectors = match[1].trim();
        for (const selector of selectors.split(",")) assert.ok(selector.trim().startsWith(".checkout-page"), selector);
    }
});

test("individual mode only offers individual packages and honors allowed plan deep links", async () => {
    const ui = harness({ search: "?plan=individual-monthly" });
    assert.equal(ui.el("start-checkout").hidden, true, "wait for cookie recovery before showing empty form");
    await flush();
    assert.equal(ui.el("start-checkout").hidden, false);
    assert.deepEqual(ui.el("plan").options.map(option => option.value), ["individual-weekly", "individual-monthly"]);
    assert.equal(ui.el("plan").value, "individual-monthly");
    assert.match(ui.el("checkout-total").textContent, /800/);
    const forbidden = harness({ search: "?plan=agency-10-monthly" });
    assert.equal(forbidden.el("plan").value, "individual-weekly");
    const full = harness({ mode: "shopier", search: "?plan=agency-10-monthly" });
    assert.equal(full.el("plan").options.length, salesPlans.length);
    assert.equal(full.el("username-label").textContent, "Ajans adı");
});

test("a user click reserves the provider tab before fetching, persists the quote, and reuses it", async () => {
    const opening = deferred();
    const ui = harness({ open: () => opening.promise });
    await flush();
    ui.el("username").value = " @ornek ";
    const first = ui.submits();
    const duplicate = ui.submits();
    assert.equal(ui.log.findIndex(item => item[0] === "open") < ui.log.findIndex(item => item[1] === "/api/shopier/checkout"), true);
    assert.equal(ui.requests("/checkout").length, 1);
    assert.deepEqual(ui.requests("/checkout")[0].payload, { planId: "individual-weekly", username: "@ornek" });
    assert.equal(ui.paymentTab.opener, null);
    opening.resolve(response({ token: quote().token, paymentUrl: quote().paymentUrl, amountMinor: quote().amountMinor }));
    await Promise.all([first, duplicate]);
    const navigation = ui.log.find(item => item[0] === "navigate-popup");
    assert.equal(navigation[1], new URL(quote().paymentUrl, origin).href);
    assert.equal(JSON.parse(navigation[2]).token, quote().token, "persist before navigation");
    assert.equal(ui.el("pay-button").disabled, false);
    await ui.submits();
    assert.equal(ui.requests("/checkout").length, 1, "reopening an unpaid quote must not replace its hidden product");
});

test("blocked popups use same-tab navigation only after preserving the return token", async () => {
    const ui = harness({ popup: false });
    await flush();
    ui.el("username").value = "@ornek";
    await ui.submits();
    const navigation = ui.log.find(item => item[0] === "navigate-page");
    assert.equal(navigation[1], new URL(quote().paymentUrl, origin).href);
    assert.equal(JSON.parse(navigation[2]).token, quote().token);
    const blocked = harness({ popup: false, storageFails: true });
    await flush();
    blocked.el("username").value = "@ornek";
    await blocked.submits();
    assert.equal(blocked.log.some(item => item[0] === "navigate-page"), false);
    assert.match(blocked.el("start-status").textContent, /kaydedemedi/);
});

test("checkout failures and timeouts close only the reserved tab and allow retry", async () => {
    for (const action of [() => response({ error: "Paket kullanılamıyor." }, 503), untilAbort]) {
        const ui = harness({ open: action });
        await flush();
        ui.el("username").value = "@ornek";
        const submitting = ui.submits();
        await ui.advance(12000);
        await submitting;
        assert.equal(ui.paymentTab.closed, true);
        assert.equal(ui.el("pay-button").disabled, false);
        assert.ok(ui.el("start-status").textContent);
        assert.equal(ui.storage.has(storageKey), false);
    }
});

test("payment URLs allow the exact own-origin token route and legacy product URLs only", async () => {
    for (const paymentUrl of ["/satin-al/odeme?token=signed-token", `${origin}/satin-al/odeme?token=signed-token`,
        "https://www.shopier.com/tikmng/52768054", "https://www.shopier.com/52768054"]) {
        const ui = harness({ saved: quote({ paymentUrl }), redeem: () => issued() });
        await ui.advance();
        assert.equal(ui.requests("/current").length, 0);
        assert.equal(ui.el("issued-license").hidden, false, paymentUrl);
    }
    for (const paymentUrl of ["https://evil.test/satin-al/odeme?token=signed-token", "javascript:alert(1)",
        "/satin-al/odeme?token=other", "/satin-al/odeme?token=signed-token&next=evil", "/satin-al/odeme/?token=signed-token",
        "https://www.shopier.com.evil.test/tikmng/1", "https://www.shopier.com/tikmng/1?next=evil", "//evil.test/1"]) {
        const ui = harness({ open: () => response(quote({ paymentUrl })) });
        await flush();
        ui.el("username").value = "@ornek";
        await ui.submits();
        assert.equal(ui.paymentTab.closed, true, paymentUrl);
        assert.equal(ui.log.some(item => item[0].startsWith("navigate-")), false, paymentUrl);
    }
});

test("legacy saved quotes redeem automatically with only their token and never expose a reference", async () => {
    for (const verification of [undefined, "osb"]) {
        const old = { token: "old-token", paymentUrl: "https://www.shopier.com/tikmng/52768054", amountMinor: 100,
            verification, reference: "MNG-OLD-SECRET", orderId: "123", paymentOpened: false };
        const ui = harness({ saved: old, redeem: () => issued() });
        await ui.advance();
        assert.equal(ui.requests("/current").length, 0);
        assert.deepEqual(ui.requests("/redeem")[0].payload, { token: "old-token" });
        assert.equal(ui.el("license-code").value, "MNG-TEST-1234");
        assert.equal(ui.el("issued-license").hidden, false);
        assert.equal(ui.el("start-checkout").hidden, true);
        assert.equal(ui.el("quote-summary").textContent.includes(old.reference), false);
        await ui.el("copy-license").emit("click");
        assert.ok(ui.log.some(item => item[0] === "copy" && item[1] === "MNG-TEST-1234"));
        await ui.advance(600000);
        await ui.window.emit("focus");
        assert.equal(ui.requests("/redeem").length, 1, "paid checkouts stop polling");
    }
});

test("a new return tab recovers once from its cookie before automatic verification", async () => {
    const recovering = deferred();
    const ui = harness({ current: () => recovering.promise, redeem: () => issued() });
    assert.equal(ui.el("start-checkout").hidden, true);
    assert.equal(ui.requests("/current")[0].method, "GET");
    assert.equal(ui.requests("/current")[0].payload, undefined);
    recovering.resolve(response({ token: quote().token, paymentUrl: quote().paymentUrl, amountMinor: quote().amountMinor,
        reference: "HIDDEN", verification: "automatic" }));
    await ui.advance();
    assert.equal(ui.el("issued-license").hidden, false);
    assert.equal(JSON.parse(ui.storage.get(storageKey)).token, quote().token);
    for (let i = 0; i < 3; i++) {
        await ui.window.emit("focus");
        await ui.document.emit("visibilitychange");
    }
    assert.equal(ui.requests("/current").length, 1);
    assert.equal(ui.requests("/redeem").length, 1);
});

test("late cookie recovery cannot replace a quote created by a new submission", async () => {
    const recovering = deferred();
    const newer = quote({ token: "new-token", paymentUrl: "/satin-al/odeme?token=new-token" });
    const ui = harness({ current: () => recovering.promise, open: () => response(newer) });
    ui.el("username").value = "@ornek";
    await ui.submits();
    recovering.resolve(response(quote()));
    await ui.advance();
    assert.equal(JSON.parse(ui.storage.get(storageKey)).token, "new-token");
    assert.deepEqual(ui.requests("/redeem").map(call => call.payload), [{ token: "new-token" }]);
});

test("focus and visibility use a single request, pending never claims payment, hidden pages stop", async () => {
    const verifying = deferred();
    let checks = 0;
    const ui = harness({ saved: quote(), redeem: () => ++checks === 1 ? verifying.promise : issued() });
    await ui.advance();
    await ui.window.emit("focus");
    await ui.document.emit("visibilitychange");
    await ui.window.emit("pageshow");
    assert.equal(ui.requests("/redeem").length, 1);
    assert.equal(ui.el("issued-license").hidden, true);
    assert.doesNotMatch(ui.el("payment-label").textContent, /ONAYLANDI/);
    ui.document.hidden = true;
    await ui.document.emit("visibilitychange");
    assert.equal(ui.requests("/redeem")[0].signal.aborted, true);
    verifying.resolve(issued());
    await ui.advance(120000);
    assert.equal(ui.el("issued-license").hidden, true, "ignore late results from an aborted request");
    assert.equal(ui.requests("/redeem").length, 1);
    ui.document.hidden = false;
    await ui.document.emit("visibilitychange");
    await ui.window.emit("focus");
    await ui.advance();
    assert.equal(ui.requests("/redeem").length, 2);
    assert.equal(ui.el("issued-license").hidden, false);
    for (const [name, actions] of ui.window.listeners) assert.equal(actions.length, 1, name);
    assert.equal(ui.document.listeners.get("visibilitychange").length, 1);
});

test("pending checks are bounded with an enabled recovery action and no manual reference instructions", async () => {
    const ui = harness({ saved: quote() });
    await ui.advance(600000);
    assert.equal(ui.requests("/redeem").length, 12);
    assert.equal(ui.el("retry-check").hidden, false);
    assert.equal(ui.el("retry-check").disabled, false);
    assert.equal(ui.el("pay-button").disabled, false);
    assert.match(ui.el("confirm-status").textContent, /yeniden başlat/);
    assert.doesNotMatch(ui.el("confirm-status").textContent, /reference|referans|sipariş notu/i);
    await ui.advance(600000);
    assert.equal(ui.requests("/redeem").length, 12);
    await ui.el("retry-check").emit("click");
    await ui.advance();
    assert.equal(ui.requests("/redeem").length, 13);
});

test("timed-out verification retries and rate limits survive return-focus bursts", async () => {
    let checks = 0;
    const ui = harness({ saved: quote(), redeem: (...args) => ++checks === 1 ? untilAbort(...args) : issued() });
    await ui.advance(12000);
    assert.match(ui.el("confirm-status").textContent, /otomatik tekrar/);
    assert.equal(ui.el("issued-license").hidden, true);
    await ui.advance(5000);
    assert.equal(ui.el("issued-license").hidden, false);
    const limited = harness({ saved: quote(), redeem: () => response({}, 429, { "Retry-After": "60" }) });
    await limited.advance(5000);
    await limited.window.emit("focus");
    await limited.document.emit("visibilitychange");
    await limited.advance(54000);
    assert.equal(limited.requests("/redeem").length, 1);
    await limited.advance(1000);
    assert.equal(limited.requests("/redeem").length, 2);
});

test("hiding during the last allowed check still permits verification on return", async () => {
    let checks = 0;
    const ui = harness({ saved: quote(), redeem: (...args) => ++checks <= 11 ? pending() : checks === 12 ? untilAbort(...args) : issued() });
    await ui.advance(270000);
    assert.equal(ui.requests("/redeem").length, 12);
    ui.document.hidden = true;
    await ui.document.emit("visibilitychange");
    await ui.advance(60000);
    ui.document.hidden = false;
    await ui.document.emit("visibilitychange");
    await ui.advance();
    assert.equal(ui.el("issued-license").hidden, false);
});

test("replacing a quote ignores old results and failed replacement keeps its stored predecessor", async () => {
    const oldResult = deferred();
    const ui = harness({ saved: quote(), redeem: () => oldResult.promise,
        open: () => response(quote({ token: "new-token", paymentUrl: "/satin-al/odeme?token=new-token", amountMinor: 80000 })) });
    await ui.advance();
    await ui.el("change-checkout").emit("click");
    ui.el("plan").value = "individual-monthly";
    ui.el("username").value = "@newuser";
    await ui.submits();
    oldResult.resolve(issued());
    await flush();
    assert.equal(ui.el("issued-license").hidden, true);
    assert.equal(JSON.parse(ui.storage.get(storageKey)).token, "new-token");
    const failed = harness({ saved: quote(), open: () => response({}, 503) });
    await failed.el("change-checkout").emit("click");
    failed.el("plan").value = "individual-monthly";
    await failed.submits();
    assert.equal(JSON.parse(failed.storage.get(storageKey)).token, quote().token);
});

test("page leave aborts requests; history return resumes; copy denial selects the readable code", async () => {
    const ui = harness({ saved: quote(), redeem: untilAbort });
    await ui.advance();
    await ui.window.emit("pagehide");
    assert.equal(ui.requests("/redeem")[0].signal.aborted, true);
    await ui.advance(120000);
    assert.equal(ui.requests("/redeem").length, 1);
    await ui.window.emit("pageshow");
    await ui.advance();
    assert.equal(ui.requests("/redeem").length, 2);
    const copy = harness({ saved: quote(), redeem: () => issued(), clipboardFails: true });
    await copy.advance();
    await copy.el("copy-license").emit("click");
    assert.equal(copy.el("license-code").selected, true);
    assert.match(copy.el("copy-status").textContent, /Kod seçildi/);
});

test("malformed local storage and cookie recovery timeouts leave a usable form", async () => {
    const ui = harness({ saved: "{bad json", current: untilAbort });
    await ui.advance(12000);
    assert.equal(ui.requests("/current").length, 1);
    assert.equal(ui.el("start-checkout").hidden, false);
    assert.equal(ui.el("restore-status").hidden, true);
    assert.match(ui.el("start-status").textContent, /sayfayı yenileyerek/);
    await ui.window.emit("focus");
    await ui.advance(60000);
    assert.equal(ui.requests("/current").length, 1);
});
