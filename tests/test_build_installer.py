import unittest
from pathlib import Path

import build_installer


class WindowsInstallerContractTests(unittest.TestCase):
    def test_core_command_embeds_current_frontend_dist(self):
        command = build_installer.core_command()
        self.assertIn(str(build_installer.DESKTOP_ENTRY), command)
        self.assertIn(f"{build_installer.FRONTEND_DIST};dist", command)
        self.assertIn("CodeMind-Studio", command)

    def test_setup_command_embeds_generated_core_payload(self):
        command = build_installer.setup_command()
        self.assertIn(str(build_installer.SETUP_ENTRY), command)
        self.assertIn(f"{build_installer.PAYLOAD_DIR};payload", command)
        self.assertIn("CodeMind-Studio-Setup", command)

    def test_installer_output_has_required_name_and_location(self):
        self.assertEqual(
            build_installer.installer_output(),
            Path(build_installer.ROOT, "release", "CodeMind-Studio-Setup.exe")
        )


if __name__ == '__main__':
    unittest.main()
