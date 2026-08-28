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

#define ID_BTN_BROWSE    101
#define ID_BTN_INSTALL   102
#define ID_BTN_CANCEL    103
#define ID_CHK_DESKTOP   104
#define ID_CHK_STARTMENU 105
#define ID_CHK_LAUNCH    106
#define ID_EDIT_PATH     107
#define ID_PROGRESS      108
#define ID_LBL_STATUS    109

static HWND g_hPathEdit;
static HWND g_hBtnBrowse;
static HWND g_hBtnInstall;
static HWND g_hBtnCancel;
static HWND g_hChkDesktop;
static HWND g_hChkStartMenu;
static HWND g_hChkLaunch;
static HWND g_hProgress;
static HWND g_hLblStatus;
static HFONT g_hFontTitle;
static HFONT g_hFontNormal;

static BOOL g_bInstalling = FALSE;
static BOOL g_bFinished = FALSE;
static wchar_t g_InstallDir[MAX_PATH];

static void SetStatusText(const wchar_t* text) {
    SetWindowTextW(g_hLblStatus, text);
}

// 使用 Windows Shell COM 接口创建原生 .lnk 快捷方式
static HRESULT CreateLink(LPCWSTR lpszPathObj, LPCWSTR lpszPathLink, LPCWSTR lpszWorkingDir, LPCWSTR lpszIconPath) {
    HRESULT hres;
    IShellLinkW* psl;

    hres = CoCreateInstance(&CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, &IID_IShellLinkW, (LPVOID*)&psl);
    if (SUCCEEDED(hres)) {
        IPersistFile* ppf;

        psl->lpVtbl->SetPath(psl, lpszPathObj);
        if (lpszWorkingDir) psl->lpVtbl->SetWorkingDirectory(psl, lpszWorkingDir);
        if (lpszIconPath) psl->lpVtbl->SetIconLocation(psl, lpszIconPath, 0);

        hres = psl->lpVtbl->QueryInterface(psl, &IID_IPersistFile, (LPVOID*)&ppf);
        if (SUCCEEDED(hres)) {
            hres = ppf->lpVtbl->Save(ppf, lpszPathLink, TRUE);
            ppf->lpVtbl->Release(ppf);
        }
        psl->lpVtbl->Release(psl);
    }
    return hres;
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

    SetStatusText(L"正在准备安装目录...");
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
    SetStatusText(L"正在注册应用信息...");
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
    SetStatusText(L"🎉 安装完成！CodeMind Studio 已就绪。");

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
        INITCOMMONCONTROLSEX icex;
        icex.dwSize = sizeof(INITCOMMONCONTROLSEX);
        icex.dwICC = ICC_PROGRESS_CLASS | ICC_STANDARD_CLASSES;
        InitCommonControlsEx(&icex);

        g_hFontTitle = CreateFontW(22, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, L"Microsoft YaHei");
        g_hFontNormal = CreateFontW(14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_SWISS, L"Microsoft YaHei");

        // 默认安装路径
        wchar_t localApp[MAX_PATH];
        wchar_t defPath[MAX_PATH];
        GetEnvironmentVariableW(L"LOCALAPPDATA", localApp, MAX_PATH);
        swprintf(defPath, MAX_PATH, L"%s\\Programs\\CodeMind-Studio", localApp);

        // 控件创建
        HWND hTitle = CreateWindowW(L"STATIC", L"CodeMind Studio 客户端安装向导", WS_CHILD | WS_VISIBLE, 28, 20, 480, 30, hWnd, NULL, NULL, NULL);
        SendMessageW(hTitle, WM_SETFONT, (WPARAM)g_hFontTitle, TRUE);

        HWND hSub = CreateWindowW(L"STATIC", L"欢迎安装 CodeMind Studio · Cockpit LLM 网关与 AI 协作桌面工作台", WS_CHILD | WS_VISIBLE, 28, 55, 520, 20, hWnd, NULL, NULL, NULL);
        SendMessageW(hSub, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        HWND hLblPath = CreateWindowW(L"STATIC", L"安装目标文件夹：", WS_CHILD | WS_VISIBLE, 28, 95, 200, 20, hWnd, NULL, NULL, NULL);
        SendMessageW(hLblPath, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        g_hPathEdit = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", defPath, WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL, 28, 120, 430, 26, hWnd, (HMENU)ID_EDIT_PATH, NULL, NULL);
        SendMessageW(g_hPathEdit, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        g_hBtnBrowse = CreateWindowW(L"BUTTON", L"浏览...", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, 468, 119, 80, 28, hWnd, (HMENU)ID_BTN_BROWSE, NULL, NULL);
        SendMessageW(g_hBtnBrowse, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        g_hChkDesktop = CreateWindowW(L"BUTTON", L"创建桌面快捷方式 (Desktop Shortcut)", WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX, 28, 165, 380, 22, hWnd, (HMENU)ID_CHK_DESKTOP, NULL, NULL);
        SendMessageW(g_hChkDesktop, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
        SendMessageW(g_hChkDesktop, BM_SETCHECK, BST_CHECKED, 0);

        g_hChkStartMenu = CreateWindowW(L"BUTTON", L"添加到系统开始菜单程序列表", WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX, 28, 195, 380, 22, hWnd, (HMENU)ID_CHK_STARTMENU, NULL, NULL);
        SendMessageW(g_hChkStartMenu, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
        SendMessageW(g_hChkStartMenu, BM_SETCHECK, BST_CHECKED, 0);

        g_hChkLaunch = CreateWindowW(L"BUTTON", L"安装完成后立即启动应用程序", WS_CHILD | WS_VISIBLE | BS_AUTOCHECKBOX, 28, 225, 380, 22, hWnd, (HMENU)ID_CHK_LAUNCH, NULL, NULL);
        SendMessageW(g_hChkLaunch, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);
        SendMessageW(g_hChkLaunch, BM_SETCHECK, BST_CHECKED, 0);

        g_hProgress = CreateWindowW(PROGRESS_CLASSW, L"", WS_CHILD | WS_VISIBLE | PBS_SMOOTH, 28, 265, 520, 16, hWnd, (HMENU)ID_PROGRESS, NULL, NULL);
        SendMessageW(g_hProgress, PBM_SETRANGE, 0, MAKELPARAM(0, 100));

        g_hLblStatus = CreateWindowW(L"STATIC", L"准备就绪，点击“一键安装”开始安装。", WS_CHILD | WS_VISIBLE, 28, 290, 520, 20, hWnd, (HMENU)ID_LBL_STATUS, NULL, NULL);
        SendMessageW(g_hLblStatus, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        g_hBtnInstall = CreateWindowW(L"BUTTON", L"一键安装", WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON, 340, 325, 110, 32, hWnd, (HMENU)ID_BTN_INSTALL, NULL, NULL);
        SendMessageW(g_hBtnInstall, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        g_hBtnCancel = CreateWindowW(L"BUTTON", L"取消", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON, 460, 325, 88, 32, hWnd, (HMENU)ID_BTN_CANCEL, NULL, NULL);
        SendMessageW(g_hBtnCancel, WM_SETFONT, (WPARAM)g_hFontNormal, TRUE);

        break;
    }
    case WM_COMMAND: {
        int wmId = LOWORD(wParam);
        if (wmId == ID_BTN_BROWSE) {
            BROWSEINFOW bi = { 0 };
            bi.hwndOwner = hWnd;
            bi.lpszTitle = L"请选择 CodeMind Studio 安装目录：";
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
                if (SendMessageW(g_hChkLaunch, BM_GETCHECK, 0, 0) == BST_CHECKED) {
                    wchar_t targetExe[MAX_PATH];
                    swprintf(targetExe, MAX_PATH, L"%s\\CodeMind-Studio.exe", g_InstallDir);
                    ShellExecuteW(NULL, L"open", targetExe, NULL, g_InstallDir, SW_SHOWNORMAL);
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
        if (g_hFontTitle) DeleteObject(g_hFontTitle);
        if (g_hFontNormal) DeleteObject(g_hFontNormal);
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
    wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(200));

    RegisterClassW(&wc);

    int w = 588;
    int h = 415;
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
