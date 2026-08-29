import unittest
from pathlib import Path

import build_installer


class WindowsInstallerContractTests(unittest.TestCase):
    def test_installer_paths(self):
        self.assertEqual(build_installer.VERSION, "1.5.0")
        self.assertEqual(
            build_installer.INSTALLER_OUTPUT,
            Path(build_installer.ROOT, "release", "Tcode-Setup-v1.5.0.exe")
        )
        self.assertEqual(
            build_installer.ZIP_OUTPUT,
            Path(build_installer.ROOT, "release", "Tcode-Setup-v1.5.0-windows-x64.zip")
        )


if __name__ == '__main__':
    unittest.main()
