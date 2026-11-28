#ifndef TIKMNG_HUD_READER_H
#define TIKMNG_HUD_READER_H
#include <windows.h>
#include <stdint.h>
#include <string.h>
#define HUD_HEADER 64u
#define HUD_WIDTH 3840u
#define HUD_HEIGHT 2160u
#define HUD_MAX_BYTES (HUD_HEADER + (uint64_t)HUD_WIDTH * HUD_HEIGHT * 4u)
typedef struct HudReader {
    HANDLE file, mapping;
    const unsigned char *view;
    uint64_t mappedBytes, revision;
    unsigned char *pixels;
    size_t capacity;
    uint32_t width, height, sequence;
    int valid;
} HudReader;
static uint32_t hud_u32(const unsigned char *p) {
    return (uint32_t)p[0] | ((uint32_t)p[1]<<8) | ((uint32_t)p[2]<<16) | ((uint32_t)p[3]<<24);
}
// The last row need not include stride padding. All arithmetic is widened.
static int hud_bounds(const unsigned char h[HUD_HEADER], uint64_t bytes,
                      uint32_t *w, uint32_t *height, uint32_t *stride) {
    if (bytes < HUD_HEADER || bytes > HUD_MAX_BYTES ||
        hud_u32(h) != 0x48474E4Du || hud_u32(h+4) != 1u) return 0;
    *w = hud_u32(h+12); *height = hud_u32(h+16); *stride = hud_u32(h+20);
    if (!*w || !*height || *w > HUD_WIDTH || *height > HUD_HEIGHT ||
        *stride % 4 || (uint64_t)*stride < (uint64_t)*w*4) return 0;
    uint64_t end = HUD_HEADER + (uint64_t)(*height-1)*(*stride) + (uint64_t)*w*4;
    return end <= bytes && end <= HUD_MAX_BYTES;
}
static void hud_unmap(HudReader *r) {
    if (r->view) UnmapViewOfFile(r->view);
    if (r->mapping) CloseHandle(r->mapping);
    if (r->file && r->file != INVALID_HANDLE_VALUE) CloseHandle(r->file);
    r->file = r->mapping = NULL; r->view = NULL; r->mappedBytes = 0; r->valid = 0;
}
static void hud_close(HudReader *r) {
    hud_unmap(r);
    if (r->pixels) HeapFree(GetProcessHeap(), 0, r->pixels);
    memset(r, 0, sizeof(*r));
}
static uint32_t hud_sequence(const unsigned char *view) {
    uint32_t value = *(const volatile uint32_t *)(view+8);
    MemoryBarrier();
    return value;
}
static int hud_snapshot(HudReader *r) {
    LARGE_INTEGER length;
    if (r->file) {
        FILE_STANDARD_INFO status;
        if (!GetFileInformationByHandleEx(r->file, FileStandardInfo, &status, sizeof(status)) ||
            status.DeletePending || !GetFileSizeEx(r->file, &length) ||
            (uint64_t)length.QuadPart != r->mappedBytes) hud_unmap(r);
    }
    if (!r->file) {
        WCHAR path[32768];
        DWORD n = GetEnvironmentVariableW(L"TIKMNG_HUD_FILE", path, 32768);
        if (!n || n >= 32768) return 0;
        HANDLE f = CreateFileW(path, GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
        if (f == INVALID_HANDLE_VALUE) return 0;
        if (!GetFileSizeEx(f, &length) || length.QuadPart < HUD_HEADER ||
            (uint64_t)length.QuadPart > HUD_MAX_BYTES) { CloseHandle(f); return 0; }
        r->file = f;
        r->mappedBytes = (uint64_t)length.QuadPart;
        r->mapping = CreateFileMappingW(f, NULL, PAGE_READONLY, 0, 0, NULL);
        if (r->mapping) r->view = MapViewOfFile(r->mapping, FILE_MAP_READ, 0, 0, (SIZE_T)r->mappedBytes);
        if (!r->view) { hud_unmap(r); return 0; }
        r->valid = 0;
    }
    // A mapped local file cannot be truncated below its mapped section on
    // Windows. Recheck file length anyway; never map/read the maximum blindly.
    if (!GetFileSizeEx(r->file, &length) || length.QuadPart < HUD_HEADER ||
        (uint64_t)length.QuadPart != r->mappedBytes) { hud_unmap(r); return 0; }
    uint32_t first = hud_sequence(r->view);
    if (first & 1u) return r->valid; // Keep the last complete frame while writing.
    unsigned char header[HUD_HEADER];
    memcpy(header, r->view, sizeof(header));
    uint32_t w, h, stride;
    if (!hud_bounds(header, r->mappedBytes, &w, &h, &stride)) {
        // In particular width/height zero means no HUD, not a stale texture.
        if (hud_sequence(r->view) == first) r->valid = 0;
        return 0;
    }
    if (r->valid && first == r->sequence && w == r->width && h == r->height)
        return hud_sequence(r->view) == first;
    size_t need = (size_t)w*h*4;
    // Copy into scratch, not the last good snapshot: a torn update must not
    // damage the fallback frame that is still displayed during writer activity.
    unsigned char *scratch = HeapAlloc(GetProcessHeap(), 0, need);
    if (!scratch) return 0;
    for (uint32_t y=0; y<h; ++y)
        memcpy(scratch+(size_t)y*w*4, r->view+HUD_HEADER+(size_t)y*stride, (size_t)w*4);
    MemoryBarrier();
    uint32_t last = hud_sequence(r->view);
    if (first != last || last & 1u || hud_u32(header+8) != first) {
        HeapFree(GetProcessHeap(), 0, scratch); return r->valid;
    }
    if (r->pixels) HeapFree(GetProcessHeap(), 0, r->pixels);
    r->pixels = scratch; r->capacity = need;
    r->sequence = first; r->width = w; r->height = h; r->valid = 1; ++r->revision;
    // Header[24..31] is Unix epoch milliseconds (Date.now()); deliberately ignored.
    return 1;
}
#endif
