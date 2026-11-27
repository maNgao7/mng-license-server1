'use strict';

const DEFAULT_OPTIONS = Object.freeze({
    windowMs: 60000,
    maxSamples: 256,
    maxEventIds: 1024,
    heartbeatIntervalMs: null,
    widgetRttWarningMs: 500,
    renderFPSWarning: 24,
    denseEventsPerMinute: 120,
    minDensityDurationMs: 10000
});
const EVENT_TYPES = ['chat', 'gift', 'like', 'follow', 'share', 'member', 'subscribe', 'viewer'];
const INTERACTIONS = new Set(['chat', 'gift', 'like', 'follow', 'share', 'subscribe']);
const STATES = new Set(['disconnected', 'connecting', 'connected', 'waiting', 'error', 'idle', 'retrying']);
const REASONS = new Set(['idle', 'connecting', 'connected', 'offline', 'stream-ended', 'disconnected',
    'timeout', 'sdk-load', 'invalid-connection', 'invalid-room', 'auth', 'rate-limit', 'network',
    'connection', 'invalid-username', 'stopped', 'closed', 'replaced']);

function numeric(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function option(options, name, min, max, integer = false) {
    const value = options[name] === undefined ? DEFAULT_OPTIONS[name] : options[name];
    if (!numeric(value, min, max) || (integer && !Number.isInteger(value))) throw new RangeError(`Invalid ${name}`);
    return value;
}

// Eviction is disclosed until its timestamp leaves the rolling window.
function buffer(limit) {
    const values = new Array(limit);
    let head = 0, size = 0, evictedThrough = null;
    function prune(cutoff) {
        while (size && values[head].at <= cutoff) {
            values[head] = undefined;
            head = (head + 1) % limit;
            size--;
        }
    }
    return {
        push(sample, cutoff) {
            prune(cutoff);
            if (size === limit) {
                evictedThrough = values[head].at;
                values[head] = undefined;
                head = (head + 1) % limit;
                size--;
            }
            values[(head + size++) % limit] = sample;
        },
        read(cutoff) {
            prune(cutoff);
            return { samples: Array.from({ length: size }, (_, index) => values[(head + index) % limit]),
                complete: evictedThrough === null || evictedThrough <= cutoff };
        }
    };
}

function eventId(payload) {
    const raw = [payload.eventId, payload.msgId, payload.common?.msgId, payload.logId, payload.id]
        .find(value => value !== undefined && value !== null && value !== '');
    if (typeof raw === 'number' && !Number.isSafeInteger(raw)) return null;
    if (!['string', 'number', 'bigint'].includes(typeof raw)) return null;
    const id = String(raw);
    return id.length > 0 && id.length <= 256 ? id : null;
}

/**
 * Passive, local diagnostics for ONE event transport and ONE widget measurement
 * scope. No timers, I/O, SDK imports, payload history or credentials are used.
 *
 * Exports: { createStreamHealth, DEFAULT_OPTIONS }.
 * Instance: { update, observeEvent, snapshot, reset }.
 * update({ at?, status?, reason?, attempt?, lastEventAt?, heartbeatAt?,
 *          reconnects?, droppedEvents?, widgetRttMs?, renderFPS? }) => snapshot.
 * observeEvent(type, SDKPayload?) => boolean accepted. Counts callback envelopes,
 * not likeCount/repeatCount, people, impressions, watch time or platform totals.
 * snapshot() => schemaVersion 1; reset() => new empty session snapshot.
 *
 * All timestamps use the injected epoch-ms clock. `at` is measurement time, NOT
 * report-delivery time. Future, pre-session and out-of-order samples are ignored.
 * A missing/null metric supplies no measurement; it never becomes a zero.
 * Reset at broadcaster/room change or a deliberate new start; keep retry attempts
 * within the same session. Do not mix overlay pong with LIVE-ingest heartbeat.
 * heartbeatIntervalMs opts into an expected heartbeat (overdue after 3 intervals).
 * A heartbeat warning requests verification; it never asserts disconnection.
 *
 * Counters are cumulative within their source: the first value is a baseline;
 * decreases rebaseline with a reset count, without guessing lost increments.
 * Window counter deltas are attributed to observation time, not the unknown
 * time of each underlying reconnect or loss between counter measurements.
 * attempt - 1 is retryAttempts, NOT confirmed successful reconnects.
 * widgetRttMs must exclude intentional long-poll waits, cache hits and media
 * transfer time. renderFPS is active, visible local rendering, NOT encoder FPS.
 *
 * Event ID dedupe is bounded by windowMs AND maxEventIds. For stronger delivery
 * guarantees, call observeEvent only after upstream idempotency acceptance.
 * Events without usable IDs are counted and explicitly disclosed. Test/preview
 * payloads are excluded; never feed synthetic callbacks without those flags.
 * Window counts become lower bounds and rates null if buffers overflow. The
 * denominator is monitored session wall time in the window, including outages.
 * All warning thresholds are local operator heuristics, not TikTok rules.
 */
function createStreamHealth(options = {}) {
    const config = {
        windowMs: option(options, 'windowMs', 1000, 3600000, true),
        maxSamples: option(options, 'maxSamples', 1, 4096, true),
        maxEventIds: option(options, 'maxEventIds', 1, 8192, true),
        heartbeatIntervalMs: options.heartbeatIntervalMs ?? null,
        widgetRttWarningMs: option(options, 'widgetRttWarningMs', 1, 3600000),
        renderFPSWarning: option(options, 'renderFPSWarning', 1, 1000),
        denseEventsPerMinute: option(options, 'denseEventsPerMinute', 1, 1000000),
        minDensityDurationMs: option(options, 'minDensityDurationMs', 1000, 3600000, true)
    };
    if (config.heartbeatIntervalMs !== null && !numeric(config.heartbeatIntervalMs, 100, 300000)) {
        throw new RangeError('Invalid heartbeatIntervalMs');
    }
    config.minDensityDurationMs = Math.min(config.minDensityDurationMs, config.windowMs);
    const clock = options.clock ?? Date;
    const readClock = typeof clock === 'function' && clock !== Date ? clock : () => clock.now();
    let time = 0, session;
    function now() {
        const value = readClock();
        if (!numeric(value)) throw new RangeError('Clock must return nonnegative epoch milliseconds');
        time = Math.max(time, value);
        return time;
    }
    const add = (a, b) => Math.min(Number.MAX_SAFE_INTEGER, a + b);
    const validTime = (value, at) => numeric(value, session.startedAt, at);
    function counter() {
        return { value: null, at: null, sessionDelta: 0, resets: 0, history: buffer(config.maxSamples) };
    }
    function reset() {
        session = {
            startedAt: now(), status: 'unknown', reason: null, statusAt: null, connectedSinceAt: null,
            retryAttempts: null, lastEventAt: null, heartbeatAt: null,
            events: buffer(config.maxSamples), ids: new Map(), dedupeEvictedThrough: null,
            acceptedEvents: 0, eventsWithoutId: 0,
            rtt: buffer(config.maxSamples), fps: buffer(config.maxSamples), rttAt: null, fpsAt: null,
            reconnects: counter(), droppedEvents: counter()
        };
        return snapshot();
    }
    function pruneIds(at) {
        for (const [id, receivedAt] of session.ids) {
            if (receivedAt > at - config.windowMs) break;
            session.ids.delete(id);
        }
    }
    function updateCounter(target, value, at) {
        if (!Number.isSafeInteger(value) || value < 0 || (target.at !== null && at < target.at)) return;
        if (target.value !== null) {
            if (value < target.value) target.resets = add(target.resets, 1);
            else if (value > target.value) {
                const delta = value - target.value;
                target.sessionDelta = add(target.sessionDelta, delta);
                target.history.push({ at, value: delta }, at - config.windowMs);
            }
        }
        target.value = value;
        target.at = at;
    }
    function update(input = {}) {
        const observedAt = now();
        if (!input || typeof input !== 'object' || Array.isArray(input)) return snapshot();
        const at = input.at === undefined ? observedAt : input.at;
        if (!validTime(at, observedAt)) return snapshot();
        if (STATES.has(input.status) && (session.statusAt === null || at >= session.statusAt)) {
            if (input.status !== session.status) {
                session.connectedSinceAt = input.status === 'connected' ? at : null;
                session.heartbeatAt = null;
            }
            session.status = input.status;
            session.statusAt = at;
            session.reason = REASONS.has(input.reason) ? input.reason : null;
            if (Number.isSafeInteger(input.attempt) && input.attempt >= 1) session.retryAttempts = input.attempt - 1;
        }
        if (validTime(input.lastEventAt, at)) session.lastEventAt = Math.max(session.lastEventAt ?? 0, input.lastEventAt);
        if (session.status === 'connected' && validTime(input.heartbeatAt, at)
            && input.heartbeatAt >= session.connectedSinceAt) {
            session.heartbeatAt = Math.max(session.heartbeatAt ?? 0, input.heartbeatAt);
        }
        for (const [field, history, stamp, max] of [
            ['widgetRttMs', 'rtt', 'rttAt', 3600000], ['renderFPS', 'fps', 'fpsAt', 1000]
        ]) {
            if (numeric(input[field], 0, max) && (session[stamp] === null || at > session[stamp])) {
                session[history].push({ at, value: input[field] }, observedAt - config.windowMs);
                session[stamp] = at;
            }
        }
        updateCounter(session.reconnects, input.reconnects, at);
        updateCounter(session.droppedEvents, input.droppedEvents, at);
        return snapshot();
    }
    function observeEvent(type, payload = {}) {
        const at = now();
        if (session.status !== 'connected' || !EVENT_TYPES.includes(type) || !payload
            || typeof payload !== 'object' || Array.isArray(payload) || payload.test === true || payload.preview === true) return false;
        pruneIds(at);
        const id = eventId(payload);
        if (id !== null) {
            if (session.ids.has(id)) return false;
            if (session.ids.size === config.maxEventIds) {
                const oldest = session.ids.keys().next().value;
                session.dedupeEvictedThrough = session.ids.get(oldest);
                session.ids.delete(oldest);
            }
            session.ids.set(id, at);
        } else session.eventsWithoutId = add(session.eventsWithoutId, 1);
        session.events.push({ at, type, withoutId: id === null }, at - config.windowMs);
        session.acceptedEvents = add(session.acceptedEvents, 1);
        session.lastEventAt = at;
        return true;
    }
    function snapshot() {
        const at = now(), cutoff = at - config.windowMs;
        pruneIds(at);
        const eventWindow = session.events.read(cutoff);
        const elapsedMs = Math.min(config.windowMs, at - session.startedAt);
        const byType = Object.fromEntries(EVENT_TYPES.map(type => [type, 0]));
        let interactions = 0, withoutId = 0;
        for (const event of eventWindow.samples) {
            byType[event.type]++;
            if (INTERACTIONS.has(event.type)) interactions++;
            if (event.withoutId) withoutId++;
        }
        const rateReady = eventWindow.complete && elapsedMs >= config.minDensityDurationMs;
        const rate = count => rateReady ? count * 60000 / elapsedMs : null;
        function measurement(history) {
            const window = history.read(cutoff);
            const samples = window.samples;
            if (!samples.length) return { available: false, sampleCount: 0, windowComplete: window.complete,
                latest: null, mean: null, p95: null, ageMs: null };
            const sorted = samples.map(sample => sample.value).sort((a, b) => a - b);
            const latest = samples[samples.length - 1];
            return { available: true, sampleCount: samples.length, windowComplete: window.complete,
                latest: latest.value, mean: samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length,
                p95: sorted[Math.ceil(sorted.length * 0.95) - 1], ageMs: at - latest.at };
        }
        function counterSnapshot(target) {
            const window = target.history.read(cutoff);
            return { available: target.value !== null, lastValue: target.value,
                ageMs: target.at === null ? null : at - target.at, sessionDelta: target.sessionDelta,
                windowDelta: window.samples.reduce((sum, sample) => add(sum, sample.value), 0),
                windowComplete: window.complete, countIsLowerBound: !window.complete,
                windowAttribution: 'counter-increase-observation-time', resets: target.resets };
        }
        const heartbeatAge = session.heartbeatAt === null ? null : at - session.heartbeatAt;
        let heartbeatState = session.heartbeatAt === null ? 'not-supplied' : 'observed';
        if (config.heartbeatIntervalMs !== null && session.status === 'connected') {
            heartbeatState = (heartbeatAge ?? at - session.connectedSinceAt) > config.heartbeatIntervalMs * 3
                ? 'overdue' : heartbeatAge === null ? 'awaiting' : 'fresh';
        }
        const widgetRttMs = measurement(session.rtt), renderFPS = measurement(session.fps);
        const reconnects = counterSnapshot(session.reconnects), droppedEvents = counterSnapshot(session.droppedEvents);
        const diagnostics = [];
        const report = (code, severity, message, action) => diagnostics.push({ code, severity, message, action });
        if (session.status === 'error' || session.status === 'retrying') {
            const actions = {
                auth: 'Check connector authorization in its settings; never expose credentials in diagnostics.',
                'rate-limit': 'Allow the existing retry backoff to run; avoid repeated manual reconnects.',
                timeout: 'Check the selected transport and network using the existing connection status.',
                network: 'Check local network availability and the existing transport error.'
            };
            report('connection-error', 'warning', 'The transport reports a connection error or retry.',
                actions[session.reason] || 'Review the existing connection error and scheduled retry.');
        } else if (session.status === 'waiting') {
            report('live-waiting', 'info', 'The source reports waiting for a LIVE.', 'Confirm the broadcaster is LIVE and allow the existing retry schedule to run.');
        } else if (session.status === 'disconnected') {
            report('connection-disconnected', 'info', 'The transport reports disconnected.', 'Connect the intended broadcaster when ready.');
        }
        if (heartbeatState === 'overdue') report('heartbeat-overdue', 'warning',
            'The expected heartbeat is overdue; transport loss is not confirmed.',
            'Verify this transport using its existing status and heartbeat instrumentation.');
        if (reconnects.windowDelta > 0) report('observed-reconnects', 'warning',
            'The supplied reconnect counter increased in this window.', 'Inspect transport stability and existing retry logs.');
        if (droppedEvents.windowDelta > 0) report('observed-dropped-events', 'warning',
            'The supplied dropped-event counter increased in this window.', 'Inspect queue pressure; reduce optional concurrent effects and keep event delivery bounded.');
        if (widgetRttMs.available && widgetRttMs.p95 > config.widgetRttWarningMs) report('widget-rtt-high', 'warning',
            'Measured short widget round trips exceeded the local warning threshold.',
            'Inspect widget workload and transport; exclude deliberate long-poll wait from RTT.');
        if (renderFPS.available && renderFPS.mean < config.renderFPSWarning) report('render-fps-low', 'warning',
            'Measured local render FPS is below the local warning threshold.',
            'Check a visible active widget; reduce optional effects or concurrent media and measure again.');
        if (!eventWindow.complete || !widgetRttMs.windowComplete || !renderFPS.windowComplete
            || !reconnects.windowComplete || !droppedEvents.windowComplete) {
            report('sample-buffer-limited', 'info', 'A local sample buffer reached its limit.',
                'Read coverage flags; event rates are withheld when event counts are incomplete.');
        }
        if (rateReady && rate(interactions) >= config.denseEventsPerMinute) report('observed-events-dense', 'info',
            'Observed interaction envelopes are dense in this window.', 'Check overlay readability and avoid covering the main content with concurrent effects.');
        if (session.status === 'connected' && eventWindow.complete && interactions === 0
            && at - session.connectedSinceAt >= Math.min(config.windowMs, 60000)
            && elapsedMs >= Math.min(config.windowMs, 60000)) report('observed-interactions-quiet', 'info',
            'No interaction events were observed in this window; this does not measure viewers or reach.',
            'Consider a relevant question and respond to real comments; event silence does not establish connection loss.');
        return {
            schemaVersion: 1,
            at,
            session: { startedAt: session.startedAt, elapsedMs: at - session.startedAt,
                observedEvents: session.acceptedEvents, eventsWithoutId: session.eventsWithoutId },
            window: { startAt: Math.max(session.startedAt, cutoff), endAt: at, elapsedMs,
                configuredMs: config.windowMs, startInclusive: session.startedAt > cutoff, endInclusive: true },
            connection: { status: session.status, reason: session.reason, reportedAt: session.statusAt,
                retryAttempts: session.retryAttempts, lastEventAt: session.lastEventAt,
                lastEventAgeMs: session.lastEventAt === null ? null : at - session.lastEventAt,
                heartbeat: { state: heartbeatState, lastAt: session.heartbeatAt, ageMs: heartbeatAge,
                    expectedIntervalMs: config.heartbeatIntervalMs } },
            counters: { reconnects, droppedEvents },
            widget: { rttMs: widgetRttMs, renderFPS },
            eventDensity: { observedEvents: eventWindow.samples.length, observedInteractionEvents: interactions,
                observedEventsPerMinute: rate(eventWindow.samples.length), observedInteractionEventsPerMinute: rate(interactions),
                byType, eventsWithoutId: withoutId, windowComplete: eventWindow.complete,
                countIsLowerBound: !eventWindow.complete, rateReady,
                denominator: 'monitored-window-wall-time-including-outages',
                dedupe: { scope: 'event-id-within-window-and-capacity', retainedIds: session.ids.size,
                    capacityLimited: session.dedupeEvictedThrough !== null && session.dedupeEvictedThrough > cutoff } },
            limits: { ...config },
            diagnostics
        };
    }
    reset();
    return { update, observeEvent, snapshot, reset };
}

module.exports = { createStreamHealth, DEFAULT_OPTIONS };
