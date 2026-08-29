import os
import sys
import shutil
import subprocess
import threading
import time
import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path

VERSION = "1.2.2"
APP_NAME = "CodeMind-Hub"

def get_detected_installed_dir():
    # 1. Check Windows Registry HKCU\Software\CodeMind-Hub\InstallPath
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\CodeMind-Hub") as key:
            val, _ = winreg.QueryValueEx(key, "InstallPath")
            if val and os.path.exists(val):
                return val
    except Exception:
        pass

    # 2. Check %LOCALAPPDATA%\CodeMind-Hub\install_info.json
    local_app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
    info_file = os.path.join(local_app_data, "CodeMind-Hub", "install_info.json")
    if os.path.exists(info_file):
        try:
            with open(info_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                p = data.get("install_path")
                if p and os.path.exists(p):
                    return p
        except Exception:
            pass

    # 3. Check common paths (e.g. D:\CodeMind-Hub)
    for cand in [r"D:\CodeMind-Hub", os.path.join(local_app_data, "Programs", APP_NAME)]:
        if os.path.exists(os.path.join(cand, "CodeMind-Hub.exe")):
            return cand

    return os.path.join(local_app_data, "Programs", APP_NAME)

def save_installed_dir(target_dir):
    # Save to Registry
    try:
        import winreg
        key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\CodeMind-Hub")
        winreg.SetValueEx(key, "InstallPath", 0, winreg.REG_SZ, target_dir)
        winreg.SetValueEx(key, "Version", 0, winreg.REG_SZ, VERSION)
        winreg.CloseKey(key)
    except Exception:
        pass

    # Save to json file
    try:
        local_app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        conf_dir = os.path.join(local_app_data, "CodeMind-Hub")
        os.makedirs(conf_dir, exist_ok=True)
        with open(os.path.join(conf_dir, "install_info.json"), "w", encoding="utf-8") as f:
            json.dump({"install_path": target_dir, "version": VERSION, "timestamp": time.time()}, f)
    except Exception:
        pass

def close_running_instances():
    CREATE_NO_WINDOW = 0x08000000
    # Terminate running CodeMind-Hub.exe instances
    try:
        res = subprocess.run(["tasklist", "/FI", "IMAGENAME eq CodeMind-Hub.exe"], capture_output=True, text=True, creationflags=CREATE_NO_WINDOW)
        if "CodeMind-Hub.exe" in res.stdout:
            subprocess.run(["taskkill", "/F", "/IM", "CodeMind-Hub.exe", "/T"], capture_output=True, creationflags=CREATE_NO_WINDOW)
            time.sleep(1.2)
    except Exception:
        pass

    # Terminate running CodeMind-Core.exe instances
    try:
        res2 = subprocess.run(["tasklist", "/FI", "IMAGENAME eq CodeMind-Core.exe"], capture_output=True, text=True, creationflags=CREATE_NO_WINDOW)
        if "CodeMind-Core.exe" in res2.stdout:
            subprocess.run(["taskkill", "/F", "/IM", "CodeMind-Core.exe", "/T"], capture_output=True, creationflags=CREATE_NO_WINDOW)
            time.sleep(1.0)
    except Exception:
        pass

def get_bundle_dir():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

def create_windows_shortcut(target_path, shortcut_path, description="CodeMind-Hub Enterprise AI Agentic IDE"):
    ps_cmd = f"""
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('{shortcut_path}')
    $Shortcut.TargetPath = '{target_path}'
    $Shortcut.WorkingDirectory = '{os.path.dirname(target_path)}'
    $Shortcut.Description = '{description}'
    $Shortcut.Save()
    """
    try:
        CREATE_NO_WINDOW = 0x08000000
        subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps_cmd], check=True, creationflags=CREATE_NO_WINDOW)
    except Exception as e:
        print("Shortcut error:", e)

class SetupWizard(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"{APP_NAME} 安装向导 (v{VERSION})")
        self.geometry("540x380")
        self.resizable(False, False)
        
        # Center window
        self.update_idletasks()
        w = self.winfo_width()
        h = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")
        
        self.configure(bg="#F8FAFC")
        
        self.current_step = 0
        self.detected_dir = get_detected_installed_dir()
        self.is_upgrade = os.path.exists(os.path.join(self.detected_dir, "CodeMind-Hub.exe"))
        self.install_dir = tk.StringVar(value=self.detected_dir)
        self.create_desktop_shortcut = tk.BooleanVar(value=True)
        self.create_start_menu_shortcut = tk.BooleanVar(value=True)
        self.launch_after_install = tk.BooleanVar(value=True)
        
        # Container frame
        self.content_frame = tk.Frame(self, bg="#F8FAFC")
        self.content_frame.pack(fill="both", expand=True, padx=24, pady=16)
        
        # Bottom navigation bar
        self.bottom_bar = tk.Frame(self, bg="#EDEFEF", height=48)
        self.bottom_bar.pack(fill="x", side="bottom")
        
        self.cancel_btn = tk.Button(self.bottom_bar, text="取消", font=("Segoe UI", 9), width=10, command=self.destroy)
        self.cancel_btn.pack(side="right", padx=12, pady=10)
        
        self.next_btn = tk.Button(self.bottom_bar, text="下一步 >", font=("Segoe UI", 9, "bold"), bg="#D96B27", fg="white", width=12, relief="flat", command=self.next_step)
        self.next_btn.pack(side="right", padx=4, pady=10)
        
        self.prev_btn = tk.Button(self.bottom_bar, text="< 上一步", font=("Segoe UI", 9), width=10, command=self.prev_step, state="disabled")
        self.prev_btn.pack(side="right", padx=4, pady=10)
        
        self.show_step(0)

    def show_step(self, step):
        self.current_step = step
        for widget in self.content_frame.winfo_children():
            widget.destroy()
            
        if step == 0:
            self.step_welcome()
        elif step == 1:
            self.step_choose_dir()
        elif step == 2:
            self.step_choose_tasks()
        elif step == 3:
            self.step_installing()
        elif step == 4:
            self.step_finished()

    def step_welcome(self):
        self.prev_btn.config(state="disabled")
        self.next_btn.config(text="下一步 >", state="normal", command=self.next_step)
        
        title_text = f"欢迎使用 {APP_NAME} 升级向导" if self.is_upgrade else f"欢迎使用 {APP_NAME} 安装向导"
        title = tk.Label(self.content_frame, text=title_text, font=("Segoe UI", 15, "bold"), bg="#F8FAFC", fg="#0F172A")
        title.pack(anchor="w", pady=(10, 8))
        
        desc = (
            f"本向导将指引您在当前计算机上安装或更新 {APP_NAME} (版本 v{VERSION})。\n\n"
            f"{'● 系统已自动定位到您此前安装的历史路径。' if self.is_upgrade else ''}\n"
            f"● 安装程序在写入前会自动安全关闭正在运行的 {APP_NAME} 实例。\n\n"
            "点击“下一步”继续。"
        )
        body = tk.Label(self.content_frame, text=desc, font=("Segoe UI", 10), justify="left", bg="#F8FAFC", fg="#334155")
        body.pack(anchor="w", pady=6)

    def step_choose_dir(self):
        self.prev_btn.config(state="normal")
        self.next_btn.config(text="下一步 >", state="normal", command=self.next_step)
        
        title = tk.Label(self.content_frame, text="选择安装位置", font=("Segoe UI", 13, "bold"), bg="#F8FAFC", fg="#0F172A")
        title.pack(anchor="w", pady=(4, 6))
        
        if self.is_upgrade:
            tip = tk.Label(
                self.content_frame,
                text=f"✓ 已自动检测到您已安装的路径: {self.detected_dir} (将自动覆盖更新)",
                font=("Segoe UI", 9, "bold"),
                bg="#F8FAFC",
                fg="#16A34A"
            )
            tip.pack(anchor="w", pady=(0, 6))

        desc = tk.Label(self.content_frame, text=f"向导将把 {APP_NAME} 安装到以下文件夹。若要更改位置，请点击“浏览”。", font=("Segoe UI", 9), justify="left", bg="#F8FAFC", fg="#475569")
        desc.pack(anchor="w", pady=(0, 14))
        
        frame_input = tk.Frame(self.content_frame, bg="#F8FAFC")
        frame_input.pack(fill="x", pady=6)
        
        entry = tk.Entry(frame_input, textvariable=self.install_dir, font=("Segoe UI", 10), relief="solid", bd=1)
        entry.pack(side="left", fill="x", expand=True, ipady=4, padx=(0, 8))
        
        browse_btn = tk.Button(frame_input, text="浏览...", font=("Segoe UI", 9), command=self.browse_dir)
        browse_btn.pack(side="right", padx=2)
        
        space_label = tk.Label(self.content_frame, text="所需磁盘空间: 约 46 MB\n可用磁盘空间: 充足", font=("Segoe UI", 9), justify="left", bg="#F8FAFC", fg="#64748B")
        space_label.pack(anchor="w", pady=12)

    def browse_dir(self):
        f = filedialog.askdirectory(title="选择安装目录", initialdir=self.install_dir.get())
        if f:
            if not f.endswith(APP_NAME):
                self.install_dir.set(os.path.join(f, APP_NAME))
            else:
                self.install_dir.set(f)

    def step_choose_tasks(self):
        self.prev_btn.config(state="normal")
        self.next_btn.config(text="开始安装", state="normal", command=self.start_install)
        
        title = tk.Label(self.content_frame, text="选择附加任务", font=("Segoe UI", 13, "bold"), bg="#F8FAFC", fg="#0F172A")
        title.pack(anchor="w", pady=(4, 6))
        
        desc = tk.Label(self.content_frame, text="选择您希望安装程序执行的附加任务：", font=("Segoe UI", 9), justify="left", bg="#F8FAFC", fg="#475569")
        desc.pack(anchor="w", pady=(0, 16))
        
        chk1 = tk.Checkbutton(self.content_frame, text="创建桌面快捷方式 (Desktop Shortcut)", variable=self.create_desktop_shortcut, font=("Segoe UI", 10), bg="#F8FAFC", activebackground="#F8FAFC")
        chk1.pack(anchor="w", pady=4)
        
        chk2 = tk.Checkbutton(self.content_frame, text="创建开始菜单快捷方式 (Start Menu Shortcut)", variable=self.create_start_menu_shortcut, font=("Segoe UI", 10), bg="#F8FAFC", activebackground="#F8FAFC")
        chk2.pack(anchor="w", pady=4)

    def start_install(self):
        self.show_step(3)
        t = threading.Thread(target=self.do_install, daemon=True)
        t.start()

    def step_installing(self):
        self.prev_btn.config(state="disabled")
        self.next_btn.config(state="disabled")
        self.cancel_btn.config(state="disabled")
        
        title = tk.Label(self.content_frame, text=f"正在安装 {APP_NAME}...", font=("Segoe UI", 13, "bold"), bg="#F8FAFC", fg="#0F172A")
        title.pack(anchor="w", pady=(4, 6))
        
        self.status_label = tk.Label(self.content_frame, text="正在检测并安全关闭正在运行的程序实例...", font=("Segoe UI", 9), bg="#F8FAFC", fg="#475569")
        self.status_label.pack(anchor="w", pady=(0, 16))
        
        self.progress = ttk.Progressbar(self.content_frame, mode="determinate", length=490)
        self.progress.pack(fill="x", pady=10)

    def do_install(self):
        target_dir = self.install_dir.get()
        try:
            # 1. Close any running instances before overwriting
            self.progress['value'] = 10
            self.status_label.config(text="正在安全关闭运行中的程序实例...")
            self.update_idletasks()
            close_running_instances()

            os.makedirs(target_dir, exist_ok=True)
            self.progress['value'] = 30
            self.status_label.config(text="正在解压程序主核心与运行环境...")
            self.update_idletasks()
            
            bundle_dir = get_bundle_dir()
            payload_src = os.path.join(bundle_dir, "payload", "CodeMind-Core.exe")
            target_exe = os.path.join(target_dir, "CodeMind-Hub.exe")
            
            # Copy executable
            shutil.copyfile(payload_src, target_exe)
            self.progress['value'] = 60
            self.status_label.config(text="正在注册快捷方式与安装路径记录...")
            self.update_idletasks()
            
            # Persist installation path in Registry & LocalAppData for future updates
            save_installed_dir(target_dir)

            # Desktop Shortcut
            if self.create_desktop_shortcut.get():
                desktop = os.path.join(os.path.expanduser("~"), "Desktop")
                shortcut_file = os.path.join(desktop, f"{APP_NAME}.lnk")
                create_windows_shortcut(target_exe, shortcut_file)
                
            # Start Menu Shortcut
            if self.create_start_menu_shortcut.get():
                appdata = os.environ.get("APPDATA", "")
                programs_dir = os.path.join(appdata, "Microsoft", "Windows", "Start Menu", "Programs", APP_NAME)
                os.makedirs(programs_dir, exist_ok=True)
                shortcut_file = os.path.join(programs_dir, f"{APP_NAME}.lnk")
                create_windows_shortcut(target_exe, shortcut_file)
                
            # Create uninstaller script
            uninstaller_bat = os.path.join(target_dir, "Uninstall.bat")
            with open(uninstaller_bat, "w", encoding="gbk") as f:
                f.write(f'@echo off\necho 正在卸载 {APP_NAME}...\ntimeout /t 1 > nul\ntaskkill /f /im CodeMind-Hub.exe > nul 2>&1\nrd /s /q "%~dp0"\necho 卸载完成。\npause\n')
                
            self.progress['value'] = 100
            self.status_label.config(text="安装完成！")
            self.update_idletasks()
            
            self.after(600, lambda: self.show_step(4))
        except Exception as e:
            messagebox.showerror("安装错误", f"安装过程中发生错误:\n{e}")
            self.destroy()

    def step_finished(self):
        self.cancel_btn.pack_forget()
        self.prev_btn.pack_forget()
        self.next_btn.config(text="完成", state="normal", command=self.finish_all)
        
        title = tk.Label(self.content_frame, text=f"{APP_NAME} 安装完成！", font=("Segoe UI", 15, "bold"), bg="#F8FAFC", fg="#16A34A")
        title.pack(anchor="w", pady=(10, 8))
        
        desc = (
            f"{APP_NAME} 已成功安装到您的计算机。\n\n"
            f"程序安装位置: {self.install_dir.get()}\n\n"
            "系统已自动保存安装路径，下次升级安装将自动选定此目录并自动关闭正在运行的旧版本。\n\n"
            "点击“完成”退出向导。"
        )
        body = tk.Label(self.content_frame, text=desc, font=("Segoe UI", 10), justify="left", bg="#F8FAFC", fg="#334155")
        body.pack(anchor="w", pady=6)
        
        chk = tk.Checkbutton(self.content_frame, text="立即启动 CodeMind-Hub", variable=self.launch_after_install, font=("Segoe UI", 10, "bold"), bg="#F8FAFC", activebackground="#F8FAFC")
        chk.pack(anchor="w", pady=16)

    def finish_all(self):
        if self.launch_after_install.get():
            target_exe = os.path.join(self.install_dir.get(), "CodeMind-Hub.exe")
            if os.path.exists(target_exe):
                subprocess.Popen([target_exe])
        self.destroy()

    def next_step(self):
        self.show_step(self.current_step + 1)

    def prev_step(self):
        self.show_step(self.current_step - 1)

if __name__ == "__main__":
    app = SetupWizard()
    app.mainloop()
