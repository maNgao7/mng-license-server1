[CmdletBinding()]
param(
    [string]$LabRoot = 'D:\TikMnG-Ses-Laboratuvari',
    [string]$BasePython = 'C:\Users\User\AppData\Local\Programs\Python\Python312',
    [string]$Destination = 'D:\TikMnG-Chatterbox-v3-ready'
)
$ErrorActionPreference = 'Stop'
$workerSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\lib\vendor\chatterbox-worker.py'))
$lab = (Resolve-Path -LiteralPath $LabRoot).Path
$base = (Resolve-Path -LiteralPath $BasePython).Path
$target = [IO.Path]::GetFullPath($Destination)
$parent = Split-Path -Parent $target
if (-not (Test-Path -LiteralPath $parent -PathType Container) -or (Test-Path -LiteralPath $target)) {
    throw 'Destination must be a new directory with an existing parent. No existing pack is overwritten.'
}
if ([IO.Path]::GetPathRoot($target) -ne 'D:\' -or $target -eq 'D:\') { throw 'Build artifacts must be in a named directory on D:.' }
$staging = Join-Path $parent ((Split-Path -Leaf $target) + '.staging-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null

function Copy-Tree([string]$Source, [string]$Target, [string[]]$ExcludedDirectories = @()) {
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) { throw 'Required source directory is missing.' }
    $arguments = @($Source, $Target, '/E', '/XJ', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/MT:8',
        '/XD', '__pycache__', 'tests', 'test', '.git', '.cache') + $ExcludedDirectories + @('/XF', '*.pyc', '*.pyo', 'direct_url.json', 'pyvenv.cfg')
    & robocopy @arguments | Out-Null
    if ($LASTEXITCODE -ge 8) { throw 'Runtime copy failed; staging directory retained.' }
}

function Invoke-IsolatedPython([string]$Executable, [string[]]$Arguments, [int]$TimeoutSeconds = 120) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Executable
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.WorkingDirectory = $staging
    # Do not inherit a venv, user import directories, access tokens or proxy settings.
    $start.Environment.Clear()
    $start.Environment['SystemRoot'] = $env:SystemRoot
    $start.Environment['WINDIR'] = $env:SystemRoot
    $start.Environment['PATH'] = (Split-Path -Parent $Executable) + ';' + (Join-Path $env:SystemRoot 'System32')
    $start.Environment['TEMP'] = Join-Path $staging 'cache'
    $start.Environment['TMP'] = Join-Path $staging 'cache'
    $start.Environment['HF_HUB_OFFLINE'] = '1'
    $start.Environment['TRANSFORMERS_OFFLINE'] = '1'
    $start.Environment['HF_HUB_DISABLE_TELEMETRY'] = '1'
    $start.Environment['DO_NOT_TRACK'] = '1'
    $start.Environment['NUMBA_CACHE_DIR'] = Join-Path $staging 'cache\numba'
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) { $process.Kill($true); throw 'Pack verification timed out.' }
    $result = $stdout.GetAwaiter().GetResult()
    $errors = $stderr.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) { throw ('Pack verification failed: ' + $errors) }
    $process.Dispose()
    return $result.Trim()
}

try {
    Write-Output 'Checking laboratory dependencies...'
    & (Join-Path $lab 'venv\Scripts\python.exe') -I -m pip check
    if ($LASTEXITCODE -ne 0) { throw 'Laboratory requirements are inconsistent.' }
    $runtime = Join-Path $staging 'runtime'
    New-Item -ItemType Directory -Path $runtime,(Join-Path $staging 'cache') | Out-Null
    foreach ($name in @('python.exe', 'python3.dll', 'python312.dll', 'vcruntime140.dll', 'vcruntime140_1.dll')) {
        Copy-Item -LiteralPath (Join-Path $base $name) -Destination $runtime
    }
    Copy-Item -LiteralPath (Join-Path $base 'LICENSE.txt') -Destination (Join-Path $runtime 'LICENSE-PSF.txt')
    Write-Output 'Copying isolated Python standard library and validated dependencies...'
    Copy-Tree (Join-Path $base 'DLLs') (Join-Path $runtime 'DLLs')
    Copy-Tree (Join-Path $base 'Lib') (Join-Path $runtime 'Lib') @('site-packages', 'idlelib', 'turtledemo')
    Copy-Tree (Join-Path $lab 'venv\Lib\site-packages') (Join-Path $runtime 'Lib\site-packages')
    Write-Output 'Copying only pinned weights and ten licensed reference clips...'
    $modelSource = Join-Path $lab 'model-v3'
    $model = Get-Content -LiteralPath (Join-Path $modelSource 'tikmng-model-manifest.json') -Raw | ConvertFrom-Json
    New-Item -ItemType Directory -Path (Join-Path $staging 'model-v3'),(Join-Path $staging 'references') | Out-Null
    Copy-Item -LiteralPath (Join-Path $modelSource 'tikmng-model-manifest.json') -Destination (Join-Path $staging 'model-v3')
    foreach ($entry in $model.files) {
        if ($entry.name -notmatch '^[A-Za-z0-9_.-]+$') { throw 'Invalid model filename.' }
        Copy-Item -LiteralPath (Join-Path $modelSource $entry.name) -Destination (Join-Path $staging 'model-v3')
    }
    $references = Get-Content -LiteralPath (Join-Path $lab 'references\manifest.json') -Raw | ConvertFrom-Json
    Copy-Item -LiteralPath (Join-Path $lab 'references\manifest.json') -Destination (Join-Path $staging 'references')
    foreach ($voice in $references.voices) {
        if ($voice.file -notmatch '^d[12]-\d{5}\.flac$') { throw 'Invalid reference filename.' }
        Copy-Item -LiteralPath (Join-Path $lab ('references\' + $voice.file)) -Destination (Join-Path $staging 'references')
    }
    $licenses = Join-Path $staging 'licenses'
    New-Item -ItemType Directory -Path $licenses | Out-Null
    Copy-Item -LiteralPath (Join-Path $base 'LICENSE.txt') -Destination (Join-Path $licenses 'PSF.txt')
    Copy-Item -LiteralPath (Join-Path $lab 'chatterbox-src\LICENSE') -Destination (Join-Path $licenses 'Chatterbox-MIT.txt')
    Copy-Item -LiteralPath (Join-Path $lab 'references\manifest.json') -Destination (Join-Path $licenses 'Alania-CC-BY-4.0-attribution.json')

    # The smoke test runs after physically relocating the interpreter directory.
    $relocated = Join-Path $staging 'runtime-relocation-check'
    if ([IO.Path]::GetFullPath($relocated).StartsWith($staging + '\', [StringComparison]::OrdinalIgnoreCase) -ne $true) { throw 'Unsafe relocation target.' }
    Move-Item -LiteralPath $runtime -Destination $relocated
    $relocatedPython = Join-Path $relocated 'python.exe'
    $smoke = @'
import json, pathlib, socket, sys
def blocked(*args, **kwargs): raise RuntimeError('Network disabled for pack verification')
socket.socket.connect = blocked
socket.socket.connect_ex = blocked
socket.create_connection = blocked
socket.getaddrinfo = blocked
import torch, torchaudio, chatterbox, soundfile, perth
prefix = pathlib.Path(sys.executable).resolve().parent
assert pathlib.Path(sys.prefix).resolve() == prefix
for module in (torch, torchaudio, chatterbox, soundfile, perth):
    assert pathlib.Path(module.__file__).resolve().is_relative_to(prefix)
assert all(not p or pathlib.Path(p).resolve().is_relative_to(prefix) for p in sys.path)
assert perth.PerthImplicitWatermarker is not None
print(json.dumps({'relocatedImports': True, 'python': sys.version.split()[0], 'torch': torch.__version__, 'watermark': True, 'networkBlocked': True}))
'@
    Write-Output 'Testing relocated Python without global Python import paths...'
    $smokeResult = Invoke-IsolatedPython $relocatedPython @('-I','-B','-c',$smoke)
    Write-Output $smokeResult
    Write-Output (Invoke-IsolatedPython $relocatedPython @('-I','-B','-m','pip','check'))
    Move-Item -LiteralPath $relocated -Destination $runtime
    $python = Join-Path $runtime 'python.exe'
    $verify = @'
import runpy, sys
worker = runpy.run_path(sys.argv[1], run_name='pack_verification')
worker['verify_pack'](worker['Path'](sys.argv[2]))
print('Pinned weights and ten references verified')
'@
    Write-Output (Invoke-IsolatedPython $python @('-I','-B','-c',$verify,$workerSource,$staging))

    $inventory = @'
import hashlib, importlib.metadata as metadata, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
runtime = root / 'runtime'
notices = ['TikMnG local Chatterbox runtime dependency notices', 'PSF license: licenses/PSF.txt', 'Chatterbox: MIT; licenses/Chatterbox-MIT.txt', 'Reference voices: CC BY 4.0; licenses/Alania-CC-BY-4.0-attribution.json', '', 'Individual license texts are retained in runtime/Lib/site-packages and its .dist-info directories.', '']
packages = []
for dist in sorted(metadata.distributions(), key=lambda d: d.metadata.get('Name', '').lower()):
    name, version = dist.metadata['Name'], dist.version
    license = dist.metadata.get('License-Expression') or dist.metadata.get('License') or 'See distribution metadata and license files'
    packages.append({'name': name, 'version': version})
    notices.append(name + ' ' + version + '\n' + license + '\n')
(root / 'licenses' / 'THIRD-PARTY-NOTICES.txt').write_text('\n'.join(notices), encoding='utf-8')
(root / 'licenses' / 'packages.json').write_text(json.dumps(packages, indent=2) + '\n', encoding='utf-8')
files = []
for file in sorted(runtime.rglob('*')):
    if file.is_symlink(): raise RuntimeError('Runtime links are not permitted')
    if not file.is_file(): continue
    relative = file.relative_to(root).as_posix()
    if file.name.endswith('.pth'):
        for line in file.read_text(encoding='utf-8').splitlines():
            if line.strip() and not line.startswith('#') and (':/' in line.replace('\\', '/') or line.startswith(('/', '\\'))):
                raise RuntimeError('Absolute Python search path is not permitted')
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(4*1024*1024), b''): digest.update(chunk)
    files.append({'path': relative, 'bytes': file.stat().st_size, 'sha256': digest.hexdigest()})
manifest = {'schemaVersion': 1, 'runtime': 'CPython-3.12.10-win-amd64', 'offlineImportsVerified': True, 'files': files}
encoded = (json.dumps(manifest, ensure_ascii=True, separators=(',', ':')) + '\n').encode('utf-8')
(root / 'runtime-manifest.json').write_bytes(encoded)
print(json.dumps({'runtimeManifestSha256': hashlib.sha256(encoded).hexdigest(), 'runtimeFiles': len(files), 'runtimeBytes': sum(e['bytes'] for e in files)}, separators=(',', ':')))
'@
    Write-Output 'Writing third-party notices and immutable runtime inventory...'
    $inventoryResult = Invoke-IsolatedPython $python @('-I','-B','-c',$inventory,$staging)
    $summary = $inventoryResult | ConvertFrom-Json
    $report = [ordered]@{
        schemaVersion = 1
        relocatedImports = ($smokeResult | ConvertFrom-Json)
        runtimeManifestSha256 = $summary.runtimeManifestSha256
        runtimeFiles = $summary.runtimeFiles
        runtimeBytes = $summary.runtimeBytes
        modelRevision = $model.revision
        voices = $references.voices.Count
        status = 'prepared-local-only-needs-adapter-trust-pin'
    }
    [IO.File]::WriteAllText((Join-Path $staging 'preparation-report.json'), ($report | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
    # Move only this newly-created staging tree; never replace existing releases.
    if ([IO.Path]::GetFullPath($staging).StartsWith($parent.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -ne $true -or (Test-Path -LiteralPath $target)) { throw 'Unsafe final move.' }
    Move-Item -LiteralPath $staging -Destination $target
    Write-Output ('PACK_ROOT=' + $target)
    Write-Output ('TRUSTED_RUNTIME_MANIFEST_SHA256=' + $summary.runtimeManifestSha256)
} catch {
    Write-Output ('Preparation failed; staged artifacts retained at ' + $staging)
    throw
}
