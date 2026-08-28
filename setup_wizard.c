#define WIN32_LEAN_AND_MEAN
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <commctrl.h>
#include <shlobj.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <wchar.h>

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "uuid.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "user32.lib")

#define ID_BTN_BROWSE    101
#define ID_BTN_INSTALL   102
#define ID_BTN_CANCEL    103
#define ID_CHK_DESKTOP   104
#define ID_CHK_STARTMENU 105
#define ID_CHK_LAUNCH    106
#define ID_EDIT_PATH     107
#define ID_PROGRESS      108
#define ID_LBL_STATUS    109

static HWND g_hWndMain;
static HWND g_hPathEdit;
static HWND g_hBtnBrowse;
static HWND g_hBtnInstall;
static HWND g_hBtnCancel;
static HWND g_hChkDesktop;
static HWND g_hChkStartMenu;
static HWND g_hChkLaunch;
static HWND g_hProgress;
static HWND g_hLblStatus;

static HFONT g_hFontHeaderTitle;
static HFONT g_hFontHeaderSub;
static HFONT g_hFontBold;
static HFONT g_hFontNormal;
static HFONT g_hFontSmall;

static HBRUSH g_hBrushBg;
static HBRUSH g_hBrushHeader;
static HBRUSH g_hBrushCard;
static HBRUSH g_hBrushBrand;

static BOOL g_bInstalling = FALSE;
static BOOL g_bFinished = FALSE;
static wchar_t g_InstallDir[MAX_PATH];

static void SetStatusText(const wchar_t* text) {
    SetWindowTextW(g_hLblStatus, text);
    InvalidateRect(g_hLblStatus, NULL, TRUE);
}

static void LaunchInstalledApp() {
    wchar_t targetExe[MAX_PATH];
    swprintf(targetExe, MAX_PATH, L"%s\\CodeMind-Studio.exe", g_InstallDir);
    
    // 优先使用 ShellExecuteW
    HINSTANCE hInst = ShellExecuteW(NULL, L"open", targetExe, NULL, g_InstallDir, SW_SHOWNORMAL);
    if ((INT_PTR)hInst <= 32) {
        // Fallback: CreateProcessW
        STARTUPINFOW si;
        PROCESS_INFORMATION pi;
        ZeroMemory(&si, sizeof(si));
        si.cb = sizeof(si);
        ZeroMemory(&pi, sizeof(pi));
        wchar_t cmd[MAX_PATH + 4];
        swprintf(cmd, MAX_PATH + 4, L"\"%s\"", targetExe);
        if (CreateProcessW(NULL, cmd, NULL, NULL, FALSE, 0, NULL, g_InstallDir, &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
        }
    }
}

static DWORD WINAPI InstallThread(LPVOID lpParam) {
    HWND hWnd = (HWND)lpParam;

    // 1. 获取安装路径
    GetWindowTextW(g_hPathEdit, g_InstallDir, MAX_PATH);
    if (wcslen(g_InstallDir) == 0) {
        MessageBoxW(hWnd, L"请选择有效的安装路径！", L"提示", MB_OK | MB_ICONWARNING);
        EnableWindow(g_hBtnInstall, TRUE);
        EnableWindow(g_hBtnCancel, TRUE);
        g_bInstalling = FALSE;
        return 0;
    }

    SetStatusText(L"正在准备安装目录与运行时环境...");
    SendMessage(g_hProgress, PBM_SETPOS, 10, 0);

    // 创建目录
    SHCreateDirectoryExW(NULL, g_InstallDir, NULL);

    // 2. 从资源中提取 app_payload.zip
    SetStatusText(L"正在解压核心组件与 React 19 工作台...");
    SendMessage(g_hProgress, PBM_SETPOS, 25, 0);

    HRSRC hRes = FindResourceA(NULL, MAKEINTRESOURCEA(100), MAKEINTRESOURCEA(10));
    if (!hRes) {
        MessageBoxW(hWnd, L"无法定位安装包资源！", L"错误", MB_OK | MB_ICONERROR);
        g_bInstalling = FALSE;
        return 0;
    }

    HGLOBAL hData = LoadResource(NULL, hRes);
    DWORD dwSize = SizeofResource(NULL, hRes);
    void* pData = LockResource(hData);

    wchar_t tempDir[MAX_PATH];
    wchar_t tempZipPath[MAX_PATH];
    GetTempPathW(MAX_PATH, tempDir);
    swprintf(tempZipPath, MAX_PATH, L"%s\\codemind_setup_payload.zip", tempDir);

    FILE* fp = _wfopen(tempZipPath, L"wb");
    if (fp) {
        fwrite(pData, 1, dwSize, fp);
        fclose(fp);
    }

    SendMessage(g_hProgress, PBM_SETPOS, 45, 0);

    // 3. 使用 Windows 原生高速 tar.exe 执行毫秒级解压
    wchar_t tarCmd[2048];
    swprintf(tarCmd, 2048, L"tar.exe -xf \"%s\" -C \"%s\"", tempZipPath, g_InstallDir);

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.dwFlags |= STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    ZeroMemory(&pi, sizeof(pi));

    if (CreateProcessW(NULL, tarCmd, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        WaitForSingleObject(pi.hProcess, INFINITE);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }

    // 删除临时压缩包
    DeleteFileW(tempZipPath);

    SendMessage(g_hProgress, PBM_SETPOS, 75, 0);

    // 4. 创建快捷方式
    BOOL bDesktop = (SendMessageW(g_hChkDesktop, BM_GETCHECK, 0, 0) == BST_CHECKED);
    BOOL bStartMenu = (SendMessageW(g_hChkStartMenu, BM_GETCHECK, 0, 0) == BST_CHECKED);

    wchar_t targetExe[MAX_PATH];
    swprintf(targetExe, MAX_PATH, L"%s\\CodeMind-Studio.exe", g_InstallDir);
    wchar_t targetIco[MAX_PATH];
    swprintf(targetIco, MAX_PATH, L"%s\\app.ico", g_InstallDir);

    SetStatusText(L"正在生成桌面快捷方式与系统开始菜单...");

    wchar_t scCmd[4096];
    wchar_t desktopSnippet[1024] = L"";
    wchar_t startMenuSnippet[1024] = L"";

    if (bDesktop) {
        swprintf(desktopSnippet, 1024,
            L"$ws = New-Object -ComObject WScript.Shell; "
            L"$d = [Environment]::GetFolderPath('Desktop'); "
            L"$s = $ws.CreateShortcut((Join-Path $d 'CodeMind Studio.lnk')); "
            L"$s.TargetPath = '%s'; $s.WorkingDirectory = '%s'; $s.IconLocation = '%s'; $s.Save(); ",
            targetExe, g_InstallDir, targetIco
        );
    }
    if (bStartMenu) {
        swprintf(startMenuSnippet, 1024,
            L"$sm = [Environment]::GetFolderPath('Programs') + '\\CodeMind Studio'; "
            L"if (-not (Test-Path $sm)) { New-Item -ItemType Directory -Path $sm | Out-Null }; "
            L"$s2 = $ws.CreateShortcut((Join-Path $sm 'CodeMind Studio.lnk')); "
            L"$s2.TargetPath = '%s'; $s2.WorkingDirectory = '%s'; $s2.IconLocation = '%s'; $s2.Save(); ",
            targetExe, g_InstallDir, targetIco
        );
    }

    swprintf(scCmd, 4096,
        L"powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"%s%s\"",
        desktopSnippet, startMenuSnippet
    );

    STARTUPINFOW si2;
    PROCESS_INFORMATION pi2;
    ZeroMemory(&si2, sizeof(si2));
    si2.cb = sizeof(si2);
    si2.dwFlags |= STARTF_USESHOWWINDOW;
    si2.wShowWindow = SW_HIDE;
    ZeroMemory(&pi2, sizeof(pi2));

    if (CreateProcessW(NULL, scCmd, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si2, &pi2)) {
        WaitForSingleObject(pi2.hProcess, INFINITE);
        CloseHandle(pi2.hProcess);
        CloseHandle(pi2.hThread);
    }

    // 强制通知 Windows Shell 刷新桌面与任务栏图标
    SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, NULL, NULL);

    SendMessage(g_hProgress, PBM_SETPOS, 90, 0);

    // 5. 写入 Windows 控制面板卸载信息
    SetStatusText(L"正在注册系统应用信息...");
    HKEY hKey;
    const wchar_t* uninstPath = L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CodeMindStudio";
    if (RegCreateKeyExW(HKEY_CURRENT_USER, uninstPath, 0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL) == ERROR_SUCCESS) {
        const wchar_t* dispName = L"CodeMind Studio · Cockpit Coding Studio";
        const wchar_t* dispVer = L"2.11.0";
        const wchar_t* pub = L"CodeMind AI Team";
        RegSetValueExW(hKey, L"DisplayName", 0, REG_SZ, (const BYTE*)dispName, (DWORD)((wcslen(dispName) + 1) * sizeof(wchar_t)));
        RegSetValueExW(hKey, L"DisplayVersion", 0, REG_SZ, (const BYTE*)dispVer, (DWORD)((wcslen(dispVer) + 1) * sizeof(wchar_t)));
        RegSetValueExW(hKey, L"Publisher", 0, REG_SZ, (const BYTE*)pub, (DWORD)((wcslen(pub) + 1) * sizeof(wchar_t)));
        RegSetValueExW(hKey, L"InstallLocation", 0, REG_SZ, (const BYTE*)g_InstallDir, (DWORD)((wcslen(g_InstallDir) + 1) * sizeof(wchar_t)));
        RegSetValueExW(hKey, L"DisplayIcon", 0, REG_SZ, (const BYTE*)targetIco, (DWORD)((wcslen(targetIco) + 1) * sizeof(wchar_t)));
        RegCloseKey(hKey);
    }

    SendMessage(g_hProgress, PBM_SETPOS, 100, 0);
    SetStatusText(L"🎉 安装完成！CodeMind Studio 已就绪，随时可启动。");

    // 切换按钮状态
    SetWindowTextW(g_hBtnInstall, L"完成并运行");
    EnableWindow(g_hBtnInstall, TRUE);
    ShowWindow(g_hBtnCancel, SW_HIDE);
    g_bFinished = TRUE;
    g_bInstalling = FALSE;

    return 0;
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
    case WM_CREATE: {
        g_hWndMain = hWnd;
        INITCOMMONCONTROLSEX icex;
        icex.dwSize = sizeof(INITCOMMONCONTROLSEX);
        icex.dwICC = ICC_PROGRESS_CLASS | ICC_STANDARD_CLASSES;
        InitCommonControlsEx(&icex);

        // 高清 ClearType 字体创建 (Segoe UI / 微软雅黑)
        g_hFontHeaderTitle = CreateFontW(22, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, L"Microsoft YaHei UI");
        g_hFontHeaderSub = CreateFontW(14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, L"Microsoft YaHei UI");
        g_hFontBold = CreateFontW(15, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, L"Microsoft YaHei UI");
        g_hFontNormal = CreateFontW(14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, L"Microsoft YaHei UI");
        g_hFontSmall = CreateFontW(13, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, L"Microsoft YaHei UI");

        // 现代化调色画刷
        g_hBrushBg = CreateSolidBrush(RGB(248, 246, 243));     // #F8F6F3 极简现代浅灰背景
        g_hBrushHeader = CreateSolidBrush(RGB(24, 24, 27));    // #18181B 高级深灰暗调顶部
        g_hBrushCard = CreateSolidBrush(RGB(255, 255, 255));   // #FFFFFF 白色卡片
        g_hBrushBrand = CreateSolidBrush(RGB(217, 107, 39));   // #D96B27 品牌橙

        // 默认安装路径
        wchar_t localApp[MAX_PATH];
        wchar_t defPath[MAX_PATH];
        GetEnvironmentVariableW(L"LOCALAPPDATA", localApp, MAX_PATH);
        swprintf(defPath, MAX_PATH, L"%s\\Programs\\CodeMind-Studio", localApp);

        // 控件创建
        HWND hLblPath = CreateWindowW(L"STATIC", L"安装目标文件夹：", WS_CHILD | WS_VISIBLE, 32, 100, 200, 20, hWnd, NULL, NULL, NULL);
        SendMessageW(hLblPath, WM_SETFONT, (WPARAM)g_hFontBold, TRUE);

        g_hPathEdit = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", defPath, WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL, 32, 126, 450, 28, hWnd, (HMENU)ID_EDIT_PATH, NULL, NULL);
        SendMessageW(g_hPathEdit, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        g_hBtnBrowse = CreateWindowW(L"BUTTON", L"浏览...", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, 492, 125, 84, 30, hWnd, (HMENU)ID_BTN_BROWSE, NULL, NULL);
        SendMessageW(g_hBtnBrowse, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        g_hChkDesktop = CreateWindowW(L"BUTTON", L"创建桌面快捷方式 (Desktop Shortcut)", WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX, 32, 175, 420, 24, hWnd, (HMENU)ID_CHK_DESKTOP, NULL, NULL);
        SendMessageW(g_hChkDesktop, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
        SendMessageW(g_hChkDesktop, BM_SETCHECK, BST_CHECKED, 0);

        g_hChkStartMenu = CreateWindowW(L"BUTTON", L"添加到系统开始菜单程序列表 (Start Menu)", WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX, 32, 207, 420, 24, hWnd, (HMENU)ID_CHK_STARTMENU, NULL, NULL);
        SendMessageW(g_hChkStartMenu, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
        SendMessageW(g_hChkStartMenu, BM_SETCHECK, BST_CHECKED, 0);

        g_hChkLaunch = CreateWindowW(L"BUTTON", L"安装完成后立即启动应用程序 (Launch App)", WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX, 32, 239, 420, 24, hWnd, (HMENU)ID_CHK_LAUNCH, NULL, NULL);
        SendMessageW(g_hChkLaunch, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
        SendMessageW(g_hChkLaunch, BM_SETCHECK, BST_CHECKED, 0);

        g_hProgress = CreateWindowW(PROGRESS_CLASSW, L"", WS_CHILD | WS_VISIBLE | PBS_SMOOTH, 32, 280, 544, 16, hWnd, (HMENU)ID_PROGRESS, NULL, NULL);
        SendMessageW(g_hProgress, PBM_SETRANGE, 0, MAKELPARAM(0, 100));

        g_hLblStatus = CreateWindowW(L"STATIC", L"准备就绪，点击“立即安装”开始部署。", WS_CHILD | WS_VISIBLE, 32, 308, 544, 22, hWnd, (HMENU)ID_LBL_STATUS, NULL, NULL);
        SendMessageW(g_hLblStatus, WM_SETFONT, (WPARAM)g_hFontBold, TRUE);

        g_hBtnInstall = CreateWindowW(L"BUTTON", L"立即安装", WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON, 348, 348, 126, 36, hWnd, (HMENU)ID_BTN_INSTALL, NULL, NULL);
        SendMessageW(g_hBtnInstall, WM_SETFONT, (WPARAM)g_hFontBold, TRUE);

        g_hBtnCancel = CreateWindowW(L"BUTTON", L"取消", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, 486, 348, 90, 36, hWnd, (HMENU)ID_BTN_CANCEL, NULL, NULL);
        SendMessageW(g_hBtnCancel, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        break;
    }
    case WM_PAINT: {
        PAINTSTRUCT ps;
        HDC hdc = BeginPaint(hWnd, &ps);

        // 1. 绘制顶部高级暗色品牌横幅 (Header Banner)
        RECT rcHeader = { 0, 0, 610, 80 };
        FillRect(hdc, &rcHeader, g_hBrushHeader);

        // 顶部品牌橙色标识条
        RECT rcAccent = { 0, 77, 610, 80 };
        FillRect(hdc, &rcAccent, g_hBrushBrand);

        SetBkMode(hdc, TRANSPARENT);
        
        // 顶部标题文字
        SelectObject(hdc, g_hFontHeaderTitle);
        SetTextColor(hdc, RGB(255, 255, 255));
        TextOutW(hdc, 28, 16, L"CodeMind Studio 客户端安装向导", 20);

        // 顶部副标题文字
        SelectObject(hdc, g_hFontHeaderSub);
        SetTextColor(hdc, RGB(161, 161, 170));
        TextOutW(hdc, 28, 48, L"Cockpit LLM 生产级流式网关 · AI 协同桌面工作台 (v2.11.0)", 42);

        EndPaint(hWnd, &ps);
        break;
    }
    case WM_CTLCOLORSTATIC: {
        HDC hdcStatic = (HDC)wParam;
        HWND hwndStatic = (HWND)lParam;
        
        SetBkMode(hdcStatic, TRANSPARENT);
        if (hwndStatic == g_hLblStatus) {
            SetTextColor(hdcStatic, RGB(194, 65, 12)); // #C2410C 醒目高对比度深橙色
        } else {
            SetTextColor(hdcStatic, RGB(30, 27, 24));   // #1E1B18 深度清晰正文字色
        }
        return (LRESULT)g_hBrushBg;
    }
    case WM_CTLCOLOREDIT: {
        HDC hdcEdit = (HDC)wParam;
        SetTextColor(hdcEdit, RGB(24, 24, 27));
        SetBkColor(hdcEdit, RGB(255, 255, 255));
        return (LRESULT)g_hBrushCard;
    }
    case WM_COMMAND: {
        int wmId = LOWORD(wParam);
        if (wmId == ID_BTN_BROWSE) {
            BROWSEINFOW bi = { 0 };
            bi.hwndOwner = hWnd;
            bi.lpszTitle = L"请选择 CodeMind Studio 安装目标目录：";
            bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE;
            LPITEMIDLIST pidl = SHBrowseForFolderW(&bi);
            if (pidl) {
                wchar_t szFolder[MAX_PATH];
                if (SHGetPathFromIDListW(pidl, szFolder)) {
                    swprintf(g_InstallDir, MAX_PATH, L"%s\\CodeMind-Studio", szFolder);
                    SetWindowTextW(g_hPathEdit, g_InstallDir);
                }
                CoTaskMemFree(pidl);
            }
        }
        else if (wmId == ID_BTN_INSTALL) {
            if (g_bFinished) {
                // 如果安装完成且勾选了启动，立即拉起应用
                if (SendMessageW(g_hChkLaunch, BM_GETCHECK, 0, 0) == BST_CHECKED) {
                    LaunchInstalledApp();
                }
                DestroyWindow(hWnd);
            }
            else if (!g_bInstalling) {
                g_bInstalling = TRUE;
                EnableWindow(g_hBtnInstall, FALSE);
                EnableWindow(g_hBtnBrowse, FALSE);
                EnableWindow(g_hPathEdit, FALSE);
                CreateThread(NULL, 0, InstallThread, hWnd, 0, NULL);
            }
        }
        else if (wmId == ID_BTN_CANCEL) {
            if (g_bInstalling) {
                if (MessageBoxW(hWnd, L"正在安装中，确定要取消并退出吗？", L"提示", MB_YESNO | MB_ICONQUESTION) == IDYES) {
                    DestroyWindow(hWnd);
                }
            } else {
                DestroyWindow(hWnd);
            }
        }
        break;
    }
    case WM_DESTROY:
        // 如果安装已完成且用户直接关闭窗口，只要勾选了启动同样启动
        if (g_bFinished && SendMessageW(g_hChkLaunch, BM_GETCHECK, 0, 0) == BST_CHECKED) {
            LaunchInstalledApp();
        }
        if (g_hFontHeaderTitle) DeleteObject(g_hFontHeaderTitle);
        if (g_hFontHeaderSub) DeleteObject(g_hFontHeaderSub);
        if (g_hFontBold) DeleteObject(g_hFontBold);
        if (g_hFontNormal) DeleteObject(g_hFontNormal);
        if (g_hFontSmall) DeleteObject(g_hFontSmall);
        if (g_hBrushBg) DeleteObject(g_hBrushBg);
        if (g_hBrushHeader) DeleteObject(g_hBrushHeader);
        if (g_hBrushCard) DeleteObject(g_hBrushCard);
        if (g_hBrushBrand) DeleteObject(g_hBrushBrand);
        PostQuitMessage(0);
        break;
    default:
        return DefWindowProcW(hWnd, msg, wParam, lParam);
    }
    return 0;
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPWSTR lpCmdLine, int nCmdShow) {
    WNDCLASSW wc = { 0 };
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = L"CodeMindStudioInstallerClass";
    wc.hbrBackground = CreateSolidBrush(RGB(248, 246, 243));
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(200));

    RegisterClassW(&wc);

    int w = 618;
    int h = 438;
    int x = (GetSystemMetrics(SM_CXSCREEN) - w) / 2;
    int y = (GetSystemMetrics(SM_CYSCREEN) - h) / 2;

    HWND hWnd = CreateWindowExW(
        WS_EX_DLGMODALFRAME,
        L"CodeMindStudioInstallerClass",
        L"CodeMind Studio v2.11.0 安装向导",
        WS_POPUP | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_VISIBLE,
        x, y, w, h,
        NULL, NULL, hInstance, NULL
    );

    if (!hWnd) return 0;

    ShowWindow(hWnd, nCmdShow);
    UpdateWindow(hWnd);

    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    return (int)msg.wParam;
}
