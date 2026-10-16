"""Synthetic archives only: no copyrighted game data is checked in."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location("manage", Path(__file__).parents[1] / "manage.py")
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.package = self.root / "package.nw"
        self.files = {name: f"original {name}\n".encode() for name in manage.GAME_FILES}
        self.files["asset.bin"] = bytes(range(256))
        with zipfile.ZipFile(self.package, "w") as z:
            for name, body in self.files.items():
                z.writestr(name, body)
        self.support = patch.object(manage, "SUPPORTED_BUILDS", {
            "first-build": {n: manage.digest(self.files[n]) for n in manage.GAME_FILES},
        })
        self.support.start()
        self.addCleanup(self.support.stop)

    def test_install_reinstall_uninstall_preserves_original_entries(self):
        manage.install(self.root)
        manage.install(self.root)
        with zipfile.ZipFile(self.package) as z:
            self.assertEqual(z.read("asset.bin"), self.files["asset.bin"])
            self.assertEqual(z.read("scripts/main.js").count(manage.BEGIN), 1)
        manage.install(self.root, uninstall=True)
        with zipfile.ZipFile(self.package) as z:
            self.assertEqual(set(z.namelist()), set(self.files))
            for name, body in self.files.items():
                self.assertEqual(z.read(name), body)

    def test_unknown_build_and_existing_lock_leave_input_unchanged(self):
        before = self.package.read_bytes()
        with patch.dict(manage.SUPPORTED_BUILDS, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "Unsupported"):
                manage.install(self.root)
        self.assertEqual(self.package.read_bytes(), before)
        (self.root / ".cjs-formations.lock").touch()
        with self.assertRaises(FileExistsError):
            manage.install(self.root)
        self.assertEqual(self.package.read_bytes(), before)

    def test_tampered_mod_is_not_silently_removed(self):
        target = self.root / "patched.nw"
        manage.write_package(self.package, target)
        with zipfile.ZipFile(target) as z:
            entries = {name: z.read(name) for name in z.namelist()}
        entries["scripts/main.js"] = entries["scripts/main.js"].replace(b"this.ready = false", b"this.ready = true")
        with zipfile.ZipFile(self.package, "w") as z:
            for name, body in entries.items(): z.writestr(name, body)
        before = self.package.read_bytes()
        with self.assertRaisesRegex(ValueError, "checksum"):
            manage.install(self.root, uninstall=True)
        self.assertEqual(self.package.read_bytes(), before)

    def test_reinstall_after_game_update_preserves_new_build_and_rejects_mixed_files(self):
        manage.install(self.root)
        updated = {name: b"updated " + body for name, body in self.files.items()}
        # Simulate Steam replacing the whole archive, including removing the mod.
        with zipfile.ZipFile(self.package, "w") as z:
            for name, body in updated.items(): z.writestr(name, body)
        with patch.dict(manage.SUPPORTED_BUILDS, {
            "second-build": {n: manage.digest(updated[n]) for n in manage.GAME_FILES},
        }):
            manage.install(self.root)
            with zipfile.ZipFile(self.package) as z:
                originals, manifest = manage.original_scripts(z)
                self.assertEqual(manifest["game_build"], "second-build")
                self.assertEqual(originals, {n: updated[n] for n in manage.GAME_FILES})
                self.assertEqual(z.read("asset.bin"), updated["asset.bin"])
                self.assertEqual(json.loads(z.read(manage.MANIFEST))["version"], manage.VERSION)
            updated["data.json"] = self.files["data.json"]
            with zipfile.ZipFile(self.package, "w") as z:
                for name, body in updated.items(): z.writestr(name, body)
            before = self.package.read_bytes()
            with self.assertRaisesRegex(ValueError, "Unsupported"):
                manage.install(self.root)
            self.assertEqual(self.package.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
