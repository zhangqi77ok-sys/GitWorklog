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

    def test_frontend_commands_use_node_npm_cli_without_cmd_wrapper(self):
        command = build_installer.frontend_npm_command("run", "build")
        self.assertTrue(command)
        self.assertTrue(command[0].lower().endswith("node.exe"))
        self.assertTrue(command[1].lower().endswith("npm-cli.js"))
        self.assertEqual(command[-2:], ["run", "build"])


if __name__ == '__main__':
    unittest.main()
