"""Create a source checkpoint archive from an explicit, secret-free allowlist."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / "output" / "현장AI365_통합_v0.2.0.zip"
DIRECTORIES = ("public", "android", "firebase", "tests", "tools", "evidence")
ROOT_FILES = (
    ".gitignore", ".env.example", "package.json", "server.mjs",
    "README.md", "ARCHITECTURE.md", "PROJECT_STATUS.md", "TEST_REPORT.md",
    "NEXT_STEPS.md", "START_WINDOWS.cmd", "BUILD_ANDROID.cmd",
    "CODEX_RETURN.md", "CODEX_PROGRESS.md", "LOCAL_CONNECTIONS.md",
)
EXCLUDED_PARTS = {".git", ".gradle", "node_modules", "__pycache__", "build"}
SECRET = re.compile(rb"sk-(?:proj-)?[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")


def source_files():
    candidates = [ROOT / name for name in ROOT_FILES]
    for name in DIRECTORIES:
        candidates.extend((ROOT / name).rglob("*"))
    for path in sorted(set(candidates)):
        relative = path.relative_to(ROOT)
        if path.name == '_firebase-runtime.json' or relative.as_posix() == 'evidence/source-manifest.json':
            continue
        if EXCLUDED_PARTS.intersection(relative.parts):
            continue
        if path.is_symlink():
            raise RuntimeError("Archive contains a symlink: " + str(relative))
        if not path.is_file():
            continue
        if path.name.startswith(".env") and relative != Path(".env.example"):
            continue
        if path.name == "local.properties" or path.suffix.lower() in {".jks", ".keystore", ".pem", ".key", ".pyc"}:
            continue
        data = path.read_bytes()
        if SECRET.search(data):
            raise RuntimeError("Potential secret detected; archive stopped at " + str(relative))
        yield relative.as_posix(), data


def main():
    files = list(source_files())
    names = {name for name, _ in files}
    if not set(ROOT_FILES).issubset(names):
        raise RuntimeError("A required source file is missing")
    for name, data in files:
        if name.startswith("public/"):
            copied = ROOT / "android/app/src/main/assets/web" / name.removeprefix("public/")
            if not copied.is_file() or copied.read_bytes() != data:
                raise RuntimeError("Android web assets differ; run npm run build first")
    manifest = {
        "app": "현장AI365", "version": "0.2.0", "date": "2026-10-14",
        "kind": "source checkpoint; NOT an APK/AAB or release",
        "files": [{"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in files],
    }
    git = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    if git.returncode == 0:
        manifest["local_commit"] = git.stdout.strip()
    OUTPUT.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in files:
            archive.writestr("hyeonjang-ai365/" + name, data)
        archive.writestr("hyeonjang-ai365/evidence/source-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    with zipfile.ZipFile(OUTPUT) as archive:
        if archive.testzip():
            raise RuntimeError("Archive integrity verification failed")
        if any(name.endswith("/.env.local") for name in archive.namelist()):
            raise RuntimeError("Environment file unexpectedly archived")
    print(json.dumps({"path": str(OUTPUT), "files": len(files) + 1, "bytes": OUTPUT.stat().st_size, "sha256": hashlib.sha256(OUTPUT.read_bytes()).hexdigest(), "secret_exclusion": "PASS", "android_assets_match": "PASS", "archive_integrity": "PASS"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
