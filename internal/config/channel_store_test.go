package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestChannelStore_ZeroDemo_CleanEmptyState(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_channels_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	store := &ChannelStore{
		filePath: filepath.Join(tempDir, "channels.json"),
		channels: make([]ChannelConfig, 0),
	}
	_ = store.load()

	list := store.List()
	if len(list) != 0 {
		t.Fatalf("expected 0 channels on clean init, got %d", len(list))
	}

	primary := store.GetPrimary()
	if primary != nil {
		t.Fatalf("expected nil primary channel on clean init, got %+v", primary)
	}
}
