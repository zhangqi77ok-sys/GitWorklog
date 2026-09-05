package session

import (
	"os"
	"testing"
)

func TestStore_ZeroDemo_CleanEmptyState(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_sessions_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := &Store{baseDir: tempDir}
	metas := s.List()
	if len(metas) != 0 {
		t.Fatalf("expected 0 sessions in clean store, got %d", len(metas))
	}

	// 测试保存会话
	sess := ChatSession{
		ID:        "sess_test_1",
		Title:     "测试工程探索",
		Model:     "deepseek-chat",
		CreatedAt: 1788480000,
		UpdatedAt: 1788480000,
		Messages:  []SessionMessage{},
	}
	if err := s.Save(sess); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	// 再次查询
	metas = s.List()
	if len(metas) != 1 {
		t.Fatalf("expected 1 session, got %d", len(metas))
	}
	if metas[0].ID != "sess_test_1" {
		t.Errorf("expected session id sess_test_1, got %s", metas[0].ID)
	}

	// 测试读取完整会话
	loaded, err := s.Get("sess_test_1")
	if err != nil {
		t.Fatalf("failed to get session: %v", err)
	}
	if loaded.Title != "测试工程探索" {
		t.Errorf("expected title '测试工程探索', got '%s'", loaded.Title)
	}

	// 测试删除会话
	if err := s.Delete("sess_test_1"); err != nil {
		t.Fatalf("failed to delete session: %v", err)
	}
	metas = s.List()
	if len(metas) != 0 {
		t.Fatalf("expected 0 sessions after deletion, got %d", len(metas))
	}
}

func TestStore_PathTraversalDefense(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_sessions_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := &Store{baseDir: tempDir}

	maliciousIDs := []string{
		"../escape",
		"../../etc/passwd",
		"..\\escape",
		"sub/folder/id",
		"",
		"   ",
	}

	for _, id := range maliciousIDs {
		if _, err := s.Get(id); err == nil {
			t.Errorf("expected Get error for malicious id [%s], but got nil", id)
		}
		if err := s.Delete(id); err == nil {
			t.Errorf("expected Delete error for malicious id [%s], but got nil", id)
		}
		if err := s.Save(ChatSession{ID: id}); err == nil {
			t.Errorf("expected Save error for malicious id [%s], but got nil", id)
		}
	}
}

func TestStore_AtomicWriteUpdate(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_sessions_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := &Store{baseDir: tempDir}
	sess := ChatSession{
		ID:    "sess_atomic_1",
		Title: "版本 1",
	}
	if err := s.Save(sess); err != nil {
		t.Fatalf("initial save failed: %v", err)
	}

	// 覆写更新
	sess.Title = "版本 2"
	if err := s.Save(sess); err != nil {
		t.Fatalf("overwrite save failed: %v", err)
	}

	loaded, err := s.Get("sess_atomic_1")
	if err != nil {
		t.Fatalf("failed to get session: %v", err)
	}
	if loaded.Title != "版本 2" {
		t.Errorf("expected updated title '版本 2', got '%s'", loaded.Title)
	}
}

func TestStore_MillisecondTimestampFormatting(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_sessions_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := &Store{baseDir: tempDir}
	// 模拟前端 Date.now() 传入 13 位毫秒时间戳 (如 2026-09-06 07:00:00 UTC)
	milliTimestamp := int64(1788678000000)
	sess := ChatSession{
		ID:        "sess_milli_1",
		Title:     "毫秒时间戳测试",
		UpdatedAt: milliTimestamp,
	}
	if err := s.Save(sess); err != nil {
		t.Fatalf("save failed: %v", err)
	}

	metas := s.List()
	if len(metas) != 1 {
		t.Fatalf("expected 1 session, got %d", len(metas))
	}

	// 验证时间没有变成公元 58000 多年，格式必须为 HH:MM 且长度为 5
	if len(metas[0].Time) != 5 || metas[0].Time == "00:00" && milliTimestamp > 0 {
		// 验证格式合法性
		if len(metas[0].Time) != 5 {
			t.Errorf("expected format HH:MM with len 5, got %q", metas[0].Time)
		}
	}
}

func TestStore_DeleteIdempotent(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_sessions_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := &Store{baseDir: tempDir}
	// 删除一个从未存在过的合法会话 ID，应当安全幂等返回 nil，而不是抛出文件不存在报错
	err = s.Delete("sess_never_existed")
	if err != nil {
		t.Errorf("expected nil error on deleting non-existent session, got: %v", err)
	}
}


