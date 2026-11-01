"""check_live.py — has my push finished deploying? (Phase 4 M13)

Run:  python tools/check_live.py                      check the live site
      python tools/check_live.py --url http://127.0.0.1:5093/   check any copy

It downloads the live site's sw.js, reads the VERSION and FILES list in it,
downloads every listed file, and hashes each one with the same rule the
service worker uses (build_sw.content_hash, imported, so the two can never
disagree). Then it compares the live version with your local docs/.

Prints one of:
  live site is version X, all N files match -- same as your local docs/   exit 0
  ...all N files match, BUT your local docs/ is version Y                 exit 1
     (your latest push has not deployed yet, or you have not pushed)
  STALE: the files that do not match yet                                  exit 1
     (GitHub Pages is still deploying, or a cache is serving old copies)

A student's browser installs a new version only when every file matches, so
"all N files match" is exactly the moment the update line can appear.
Standard library only.
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_sw import content_hash, manifest  # noqa: E402  (same folder)

LIVE = "https://gatorryan6-oss.github.io/trend-duel/"

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")


def fetch(url):
    """The bytes at url, or exit with a plain-English reason."""
    # no-cache asks any cache on the way to check with the server first.
    request = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as err:
        raise LookupError(f"HTTP {err.code}") from None
    except (urllib.error.URLError, TimeoutError) as err:
        sys.exit(f"Could not reach {url}: {getattr(err, 'reason', err)}. "
                 "Check the network, or the address.")


def read_manifest(sw_text):
    """VERSION and FILES out of a served sw.js, or exit saying why not."""
    version = re.search(r'const VERSION = "([0-9a-f]{7})";', sw_text)
    files = re.search(r"const FILES = (\{.*?\});", sw_text, re.S)
    if "KILL SWITCH" in sw_text:
        sys.exit("The live sw.js is the KILL SWITCH: no offline copy is being served. "
                 "Restore with: python tools/build_sw.py --restore")
    if not version or not files:
        sys.exit("The served sw.js has no VERSION / FILES block. Is this the Trend Duel site?")
    return version.group(1), json.loads(files.group(1))


def main(argv):
    parser = argparse.ArgumentParser(description="Compare a served Trend Duel with its own file list.")
    parser.add_argument("--url", default=LIVE, help=f"site root (default {LIVE})")
    args = parser.parse_args(argv)
    root = args.url if args.url.endswith("/") else args.url + "/"

    try:
        sw_text = fetch(root + "sw.js").decode("utf-8")
    except LookupError as err:
        sys.exit(f"{root}sw.js answered {err}. Has M12 been pushed to this site?")
    version, files = read_manifest(sw_text)

    stale = []
    for path, want in sorted(files.items()):
        try:
            got = content_hash(fetch(root + path))
        except LookupError as err:
            stale.append(f"{path} (answered {err})")
            continue
        if got != want:
            stale.append(f"{path} (old or different copy)")

    if stale:
        print(f"STALE: {root} lists version {version}, but {len(stale)} of {len(files)} "
              "files do not match it yet:")
        for line in stale:
            print(f"  - {line}")
        print("GitHub Pages is probably still deploying. Wait a minute and run this again.")
        return 1

    local_version, _ = manifest()
    print(f"live site is version {version}, all {len(files)} files match", end="")
    if version == local_version:
        print(" -- same as your local docs/.")
        return 0
    print(f", BUT your local docs/ is version {local_version}.")
    print("Your latest change has not deployed yet (or is not pushed, or build_sw.py was not rerun).")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
