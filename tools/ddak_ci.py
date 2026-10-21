#!/usr/bin/env python3
"""DDak public-repository audit and opt-in source checks. Standard library only."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
notes = []
failures = []
checks = 0

def note(label, message):
    notes.append((label, message))
    print(f"[{label}] {message}", flush=True)

def run(command, directory, timeout=600):
    env = dict(os.environ, CI="true")
    try:
        result = subprocess.run(command, cwd=directory, env=env, timeout=timeout, check=False)
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired) as error:
        note("ERROR", f"Command could not finish in {directory}: {type(error).__name__}")
        return False

def tracked_files():
    process = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT,
                             capture_output=True, check=True)
    return [Path(os.fsdecode(p)) for p in process.stdout.split(b"\0") if p]

def security_scan():
    # Do not print matched secret content into public Action logs.
    patterns = [
        re.compile(b"-----BEGIN" + b" (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        re.compile(b"sk-" + b"proj-[A-Za-z0-9_-]{12,}"),
        re.compile(b"gh" + b"p_[A-Za-z0-9]{25,}"),
        re.compile(b"AIza" + b"[A-Za-z0-9_-]{35}"),
    ]
    bad = []
    for name in tracked_files():
        if (name.suffix.lower() in {".jks", ".keystore", ".p12", ".pfx", ".pem", ".key"}
            or (name.name.startswith(".env") and name.name not in {".env.example", ".env.sample"})
            or name.name in {"service-account.json", "google-services-secret.json"}
        ):
            bad.append(str(name))
            continue
        path = ROOT / name
        if not path.is_file() or path.stat().st_size > 2_000_000:
            continue
        data = path.read_bytes()
        if any(p.search(data) for p in patterns):
            bad.append(str(name))
    if bad:
        failures.append("Potential credentials in tracked files")
        note("FAIL", f"Possible secret file(s) at {len(bad)} path(s): " + ", ".join(bad))
    else:
        note("PASS", "No matching credentials detected in tracked files (not a full security audit)")

def candidate_projects():
    dirs = [ROOT]
    for group in ("apps", "projects"):
        parent = ROOT / group
        if parent.is_dir():
            dirs += sorted(p for p in parent.iterdir() if p.is_dir())
    return dirs

def check_projects():
    global checks
    found = 0
    for base in candidate_projects():
        relative = str(base.relative_to(ROOT)) or "."
        if (base / "package.json").exists():
            found += 1
            try:
                pkg = json.loads((base / "package.json").read_text(encoding="utf-8"))
            except (ValueError, OSError):
                failures.append(f"Invalid package.json in {relative}")
                note("FAIL", f"Invalid package.json: {relative}")
                continue
            if not (base / "package-lock.json").is_file():
                note("SKIP", f"{relative}: npm checks need package-lock.json")
            else:
                commands = [["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"]]
                commands += [["npm", "run", task] for task in ("lint", "test", "build")
                             if task in pkg.get("scripts", {})]
                for cmd in commands:
                    checks += 1
                    note("RUN", f"{relative}: {' '.join(cmd)}")
                    if not run(cmd, base, timeout=600):
                        failures.append(f"{relative}: {cmd[1]}")
                        note("FAIL", f"{relative}: command failed")
                        break
                else:
                    note("PASS", f"{relative}: npm checks completed")
        if (base / "gradlew").is_file():
            found += 1
            jar = base / "gradle" / "wrapper" / "gradle-wrapper.jar"
            if not jar.is_file():
                note("SKIP", f"{relative}: Gradle wrapper jar missing; Android build not run")
            else:
                checks += 1
                note("RUN", f"{relative}: Android unit tests and debug build")
                if run(["bash", "./gradlew", "--no-daemon", "test", "assembleDebug"], base, timeout=900):
                    note("PASS", f"{relative}: Android tests and build completed")
                else:
                    failures.append(f"{relative}: Android build or tests failed")
                    note("FAIL", f"{relative}: Android checks failed")
    if not found:
        note("WAIT", "No app source detected. No app build or tests were performed.")
    elif checks == 0:
        note("WAIT", "Source detected, but no executable build or tests configured.")
    return found

def write_summary(source_count):
    status = "FAIL" if failures else ("CHECKED" if checks else "NOT TESTED")
    lines = ["# DDak automatic inspection", "", f"**Status:** {status}",
             f"**Detected project types:** {source_count}", f"**Executed checks:** {checks}",
             "", "Note: CHECKED does not mean the app is Play Store-ready.", "",
             "## Findings", ""]
    lines += [f"- **{label}**: {message}" for label, message in notes]
    lines += ["", "Never upload credentials, signing keys, user data, or customer records to this public repository."]
    summary = "\n".join(lines) + "\n"
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(summary)
    else:
        print(summary)

if __name__ == "__main__":
    security_scan()
    sources = check_projects()
    write_summary(sources)
    sys.exit(1 if failures else 0)
