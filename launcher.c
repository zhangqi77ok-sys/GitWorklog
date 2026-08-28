#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "shell32.lib")

static int is_port_open(int port) {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        return 0;
    }
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) {
        WSACleanup();
        return 0;
    }
    
    u_long mode = 1;
    ioctlsocket(s, FIONBIO, &mode);

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_port = htons((unsigned short)port);

    connect(s, (struct sockaddr*)&addr, sizeof(addr));

    fd_set write_fds;
    FD_ZERO(&write_fds);
    FD_SET(s, &write_fds);

    struct timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 200000;

    int res = select(0, NULL, &write_fds, NULL, &tv);
    closesocket(s);
    WSACleanup();

    return (res > 0);
}

static void start_backend(const char* base_dir) {
    char venv_python[MAX_PATH];
    snprintf(venv_python, sizeof(venv_python), "%s\\.venv\\Scripts\\python.exe", base_dir);

    DWORD attrs = GetFileAttributesA(venv_python);
    const char* python_bin = (attrs != INVALID_FILE_ATTRIBUTES) ? venv_python : "python.exe";

    char cmd[1024];
    snprintf(cmd, sizeof(cmd), "\"%s\" -m uvicorn app.main:app --host 127.0.0.1 --port 8010", python_bin);

    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.dwFlags |= STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    ZeroMemory(&pi, sizeof(pi));

    CreateProcessA(
        NULL,
        cmd,
        NULL,
        NULL,
        FALSE,
        CREATE_NO_WINDOW | DETACHED_PROCESS,
        NULL,
        base_dir,
        &si,
        &pi
    );

    if (pi.hProcess) CloseHandle(pi.hProcess);
    if (pi.hThread) CloseHandle(pi.hThread);
}

static void find_browser_path(char* out_path, size_t out_len) {
    const char* candidates[] = {
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    };

    for (size_t i = 0; i < sizeof(candidates)/sizeof(candidates[0]); i++) {
        if (GetFileAttributesA(candidates[i]) != INVALID_FILE_ATTRIBUTES) {
            strncpy(out_path, candidates[i], out_len);
            return;
        }
    }
    strncpy(out_path, "msedge.exe", out_len);
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    char base_dir[MAX_PATH];
    GetModuleFileNameA(NULL, base_dir, MAX_PATH);
    char* last_slash = strrchr(base_dir, '\\');
    if (last_slash) *last_slash = '\0';

    // 1. 确保后台微服务处于监听状态
    if (!is_port_open(8010)) {
        start_backend(base_dir);
        for (int i = 0; i < 30; i++) {
            Sleep(100);
            if (is_port_open(8010)) break;
        }
    }

    // 2. 查找原生浏览器内核可执行路径
    char browser_path[MAX_PATH];
    find_browser_path(browser_path, sizeof(browser_path));

    // 3. 构建独立隔离沙箱用户数据路径
    char user_data_dir[MAX_PATH];
    char* local_app_data = getenv("LOCALAPPDATA");
    if (local_app_data) {
        snprintf(user_data_dir, sizeof(user_data_dir), "%s\\CodeMindStudio\\Profile", local_app_data);
    } else {
        snprintf(user_data_dir, sizeof(user_data_dir), "%s\\_profile", base_dir);
    }

    // 4. 以原生 App Window (无浏览器地址栏、无导航栏、独立任务栏应用窗口) 模式拉起
    char args[2048];
    snprintf(args, sizeof(args),
        "--app=\"http://127.0.0.1:8010/\" "
        "--window-size=1540,940 "
        "--user-data-dir=\"%s\" "
        "--app-id=\"CodeMindStudio\" "
        "--no-first-run "
        "--disable-default-apps "
        "--disable-extensions",
        user_data_dir
    );

    ShellExecuteA(NULL, "open", browser_path, args, base_dir, SW_SHOWNORMAL);

    return 0;
}
