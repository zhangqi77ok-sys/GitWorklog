# -*- coding: utf-8 -*-
"""
CodeMind-Hub 独立桌面安装向导 (Setup Wizard)
支持 GUI 可视化安装与命令行静默无人值守安装 (/S, --silent)
"""
import os
import sys
import time
import zipfile
import threading
import subprocess
from pathlib import Path

DEFAULT_INSTALL_DIR = os.path.join(
    os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
    "Programs",
    "CodeMind-Studio"
)

def get_payload_zip_path():
    if getattr(sys, "frozen", False):
        base_dir = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    
    candidates = [
        os.path.join(base_dir, "app_payload.zip"),
        os.path.join(os.path.dirname(sys.executable if getattr(sys, "frozen", False) else __file__), "app_payload.zip"),
        os.path.join(os.getcwd(), "app_payload.zip"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def create_shortcut(target_exe, shortcut_path, icon_path=None, description="CodeMind-Hub AI Programming IDE"):
    try:
        lines = [
            '$WshShell = New-Object -ComObject WScript.Shell',
            f'$Shortcut = $WshShell.CreateShortcut("{shortcut_path}")',
            f'$Shortcut.TargetPath = "{target_exe}"',
            f'$Shortcut.WorkingDirectory = "{os.path.dirname(target_exe)}"',
            f'$Shortcut.Description = "{description}"',
        ]
        if icon_path and os.path.exists(icon_path):
            lines.append(f'$Shortcut.IconLocation = "{icon_path},0"')
        lines.append('$Shortcut.Save()')
        ps_script = "; ".join(lines)
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], check=True, creationflags=0x08000000)
        return True
    except Exception as e:
        print(f"Warning creating shortcut {shortcut_path}: {e}")
        return False

def do_install(install_dir, create_desktop_lnk=True, progress_callback=None):
    zip_path = get_payload_zip_path()
    if not zip_path or not os.path.exists(zip_path):
        raise FileNotFoundError(f"未找到安装包载荷 app_payload.zip (搜索路径: {zip_path})")

    os.makedirs(install_dir, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as zf:
        members = zf.infolist()
        total = len(members)
        for i, member in enumerate(members):
            zf.extract(member, install_dir)
            if progress_callback:
                progress_callback(int((i + 1) / total * 100), member.filename)

    target_exe = os.path.join(install_dir, "CodeMind-Studio.exe")
    icon_path = os.path.join(install_dir, "src-tauri", "icons", "icon.ico")
    if not os.path.exists(icon_path):
        icon_path = os.path.join(install_dir, "app.ico")

    if create_desktop_lnk:
        desktop_dir = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")), "Desktop")
        if os.path.exists(desktop_dir):
            lnk_path = os.path.join(desktop_dir, "CodeMind-Hub.lnk")
            create_shortcut(target_exe, lnk_path, icon_path)

        programs_dir = os.path.join(
            os.environ.get("APPDATA", os.path.expanduser("~")),
            "Microsoft", "Windows", "Start Menu", "Programs"
        )
        if os.path.exists(programs_dir):
            lnk_path = os.path.join(programs_dir, "CodeMind-Hub.lnk")
            create_shortcut(target_exe, lnk_path, icon_path)

    return target_exe

def run_silent(install_dir=None, launch_after=False):
    dest = install_dir or DEFAULT_INSTALL_DIR
    print(f"[Silent Setup] 正在安装 CodeMind-Hub 到: {dest}")
    exe_path = do_install(dest, create_desktop_lnk=True)
    print(f"[Silent Setup] 安装成功完成！执行程序路径: {exe_path}")
    if launch_after and os.path.exists(exe_path):
        print(f"[Silent Setup] 正在启动应用: {exe_path}")
        subprocess.Popen([exe_path], cwd=dest)
    return 0

def run_gui():
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox

    root = tk.Tk()
    root.title("CodeMind-Hub · 桌面端安装向导 (v0.10.0)")
    root.geometry("620x460")
    root.resizable(False, False)

    BG_COLOR = "#FAF8F5"
    SURFACE_COLOR = "#F4EFEA"
    PRIMARY_COLOR = "#D96B27"
    TEXT_MAIN = "#1E1B18"
    TEXT_MUTED = "#645E57"
    BORDER_COLOR = "#E5DFD8"

    root.configure(bg=BG_COLOR)

    try:
        icon_cand = os.path.join(os.path.dirname(__file__), "src-tauri", "icons", "icon.ico")
        if os.path.exists(icon_cand):
            root.iconbitmap(icon_cand)
    except Exception:
        pass

    header_frame = tk.Frame(root, bg=SURFACE_COLOR, height=85)
    header_frame.pack(fill=tk.X, side=tk.TOP)
    header_frame.pack_propagate(False)

    title_label = tk.Label(
        header_frame,
        text="CodeMind-Hub 安装向导",
        font=("Segoe UI", 15, "bold"),
        bg=SURFACE_COLOR,
        fg=TEXT_MAIN,
    )
    title_label.pack(anchor="w", padx=25, pady=(15, 2))

    subtitle_label = tk.Label(
        header_frame,
        text="企业级极简暖色 AI 编程结对工作台 (Cursor-Alternative Native IDE)",
        font=("Segoe UI", 9),
        bg=SURFACE_COLOR,
        fg=TEXT_MUTED,
    )
    subtitle_label.pack(anchor="w", padx=25)

    sep = tk.Frame(root, bg=BORDER_COLOR, height=1)
    sep.pack(fill=tk.X)

    content_frame = tk.Frame(root, bg=BG_COLOR, padx=30, pady=20)
    content_frame.pack(fill=tk.BOTH, expand=True)

    desc_label = tk.Label(
        content_frame,
        text="欢迎使用 CodeMind-Hub！该向导将引导您将工作台完整安装到计算机中。\n包含 GatewayBus 模型总线、Plan/Act 掌控型双模式与 Git 检查点自愈闭环。",
        font=("Segoe UI", 9),
        bg=BG_COLOR,
        fg=TEXT_MAIN,
        justify=tk.LEFT,
    )
    desc_label.pack(anchor="w", pady=(0, 20))

    path_label = tk.Label(content_frame, text="目标安装路径：", font=("Segoe UI", 9, "bold"), bg=BG_COLOR, fg=TEXT_MAIN)
    path_label.pack(anchor="w")

    path_frame = tk.Frame(content_frame, bg=BG_COLOR)
    path_frame.pack(fill=tk.X, pady=(5, 15))

    path_var = tk.StringVar(value=DEFAULT_INSTALL_DIR)
    path_entry = tk.Entry(
        path_frame,
        textvariable=path_var,
        font=("Consolas", 9),
        bg="#FFFFFF",
        fg=TEXT_MAIN,
        relief=tk.SOLID,
        bd=1,
    )
    path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4)

    def choose_dir():
        chosen = filedialog.askdirectory(initialdir=path_var.get())
        if chosen:
            path_var.set(os.path.join(chosen, "CodeMind-Studio"))

    browse_btn = tk.Button(
        path_frame,
        text="浏览...",
        font=("Segoe UI", 9),
        bg=SURFACE_COLOR,
        fg=TEXT_MAIN,
        relief=tk.SOLID,
        bd=1,
        padx=10,
        cursor="hand2",
        command=choose_dir,
    )
    browse_btn.pack(side=tk.RIGHT, padx=(8, 0))

    chk_desktop_var = tk.BooleanVar(value=True)
    chk_desktop = tk.Checkbutton(
        content_frame,
        text="在桌面创建快捷方式 (CodeMind-Hub.lnk)",
        variable=chk_desktop_var,
        font=("Segoe UI", 9),
        bg=BG_COLOR,
        fg=TEXT_MAIN,
        activebackground=BG_COLOR,
    )
    chk_desktop.pack(anchor="w", pady=(0, 15))

    progress_var = tk.IntVar(value=0)
    status_label = tk.Label(content_frame, text="准备就绪，点击下方按钮开始安装...", font=("Segoe UI", 9), bg=BG_COLOR, fg=TEXT_MUTED)
    status_label.pack(anchor="w", pady=(0, 4))

    style = ttk.Style()
    style.theme_use("clam")
    style.configure("Horizontal.TProgressbar", foreground=PRIMARY_COLOR, background=PRIMARY_COLOR, troughcolor="#E5DFD8", bordercolor="#E5DFD8")

    prog_bar = ttk.Progressbar(content_frame, orient="horizontal", length=100, mode="determinate", variable=progress_var, style="Horizontal.TProgressbar")
    prog_bar.pack(fill=tk.X, pady=(0, 10))

    sep2 = tk.Frame(root, bg=BORDER_COLOR, height=1)
    sep2.pack(fill=tk.X, side=tk.BOTTOM)

    bottom_frame = tk.Frame(root, bg=SURFACE_COLOR, height=55)
    bottom_frame.pack(fill=tk.X, side=tk.BOTTOM)
    bottom_frame.pack_propagate(False)

    install_btn = None
    cancel_btn = None

    def start_installation():
        install_btn.config(state=tk.DISABLED)
        browse_btn.config(state=tk.DISABLED)
        path_entry.config(state=tk.DISABLED)
        chk_desktop.config(state=tk.DISABLED)

        dest_dir = path_var.get().strip()

        def worker():
            try:
                def on_prog(pct, current_file):
                    progress_var.set(pct)
                    status_label.config(text=f"正在解压 ({pct}%): {os.path.basename(current_file)}")

                exe_path = do_install(dest_dir, chk_desktop_var.get(), on_prog)
                progress_var.set(100)
                status_label.config(text="✔ 安装已成功完成！准备就绪。", fg="#059669")

                def on_done():
                    res = messagebox.askyesno("安装完成", "CodeMind-Hub 已成功安装！\n\n是否立即启动应用程序？")
                    if res and os.path.exists(exe_path):
                        subprocess.Popen([exe_path], cwd=dest_dir)
                    root.destroy()

                root.after(200, on_done)
            except Exception as ex:
                messagebox.showerror("安装错误", f"安装过程发生异常：\n{ex}")
                install_btn.config(state=tk.NORMAL)
                browse_btn.config(state=tk.NORMAL)
                path_entry.config(state=tk.NORMAL)
                chk_desktop.config(state=tk.NORMAL)
                status_label.config(text=f"❌ 安装失败: {ex}", fg="#DC2626")

        threading.Thread(target=worker, daemon=True).start()

    install_btn = tk.Button(
        bottom_frame,
        text="立即安装",
        font=("Segoe UI", 9, "bold"),
        bg=PRIMARY_COLOR,
        fg="#FFFFFF",
        activebackground="#C2410C",
        activeforeground="#FFFFFF",
        relief=tk.FLAT,
        padx=18,
        pady=6,
        cursor="hand2",
        command=start_installation,
    )
    install_btn.pack(side=tk.RIGHT, padx=(0, 25), pady=12)

    cancel_btn = tk.Button(
        bottom_frame,
        text="取消",
        font=("Segoe UI", 9),
        bg=SURFACE_COLOR,
        fg=TEXT_MUTED,
        relief=tk.SOLID,
        bd=1,
        padx=14,
        pady=5,
        cursor="hand2",
        command=root.destroy,
    )
    cancel_btn.pack(side=tk.RIGHT, padx=(0, 10), pady=12)

    root.mainloop()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].lower() in ["/s", "--silent", "-s"]:
        target_dir = None
        launch = "--run" in sys.argv or "-r" in sys.argv
        for i, arg in enumerate(sys.argv):
            if arg.startswith("/D="):
                target_dir = arg[3:]
            elif arg in ["--dir", "-d"] and i + 1 < len(sys.argv):
                target_dir = sys.argv[i + 1]
        run_silent(target_dir, launch_after=launch)
    else:
        run_gui()
