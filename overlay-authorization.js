import crypto from 'node:crypto';
import { agencyMembers } from './agency-licenses.js';

// Read-only authorization: creating a broadcast link cannot activate a new device.
export function createOverlayAuthorization({ licenses, blacklist, now = Date.now }) {
    return ({ licenseCode, deviceId } = {}) => {
        if (typeof licenseCode !== 'string' || !licenseCode.trim() || licenseCode.length > 160 ||
            typeof deviceId !== 'string' || !deviceId.trim() || deviceId.length > 256) return false;
        const code = licenseCode.trim().toUpperCase(), device = deviceId.trim();
        if (blacklist().includes(code)) return false;
        const license = licenses().find(item => item.kod === code);
        if (!license || license.durum !== 'aktif' || (license.bitis_zamani != null &&
            (!Number.isFinite(Number(license.bitis_zamani)) || Number(license.bitis_zamani) <= now()))) return false;
        if (license.tip === 'ajans') {
            if (license.engelli_cihazlar?.includes(device) || !agencyMembers(license).some(member => member.cihaz_kimlik === device)) return false;
        } else if (license.cihaz_kimlik !== device) return false;
        return { ownerId: crypto.createHash('sha256').update('TikMnG-overlay-owner:' + code).digest('hex') };
    };
}
