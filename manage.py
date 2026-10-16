#!/usr/bin/env python3
"""Install/remove the mod without distributing any game files (Python 3.10+)."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent
VERSION = "1.4.0"
MANIFEST = "cjs-formations.json"
BEGIN = b"\n/* CJS_FORMATIONS_BEGIN */\n"
END = b"\n/* CJS_FORMATIONS_END */\n"
GAME_FILES = ("data.json", "scripts/main.js", "scripts/c3runtime.js")
SUPPORTED_BUILDS = {
    "25948794": {
        "data.json": "bfb3baa8f9d346f1fb3e83c9f98bc0230f3a89448181feda1e9e0ec3d627232f",
        "scripts/main.js": "a7660e495d5dcbed209f1fdc5092e82483474f6150c43bf38cfebb0029541da5",
        "scripts/c3runtime.js": "169f0cae5285fbd2d5dd5d4c810f304e68ba0f6467620f1cbfa6a229fd37689a",
    },
    "25975458": {
        "data.json": "145234bcea89130263135b8336b6b078de32ee6e12bb17e510110cbddd133555",
        "scripts/main.js": "a7660e495d5dcbed209f1fdc5092e82483474f6150c43bf38cfebb0029541da5",
        "scripts/c3runtime.js": "ff3accd9d83dde09da5675293fc0969ef1994c834945d25b5de4d9b3db7b5237",
    },
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def supported_build(originals):
    hashes = {name: digest(originals[name]) for name in GAME_FILES}
    return next((build for build, expected in SUPPORTED_BUILDS.items() if hashes == expected), None)


def file_digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def original_scripts(archive):
    if len(archive.namelist()) != len(set(archive.namelist())):
        raise ValueError("Duplicate archive entries; refusing to modify this package.")
    originals = {name: archive.read(name) for name in GAME_FILES}
    manifest = json.loads(archive.read(MANIFEST)) if MANIFEST in archive.namelist() else None
    if manifest:
        if manifest.get("format") != 1:
            raise ValueError("Unknown mod manifest format.")
        for name in ("scripts/main.js", "scripts/c3runtime.js"):
            body = originals[name]
            if body.count(BEGIN) != 1 or not body.endswith(END):
                raise ValueError(f"Mod block changed in {name}; refusing to remove it.")
            original, suffix = body.split(BEGIN)
            if digest(BEGIN + suffix) != manifest["blocks"][name]:
                raise ValueError(f"Mod checksum mismatch in {name}.")
            originals[name] = original
    elif any(BEGIN in body for body in originals.values()):
        raise ValueError("Found an untracked mod block; refusing to overwrite it.")
    return originals, manifest


def write_package(source, output, uninstall=False):
    with zipfile.ZipFile(source) as archive:
        originals, installed = original_scripts(archive)
        if uninstall and not installed:
            raise ValueError("The mod is not installed.")
        build = supported_build(originals)
        if not uninstall and not build:
            raise ValueError("Unsupported game build or another modification. No files changed. A compatibility update is required.")
        replacements = {name: originals[name] for name in ("scripts/main.js", "scripts/c3runtime.js")}
        manifest = {"format": 1, "version": VERSION, "game_build": build, "blocks": {}}
        if not uninstall:
            sources = {"scripts/main.js": ["dom.js"], "scripts/c3runtime.js": ["formations.js", "combat.js", "forest.js", "recruit.js", "recruit-runtime.js", "runtime.js"]}
            for name, files in sources.items():
                block = BEGIN + b"\n".join((ROOT / "src" / f).read_bytes() for f in files) + END
                manifest["blocks"][name] = digest(block)
                replacements[name] += block
        with zipfile.ZipFile(output, "w") as result:
            result.comment = archive.comment
            for info in archive.infolist():
                if info.filename == MANIFEST:
                    continue
                result.writestr(info, replacements.get(info.filename, archive.read(info.filename)))
            if not uninstall:
                result.writestr(MANIFEST, json.dumps(manifest, indent=2))
    with zipfile.ZipFile(output) as result:
        broken = result.testzip()
        if broken:
            raise ValueError(f"Archive verification failed: {broken}")


def default_game_dir():
    candidates = [
        Path.home() / ".steam/debian-installation/steamapps/common/塔防山贼模拟器",
        Path.home() / ".local/share/Steam/steamapps/common/塔防山贼模拟器",
        Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Steam/steamapps/common/塔防山贼模拟器",
    ]
    return next((p for p in candidates if (p / "package.nw").is_file()), None)


def install(game_dir, uninstall=False):
    source = game_dir / "package.nw"
    if not source.is_file():
        raise ValueError(f"Game package not found: {source}")
    lock = game_dir / ".cjs-formations.lock"
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    temp = None
    try:
        before = file_digest(source)
        fd, filename = tempfile.mkstemp(prefix=".cjs-formations-", suffix=".nw", dir=game_dir)
        os.close(fd)
        temp = Path(filename)
        write_package(source, temp, uninstall)
        # Keep every distinct input package, including before mod upgrades.
        backup_dir = game_dir / "cjs-formations-backups"
        backup_dir.mkdir(exist_ok=True)
        backup = backup_dir / f"package-{before}.nw"
        if not backup.exists():
            shutil.copy2(source, backup)
        if file_digest(backup) != before or file_digest(source) != before:
            raise ValueError("The game package changed during installation; original left in place.")
        shutil.copymode(source, temp)
        with temp.open("rb") as stream:
            os.fsync(stream.fileno())
        os.replace(temp, source)
        print(f"{'Removed' if uninstall else 'Installed'} Bandit TD Formations {VERSION}.")
        print(f"Backup: {backup}")
        print("Restart the game to load the change. Existing game saves were not edited.")
    finally:
        if temp and temp.exists():
            temp.unlink()
        lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["install", "uninstall", "status", "build"])
    parser.add_argument("--game-dir", type=Path, help="Directory containing game.exe and package.nw")
    parser.add_argument("--package", type=Path, help="Original package.nw (build only)")
    parser.add_argument("--output", type=Path, help="Patched package path (build only)")
    args = parser.parse_args()
    try:
        if args.command == "build":
            if not args.package or not args.output:
                parser.error("build requires --package and --output")
            if args.output.exists() or args.package.resolve() == args.output.resolve():
                raise ValueError("Build output must be a new file.")
            try:
                write_package(args.package, args.output)
            except Exception:
                args.output.unlink(missing_ok=True)
                raise
            print(f"Built {args.output}")
            return
        game_dir = args.game_dir or default_game_dir()
        if not game_dir:
            parser.error("Game not found. Provide --game-dir.")
        if args.command == "status":
            with zipfile.ZipFile(game_dir / "package.nw") as archive:
                originals, installed = original_scripts(archive)
            print(f"Installed: {installed['version']}" if installed else "Not installed")
            build = supported_build(originals)
            print(f"Supported game build: {build}" if build else "Untested game build")
            if not installed:
                print("Steam updates and file verification can remove the mod.")
                print("Run the install command again, then restart the game." if build else
                      "This game build needs a compatibility update before reinstalling.")
        else:
            install(game_dir, args.command == "uninstall")
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        parser.exit(1, f"Error: {error}\n")


if __name__ == "__main__":
    main()
