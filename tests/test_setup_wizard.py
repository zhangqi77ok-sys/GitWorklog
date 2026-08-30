import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "src-desktop" / "setup_wizard.py"
spec = importlib.util.spec_from_file_location("setup_wizard_contract", MODULE_PATH)
setup_wizard = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(setup_wizard)


class SetupWizardContractTests(unittest.TestCase):
    def test_silent_install_argument_requires_an_explicit_target(self):
        self.assertEqual(
            setup_wizard.parse_silent_install_dir(
                ["Tcode-Setup.exe", "--silent-install-dir", r"E:\\smoke-install"]
            ),
            Path(r"E:\\smoke-install"),
        )
        self.assertIsNone(setup_wizard.parse_silent_install_dir(["Tcode-Setup.exe"]))
        with self.assertRaises(ValueError):
            setup_wizard.parse_silent_install_dir(["Tcode-Setup.exe", "--silent-install-dir"])


if __name__ == "__main__":
    unittest.main()
