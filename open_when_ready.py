"""open_when_ready.py — open the browser once Trend Duel actually answers.

run.bat used to fire `start "" http://...` and THEN launch the server, so the
browser arrived several seconds before the server had bound the port and
showed "this site can't be reached". In front of a class that reads as a
broken app, and the fix everyone reaches for — double-click it again —
is the one thing that cannot help.

This waits for the port to answer and only then opens the page. If the
server never comes up it says so on stderr instead of opening a dead tab,
because a browser pointed at nothing is exactly the confusion this file
exists to remove.

Launcher kit, like verify.py: NOT part of docs/ (the site), and
deliberately not in verify.py's SERVED_SOURCES — it cannot change what
any page answers.
"""

from __future__ import annotations

import socket
import sys
import time
import webbrowser

HOST = "127.0.0.1"
# Generous: a cold start on this machine measured well under a second for http.server, and a first run
# after a Windows update can be slower still. The cost of waiting too long
# is nothing; the cost of giving up early is the bug this file fixes.
GIVE_UP_AFTER_S = 90.0
POLL_EVERY_S = 0.25


def answers(host, port, timeout_s=0.5):
    """True when something accepts a TCP connection on the port."""
    with socket.socket() as probe:
        probe.settimeout(timeout_s)
        return probe.connect_ex((host, port)) == 0


def open_when_ready(port, give_up_after_s=GIVE_UP_AFTER_S, opener=None):
    """Wait for the server, then open the browser. Returns an exit code.

    `opener` exists so this can be tested without launching a browser.
    """
    opener = webbrowser.open if opener is None else opener
    url = f"http://{HOST}:{port}/"
    deadline = time.monotonic() + give_up_after_s
    while time.monotonic() < deadline:
        if answers(HOST, port):
            opener(url)
            return 0
        time.sleep(POLL_EVERY_S)
    print(f"Trend Duel never answered on port {port} within "
          f"{give_up_after_s:g} s, so no browser was opened. The reason is "
          "in the Trend Duel window.", file=sys.stderr)
    return 1


def main(argv=None):
    """CLI entry point. Returns a process exit code."""
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print("usage: python open_when_ready.py <port>", file=sys.stderr)
        return 2
    try:
        port = int(argv[0])
    except ValueError:
        print(f"port must be a number; got {argv[0]!r}", file=sys.stderr)
        return 2
    return open_when_ready(port)


if __name__ == "__main__":
    sys.exit(main())
