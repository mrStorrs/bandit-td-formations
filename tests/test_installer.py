"""Synthetic archives only: no copyrighted game data is checked in."""
import importlib.util
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
        self.files = {name: f"original {name}\n".encode() for name in manage.SUPPORTED}
        self.files["asset.bin"] = bytes(range(256))
        with zipfile.ZipFile(self.package, "w") as z:
            for name, body in self.files.items():
                z.writestr(name, body)
        self.support = patch.object(manage, "SUPPORTED", {n: manage.digest(self.files[n]) for n in manage.SUPPORTED})
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
        with patch.dict(manage.SUPPORTED, {"data.json": "wrong"}):
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


if __name__ == "__main__":
    unittest.main()
