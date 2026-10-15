"""
verify.py — smoke test: proves Trend Duel actually serves and answers ON THIS MACHINE.

A milestone is not done until this passes. It answers one question: if the
human double-clicks run.bat right now, do they see a working site?

How it works, in plain English:
 1. Trend Duel is a STATIC site — the folder docs/ is the app, served by
    Python's built-in http.server. If something already answers on PORT it is
    reused as-is: a static server reads every file from disk on every request,
    so it can never hold pre-edit code the way a Flask process can. (The
    identity marker still catches a DIFFERENT project squatting on our port.)
 2. Otherwise it starts the server itself with SERVER_COMMAND, waits for it to
    come up, tests it, then shuts it down.
 3. It fetches the page a human would open and every data file the game
    loads, checks the identity marker, and parses each JSON file. A data file
    that fails to parse, or is empty, is a FAIL — stale or broken data passing
    as fresh is the worst failure mode.
 4. PASS  -> prints PASS, exit code 0.
    FAIL  -> prints the reason to stderr, exit code 2.
    (Exit 2 is what makes a Claude Code Stop hook treat this as blocking:
    Claude Code reads the stderr message and keeps working instead of stopping.)

Claude Code: update MUST_CONTAIN as milestones add visible features, and flip
DATA_REQUIRED to True at M1 when the build script produces the data files.
The identity marker MUST_CONTAIN[0] = "Trend Duel" must appear in this app's
pages and no other project's — never leave it empty. Stdlib only, no installs.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

# Print ASCII or force UTF-8 stdout, so a console with a legacy code page can
# never turn a real failure message into a UnicodeEncodeError. Carried INLINE
# because verify.py is standing-kit material.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

# ---------------- CONFIG (edit per project) ----------------
_HERE = os.path.dirname(os.path.abspath(__file__))
_VENV_PY = os.path.join(_HERE, ".venv", "Scripts", "python.exe")
PYTHON = _VENV_PY if os.path.exists(_VENV_PY) else sys.executable

PORT = 5093                                    # MUST equal the port in run.bat
                                               # (5000/5040/5050/5055/5057 and
                                               # 5077-5092, 8000/8501/8503/8504
                                               # belong to other projects on
                                               # this machine — see CLAUDE.md)
SITE_DIR = "docs"                              # the folder that IS the app
SERVER_COMMAND = [PYTHON, "-m", "http.server", str(PORT),
                  "--bind", "127.0.0.1", "--directory", SITE_DIR]
APP_FILE = os.path.join(SITE_DIR, "index.html")  # the page a human opens
URL = f"http://127.0.0.1:{PORT}/"
MUST_CONTAIN = [                               # strings that must appear in the response body
    "Trend Duel",                              # the app identity marker — this app's pages
                                               # and no other project's (never leave empty)
]
DATA_FILES = [                                 # JSON the game loads; each must fetch 200
    "/data/elements.json",                     # and parse as non-empty JSON (M1)
    "/data/stats.json",                        # (M1)
]
DATA_REQUIRED = False                          # M0: the build script hasn't run yet, so a
                                               # missing data file is a NOTE. Flip to True
                                               # at M1 — from then on missing data FAILS.
EXTRA_PAGES = [                                # (path, must-contain) — more pages to smoke-test
]
STARTUP_TIMEOUT_SECONDS = 15                   # http.server binds in well under a second
# ------------------------------------------------------------


def server_output(log, limit=2000):
    """Whatever the server printed, for a failure message."""
    if log is None:
        return ""
    try:
        log.seek(0)
        text = log.read().decode("utf-8", errors="replace").strip()
    except (OSError, ValueError):
        return ""
    if len(text) > limit:
        text = "... (truncated) ..." + text[-limit:]
    return text


def fetch(url, timeout=5):
    """Return (status_code, body_text) or (None, error_message)."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return None, str(e)


def check_response(status, body):
    """Return a list of failure reasons (empty list = pass)."""
    problems = []
    if status != 200:
        problems.append(f"Expected HTTP 200 from {URL}, got {status}.")
    for needle in MUST_CONTAIN:
        if needle not in body:
            problems.append(f"Response body is missing expected text: {needle!r}")
    return problems


def check_data_file(path):
    """Fetch one data file and prove it is real, parseable, non-empty JSON.
    Returns (problems, notes); empty problems = fine."""
    local = os.path.join(_HERE, SITE_DIR, *path.strip("/").split("/"))
    if not os.path.exists(local):
        if DATA_REQUIRED:
            return [f"{path} is missing on disk ({os.path.relpath(local, _HERE)}) "
                    "- run tools/build_elements.py"], []
        return [], [f"NOTE: {path} not built yet (arrives at M1) - skipped."]
    status, body = fetch(URL.rstrip("/") + path, timeout=5)
    if status != 200:
        return [f"Expected HTTP 200 from {path}, got {status}."], []
    try:
        parsed = json.loads(body)
    except ValueError as e:
        return [f"{path} is not valid JSON: {e}"], []
    if not parsed:
        return [f"{path} parsed but is EMPTY - stale or broken data build."], []
    return [], []


def stop_process(proc):
    """Shut down the server we started (including children on Windows)."""
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                       capture_output=True)
    else:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Smoke-test the static site on this machine.")
    parser.parse_args(argv)

    os.chdir(_HERE)

    # A static site with no index page is not 'nothing to verify' - it is
    # broken. Say so.
    if not os.path.exists(APP_FILE):
        print(f"FAIL: {APP_FILE} does not exist, so there is no site to "
              "serve. Every milestone from M0 on must keep it present.",
              file=sys.stderr)
        return 2

    # Case 1: something already answers (the human double-clicked run.bat).
    # A static server serves disk as it is right now, so reuse is honest.
    status, body = fetch(URL, timeout=3)
    started_here = None
    server_log = None
    if status is not None:
        print(f"(reusing the server already on port {PORT} - a static "
              "server serves the files on disk as they are now)")
    else:
        # Case 2: not running. Start it ourselves. Capture output to a temp
        # file rather than a PIPE so a full buffer can never deadlock it.
        server_log = tempfile.TemporaryFile()
        started_here = subprocess.Popen(
            SERVER_COMMAND, stdout=server_log, stderr=subprocess.STDOUT)
        deadline = time.time() + STARTUP_TIMEOUT_SECONDS
        while time.time() < deadline:
            status, body = fetch(URL, timeout=3)
            if status is not None:
                break
            if started_here.poll() is not None:
                print(f"FAIL: server process exited immediately (code "
                      f"{started_here.returncode}). Run it by hand to see "
                      f"the error: {' '.join(SERVER_COMMAND)}",
                      file=sys.stderr)
                said = server_output(server_log)
                if said:
                    print("--- what the server said ---", file=sys.stderr)
                    print(said, file=sys.stderr)
                return 2
            time.sleep(0.25)

    try:
        if status is None:
            print(f"FAIL: nothing responded at {URL} within "
                  f"{STARTUP_TIMEOUT_SECONDS}s. Last error: {body}",
                  file=sys.stderr)
            said = server_output(server_log)
            if said:
                print("--- what the server said ---", file=sys.stderr)
                print(said, file=sys.stderr)
            return 2

        problems = check_response(status, body)
        notes = []
        for path in DATA_FILES:
            p, n = check_data_file(path)
            problems.extend(p)
            notes.extend(n)
        for path, needle in EXTRA_PAGES:
            pstatus, pbody = fetch(URL.rstrip("/") + path, timeout=5)
            if pstatus != 200:
                problems.append(f"Expected HTTP 200 from {path}, got {pstatus}.")
            elif needle not in pbody:
                problems.append(f"{path} is missing expected text: {needle!r}")
        for note in notes:
            print(note)
        if problems:
            print("FAIL: " + " | ".join(problems), file=sys.stderr)
            return 2

        checked = len(DATA_FILES) - len(notes)
        print(f"PASS: {URL} returned 200 with all {len(MUST_CONTAIN)} "
              f"marker(s), {checked} data file(s) parsed, and "
              f"{len(EXTRA_PAGES)} extra page(s) answered.")
        return 0
    finally:
        if started_here is not None:
            stop_process(started_here)


if __name__ == "__main__":
    sys.exit(main())
