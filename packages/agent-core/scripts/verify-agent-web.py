#!/usr/bin/env python3
"""Produce or verify the release manifest for the two bundled WebView apps."""

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def collect(root, manifest_path):
    paths = [manifest_path.parent / "agent-contract.json"]
    for name in ("Chaty", "Zen"):
        directory = root / name
        if not directory.exists():
            directory = root / name.lower()
        if not (directory / "index.html").is_file():
            raise SystemExit(f"Missing {directory}/index.html")
        paths.extend(path for path in directory.rglob("*") if path.is_file())
    return {str(path.relative_to(root)): sha(path) for path in sorted(paths)}


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("root", type=Path)
parser.add_argument("manifest", type=Path)
parser.add_argument("--write-from", type=Path)
parser.add_argument("--revision")
parser.add_argument("--release", action="store_true")
args = parser.parse_args()

files = collect(args.root, args.manifest)
contract = json.loads((args.manifest.parent / "agent-contract.json").read_text())
if contract.get("bridgeVersion") != 4:
    raise SystemExit("Bundled agent contract is not v4")

if args.write_from:
    def git(*options):
        return subprocess.check_output(["git", "-C", str(args.write_from), *options])
    revision = git("rev-parse", "HEAD").decode().strip()
    # Record the checked-out source including untracked implementation files.
    # Generated output is ignored by the Web checkout.
    source = hashlib.sha256()
    for name in sorted(set(git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split(b"\0"))):
        path = args.write_from / name.decode()
        if name and path.is_file():
            source.update(name + b"\0" + bytes.fromhex(sha(path)))
    payload = {
        "bridgeVersion": 4,
        "sourceRevision": revision,
        "sourceDigest": source.hexdigest(),
        "dirty": bool(git("status", "--porcelain", "--untracked-files=normal")),
        "files": files,
    }
    args.manifest.write_text(json.dumps(payload, indent=2) + "\n")
else:
    payload = json.loads(args.manifest.read_text())
    if payload.get("bridgeVersion") != 4 or payload.get("files") != files:
        raise SystemExit("Bundled Chaty/Zen resources do not match the v4 manifest")
    if not re.fullmatch(r"[0-9a-f]{40}", payload.get("sourceRevision", "")):
        raise SystemExit("Manifest does not identify a Web commit")
    if args.release and (payload.get("dirty") or payload.get("sourceRevision") != args.revision):
        raise SystemExit("Release requires Web assets rebuilt from the pinned clean commit")
