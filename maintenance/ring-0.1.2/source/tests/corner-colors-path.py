"""Compile and run the real corner-layer guard without Vulkan or the game.

Uses the same pinned shader and Win64 compiler inputs as corner-colors/build.py.
"""
import argparse
import hashlib
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

ORIGINAL_SHA = '4b17cdbf36c8c3f029fffcb16565e5660027535071ad038df8b396d56de418b6'
FIXTURE = r'''
#include "corner_colors.c"
static int checks;
static void check(int ok, const char *name) {
    if (!ok) { fprintf(stderr, "FAIL: %s\n", name); exit(1); }
    ++checks;
}
static void expect(const WCHAR *path, int allowed, const char *name) {
    check(SetEnvironmentVariableW(L"TIKMNG_RING_NATIVE_GAME", path), "set environment");
    check(gameProcessMatches() == allowed, name);
}
int wmain(int argc, WCHAR **argv) {
    WCHAR exe[32768], value[32768];
    check(argc == 2, "wrong-process fixture argument");
    DWORD n = GetModuleFileNameW(NULL, exe, 32768);
    check(n && n < 32768, "current process path");
    expect(exe, 1, "exact process path");
    wcscpy(value, exe);
    for (WCHAR *p = value; *p; ++p)
        if (*p >= L'a' && *p <= L'z') *p -= L'a' - L'A';
    expect(value, 1, "case-insensitive path");
    wcscpy(value, exe);
    for (WCHAR *p = value; *p; ++p) if (*p == L'\\') *p = L'/';
    expect(value, 1, "normalized separators");
    swprintf(value, 32768, L"\\\\?\\%ls", exe);
    expect(value, 1, "extended canonical path");
    wcscpy(value, exe);
    WCHAR *name = wcsrchr(value, L'\\');
    *name = 0;
    WCHAR alias[32768];
    swprintf(alias, 32768, L"%ls\\alias", value);
    check(CreateDirectoryW(alias, NULL), "create normalization directory");
    swprintf(alias, 32768, L"%ls\\alias\\..\\%ls", value, name + 1);
    expect(alias, 1, "canonical dot segments");
    expect(argv[1], 0, "same-name different executable path");
    expect(value, 0, "directory is not executable path");
    swprintf(value, 32768, L"%ls.missing", exe);
    expect(value, 0, "nonexistent executable path");
    expect(L"box guard probe.exe", 0, "relative path rejected");
    expect(L"", 0, "empty override does not admit probe");
    expect(NULL, 0, "legacy default does not admit another process");
    expect(exe, 1, "restore exact process path");
    VkShaderModuleCreateInfo shader = {0};
    shader.codeSize = sizeof(testOriginalWords);
    shader.pCode = testOriginalWords;
    check(kitMatches(&shader), "original shader accepted in selected process");
    --shader.codeSize;
    check(!kitMatches(&shader), "shader size guard retained");
    ++shader.codeSize;
    testOriginalWords[0] ^= 1;
    check(!kitMatches(&shader), "shader hash guard retained");
    testOriginalWords[0] ^= 1;
    expect(argv[1], 0, "restore wrong executable path");
    check(!kitMatches(&shader), "original shader rejected in wrong process");
    printf("PASS: %d native path, process and shader guard assertions\n", checks);
    return 0;
}
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original', type=Path, required=True)
    parser.add_argument('--zig', type=Path, required=True)
    parser.add_argument('--headers', type=Path, required=True)
    args = parser.parse_args()
    original = args.original.read_bytes()
    if hashlib.sha256(original).hexdigest() != ORIGINAL_SHA:
        raise ValueError('Not the pinned original shader')
    words = ','.join(hex(w[0]) + 'u' for w in struct.iter_unpack('<I', original))
    digest = ','.join(map(str, bytes.fromhex(ORIGINAL_SHA)))
    source = Path(__file__).resolve().parents[1] / 'tools/corner-colors'
    with tempfile.TemporaryDirectory(prefix='tikmng-corner-path-Ö ') as temp:
        work = Path(temp)
        (work / 'kit_module.h').write_text(
            f'#define ORIGINAL_BYTES {len(original)}\n'
            f'static const unsigned char originalDigest[32]={{{digest}}};\n'
            'static const uint32_t kitWords[]={0};\n'
            f'static uint32_t testOriginalWords[]={{{words}}};\n')
        fixture = work / 'probe.c'
        fixture.write_text('#include <stdio.h>\n#include <stdlib.h>\n' + FIXTURE)
        executable = work / 'box guard probe.exe'
        subprocess.run([args.zig, 'cc', '-target', 'x86_64-windows-gnu', '-O2',
                        '-municode', '-I' + str(args.headers.resolve()),
                        '-I' + str(work), '-I' + str(source), fixture,
                        '-lbcrypt', '-o', executable], check=True)
        wrong = work / 'wrong' / executable.name
        wrong.parent.mkdir()
        shutil.copyfile(executable, wrong)
        subprocess.run([executable, wrong], cwd=work, check=True)


if __name__ == '__main__':
    main()
