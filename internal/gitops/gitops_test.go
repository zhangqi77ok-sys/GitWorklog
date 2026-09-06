package gitops

import (
	"testing"
)

func TestIsValidBranchName(t *testing.T) {
	valid := []string{"main", "feature/login", "fix-123", "v1.0.0", "dev_test"}
	for _, b := range valid {
		if !isValidBranchName(b) {
			t.Errorf("expected branch %q to be valid", b)
		}
	}

	invalid := []string{"", "-D", "--help", "main branch", "feature\nexploit", "foo~bar", "foo^1", "foo:bar", "foo?bar", "foo*bar", "foo[bar]"}
	for _, b := range invalid {
		if isValidBranchName(b) {
			t.Errorf("expected branch %q to be invalid", b)
		}
	}
}

func TestCheckoutBranch_InvalidName(t *testing.T) {
	err := CheckoutBranch(".", "-invalid")
	if err == nil {
		t.Errorf("expected error for -invalid branch name, got nil")
	}
}

func TestRestoreSnapshot_InvalidID(t *testing.T) {
	err := RestoreSnapshot(".", "rm -rf /")
	if err == nil {
		t.Errorf("expected error for invalid stash id, got nil")
	}
}

func TestIsValidStashID(t *testing.T) {
	valid := []string{"stash@{0}", "stash@{1}", "stash@{42}"}
	for _, s := range valid {
		if !isValidStashID(s) {
			t.Errorf("expected stash id %q to be valid", s)
		}
	}

	invalid := []string{"", "stash", "stash@{", "stash@{}", "stash@{abc}", "stash@{0}xyz", "stash@{0};rm -rf /"}
	for _, s := range invalid {
		if isValidStashID(s) {
			t.Errorf("expected stash id %q to be invalid", s)
		}
	}
}

