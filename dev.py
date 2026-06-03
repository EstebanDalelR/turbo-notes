#!/usr/bin/env python3
"""Run the Django backend and the Vite frontend together with one command.

Merges both processes' output into a single, color-coded stream. Every line is
tagged with its source ([backend] / [frontend]) and classified into a log level
(LOG / INFO / WARN / ERROR) so you can scan severity at a glance.

Usage:
    python3 dev.py                 # run both servers
    python3 dev.py --no-color      # plain output (for logging to a file)
    python3 dev.py --level warn    # only show WARN and ERROR lines

Ctrl-C stops both servers.
"""
from __future__ import annotations

import argparse
import os
import re
import signal
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

# ── Levels ────────────────────────────────────────────────────────────────────
# Ordered by severity; numeric value used for --level filtering.
LEVELS = {"LOG": 0, "INFO": 1, "WARN": 2, "ERROR": 3}

ANSI = {
    "reset": "\033[0m",
    "dim": "\033[2m",
    "backend": "\033[36m",   # cyan
    "frontend": "\033[35m",  # magenta
    "LOG": "\033[37m",       # white/grey
    "INFO": "\033[32m",      # green
    "WARN": "\033[33m",      # yellow
    "ERROR": "\033[31m",     # red
}

ERROR_RE = re.compile(
    r"\b(error|err!|traceback|exception|fatal|critical|unhandled)\b"
    r'|"\s*\w+\s+\S+\s+HTTP/\d\.\d"\s+5\d\d',  # HTTP 5xx in Django's access log
    re.IGNORECASE,
)
WARN_RE = re.compile(
    r"\b(warn|warning|deprecat|notice)\b"
    r'|"\s*\w+\s+\S+\s+HTTP/\d\.\d"\s+4\d\d',  # HTTP 4xx (e.g. expected 403 on /me/)
    re.IGNORECASE,
)
INFO_RE = re.compile(
    r"\b(info|ready|listening|started|watching|compiled|migrat|system check)\b"
    r'|"\s*\w+\s+\S+\s+HTTP/\d\.\d"\s+[23]\d\d',  # HTTP 2xx/3xx
    re.IGNORECASE,
)


def classify(line: str) -> str:
    if ERROR_RE.search(line):
        return "ERROR"
    if WARN_RE.search(line):
        return "WARN"
    if INFO_RE.search(line):
        return "INFO"
    return "LOG"


def paint(text: str, *codes: str, enabled: bool = True) -> str:
    if not enabled:
        return text
    return "".join(ANSI[c] for c in codes) + text + ANSI["reset"]


class Runner:
    def __init__(self, color: bool, min_level: int) -> None:
        self.color = color
        self.min_level = min_level
        self.procs: list[subprocess.Popen] = []
        self.lock = threading.Lock()
        self.stopping = False

    def emit(self, source: str, line: str) -> None:
        level = classify(line)
        if LEVELS[level] < self.min_level:
            return
        ts = datetime.now().strftime("%H:%M:%S")
        src = paint(f"{source:>8}", source, enabled=self.color)
        lvl = paint(f"{level:<5}", level, enabled=self.color)
        stamp = paint(ts, "dim", enabled=self.color)
        with self.lock:
            print(f"{stamp} {src} {lvl} {line}", flush=True)

    def pump(self, source: str, proc: subprocess.Popen) -> None:
        assert proc.stdout is not None
        for raw in proc.stdout:
            self.emit(source, raw.rstrip("\n"))
        if not self.stopping:
            self.emit(source, f"process exited (code {proc.wait()})")

    def spawn(self, source: str, cmd: list[str], cwd: Path, env: dict) -> None:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=1,
            text=True,
        )
        self.procs.append(proc)
        threading.Thread(target=self.pump, args=(source, proc), daemon=True).start()

    def stop(self, *_: object) -> None:
        if self.stopping:
            return
        self.stopping = True
        self.emit("dev", "shutting down…")
        for proc in self.procs:
            if proc.poll() is None:
                proc.terminate()


def backend_python() -> str:
    """Prefer the project venv; fall back to the current interpreter."""
    for candidate in (BACKEND / ".venv/bin/python", BACKEND / "venv/bin/python"):
        if candidate.exists():
            return str(candidate)
    return sys.executable


def main() -> int:
    parser = argparse.ArgumentParser(description="Run backend + frontend together.")
    parser.add_argument("--no-color", action="store_true", help="disable ANSI colors")
    parser.add_argument(
        "--level",
        choices=[lvl.lower() for lvl in LEVELS],
        default="log",
        help="minimum level to display (default: log = everything)",
    )
    parser.add_argument("--backend-port", default="8000")
    args = parser.parse_args()

    color = not args.no_color and sys.stdout.isatty()
    runner = Runner(color=color, min_level=LEVELS[args.level.upper()])

    # Force unbuffered/colored child output so logs stream live.
    base_env = {**os.environ, "PYTHONUNBUFFERED": "1", "FORCE_COLOR": "1"}

    if not (FRONTEND / "node_modules").exists():
        runner.emit("dev", "frontend/node_modules missing — run `npm install` in frontend/")
    if backend_python() == sys.executable:
        runner.emit("dev", "no backend venv found — using the current Python interpreter")

    signal.signal(signal.SIGINT, runner.stop)
    signal.signal(signal.SIGTERM, runner.stop)

    runner.emit("dev", "starting backend (Django) + frontend (Vite) — Ctrl-C to stop")
    runner.spawn(
        "backend",
        [backend_python(), "manage.py", "runserver", args.backend_port],
        cwd=BACKEND,
        env=base_env,
    )
    runner.spawn("frontend", ["npm", "run", "dev"], cwd=FRONTEND, env=base_env)

    # Wait until both children exit (or Ctrl-C flips `stopping`).
    try:
        for proc in runner.procs:
            proc.wait()
    except KeyboardInterrupt:
        runner.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
