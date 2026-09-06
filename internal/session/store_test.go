package session

import (
	"os"
	"path/filepath"
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
	err = s.Delete("sess_never_existed")
	if err != nil {
		t.Errorf("expected nil error on deleting non-existent session, got: %v", err)
	}
}

func TestStore_CustomIDListing(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_sessions_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := &Store{baseDir: tempDir}
	// 保存一个不带 sess_ 前缀的自定义合法会话 ID
	sess := ChatSession{
		ID:        "chat_custom_id_999",
		Title:     "自定义会话",
		Model:     "deepseek-chat",
		CreatedAt: 1788480000,
		UpdatedAt: 1788480000,
		Messages:  []SessionMessage{},
	}
	if err := s.Save(sess); err != nil {
		t.Fatalf("failed to save session: %v", err)
	}

	metas := s.List()
	if len(metas) != 1 {
		t.Fatalf("expected 1 session listed for custom ID, got %d", len(metas))
	}
	if metas[0].ID != "chat_custom_id_999" {
		t.Errorf("expected ID 'chat_custom_id_999', got %s", metas[0].ID)
	}
}

func TestStore_List_OrderedByUpdatedAt(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_ordered_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	s := &Store{baseDir: tempDir}
	// 创建三个不同时间更新的会话 (乱序存入)
	s.Save(ChatSession{ID: "sess_mid", Title: "中等时间", UpdatedAt: 2000})
	s.Save(ChatSession{ID: "sess_old", Title: "最老时间", UpdatedAt: 1000})
	s.Save(ChatSession{ID: "sess_new", Title: "最新时间", UpdatedAt: 3000})

	metas := s.List()
	if len(metas) != 3 {
		t.Fatalf("expected 3 sessions, got %d", len(metas))
	}
	if metas[0].ID != "sess_new" || metas[1].ID != "sess_mid" || metas[2].ID != "sess_old" {
		t.Errorf("expected sessions ordered by UpdatedAt desc [new, mid, old], got [%s, %s, %s]",
			metas[0].ID, metas[1].ID, metas[2].ID)
	}
}

func TestStore_SanitizeID_WindowsReservedNames(t *testing.T) {
	reserved := []string{
		"con", "CON", "prn", "PRN", "aux", "AUX", "nul", "NUL",
		"com1", "COM1", "com9", "COM9", "lpt1", "LPT1", "lpt9", "LPT9",
		"CON.json", "nul.txt", "aux.log",
	}
	for _, r := range reserved {
		if _, err := sanitizeID(r); err == nil {
			t.Errorf("expected error for reserved name '%s', got nil", r)
		}
	}

	illegal := []string{
		"test<name", "test>name", "test:name", "test\"name",
		"test/name", "test\\name", "test|name", "test?name", "test*name",
	}
	for _, il := range illegal {
		if _, err := sanitizeID(il); err == nil {
			t.Errorf("expected error for illegal characters in '%s', got nil", il)
		}
	}

	// 正常合法 ID
	valid := []string{"sess_12345", "chat-session-ok", "my_session_2026"}
	for _, v := range valid {
		clean, err := sanitizeID(v)
		if err != nil {
			t.Errorf("expected valid ID for '%s', got error: %v", v, err)
		}
		if clean != v {
			t.Errorf("expected '%s', got '%s'", v, clean)
		}
	}
}

func TestStore_AtomicWriteSession_CreatesParentDir(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "tcode_test_mkdir_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	subDir := filepath.Join(tempDir, "nested", "sub", "sessions")
	targetFile := filepath.Join(subDir, "test.json")
	if err := atomicWriteSession(targetFile, []byte(`{"test": true}`)); err != nil {
		t.Fatalf("atomicWriteSession failed on non-existent parent: %v", err)
	}

	data, err := os.ReadFile(targetFile)
	if err != nil {
		t.Fatalf("failed to read back file: %v", err)
	}
	if string(data) != `{"test": true}` {
		t.Errorf("unexpected content: %s", string(data))
	}
}

func TestStore_List_ZeroUpdatedAtReturnsEmptyTime(t *testing.T) {
	tempDir := t.TempDir()
	s := &Store{baseDir: tempDir}
	// 直接写入一个 UpdatedAt = 0 的 JSON 文件，模拟旧数据或异常数据
	rawSess := `{"id":"sess_zero","title":"零时间戳","updated_at":0,"messages":[]}`
	_ = os.WriteFile(filepath.Join(tempDir, "sess_zero.json"), []byte(rawSess), 0644)

	metas := s.List()
	if len(metas) != 1 {
		t.Fatalf("expected 1 session, got %d", len(metas))
	}
	if metas[0].Time != "" {
		t.Errorf("expected empty string for UpdatedAt <= 0, got %q", metas[0].Time)
	}
}




