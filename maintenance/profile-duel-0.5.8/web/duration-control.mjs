const factors = { seconds: 1, minutes: 60 };
const durationError = 'Tur süresi 10 saniye ile 60 dakika arasında olmalıdır.';

// Both APIs and existing snapshots continue to use whole seconds.
export function durationToSeconds(value, unit = 'seconds') {
  const seconds = Number(value) * factors[unit];
  if (String(value).trim() === '' || !Number.isFinite(seconds) || seconds < 10 || seconds > 3600) {
    throw new RangeError(durationError);
  }
  return Math.round(seconds);
}

export function mountDurationControl(input, unit) {
  let currentUnit = unit.value;
  let lastSnapshotSeconds;
  const limits = () => {
    input.min = String(10 / factors[currentUnit]);
    input.max = String(3600 / factors[currentUnit]);
    input.step = currentUnit === 'minutes' ? 'any' : '1';
  };
  limits();
  unit.addEventListener('change', () => {
    const seconds = input.value === '' ? null : Number(input.value) * factors[currentUnit];
    currentUnit = unit.value;
    limits();
    if (seconds !== null) input.value = String(currentUnit === 'seconds' ? Math.round(seconds) : seconds / 60);
  });
  return {
    readSeconds() {
      if (!input.reportValidity()) throw new RangeError(durationError);
      return durationToSeconds(input.value, currentUnit);
    },
    sync(seconds) {
      if (!Number.isFinite(seconds) || seconds === lastSnapshotSeconds) return;
      lastSnapshotSeconds = seconds;
      input.value = String(seconds / factors[currentUnit]);
    },
  };
}
