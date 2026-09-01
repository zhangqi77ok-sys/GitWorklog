import os
import sys
import time
import logging
from datetime import datetime, timedelta

def get_log_dir() -> str:
    if sys.platform == 'win32':
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        log_dir = os.path.join(appdata, 'Tcode', 'logs')
    else:
        log_dir = os.path.join(os.path.expanduser('~'), '.tcode', 'logs')
    
    os.makedirs(log_dir, exist_ok=True)
    return log_dir

LOG_DIR = get_log_dir()
MAIN_LOG_PATH = os.path.join(LOG_DIR, 'tcode_app.log')
ERROR_LOG_PATH = os.path.join(LOG_DIR, 'tcode_error.log')

# Setup standard logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s',
    handlers=[
        logging.FileHandler(MAIN_LOG_PATH, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("TcodeCore")

def log_info(msg: str):
    logger.info(msg)

def log_error(msg: str, exc_info=None):
    logger.error(msg, exc_info=exc_info)
    try:
        with open(ERROR_LOG_PATH, 'a', encoding='utf-8') as f:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            f.write(f"[{timestamp}] [ERROR]: {msg}\n")
            if exc_info:
                import traceback
                f.write(traceback.format_exc() + "\n")
    except Exception as e:
        print(f"Failed writing error log: {e}")

def cleanup_old_logs(max_days: int = 7) -> int:
    """Scans LOG_DIR and deletes log files/archives older than max_days (7 days)."""
    now = time.time()
    cutoff = now - (max_days * 86400)
    cleaned_files = 0
    
    try:
        for fname in os.listdir(LOG_DIR):
            fpath = os.path.join(LOG_DIR, fname)
            if os.path.isfile(fpath):
                mtime = os.path.getmtime(fpath)
                # If modified before 7 days ago and not the active main log, remove it
                if mtime < cutoff:
                    try:
                        os.remove(fpath)
                        cleaned_files += 1
                        logger.info(f"Cleaned up 7-day old log file: {fname}")
                    except Exception as e:
                        logger.warning(f"Could not remove old log file {fname}: {e}")
        
        # Also truncate main log lines older than 7 days
        _rotate_and_truncate_log(MAIN_LOG_PATH, max_days)
        _rotate_and_truncate_log(ERROR_LOG_PATH, max_days)
    except Exception as e:
        logger.error(f"Error during log cleanup: {e}")
        
    return cleaned_files

def _rotate_and_truncate_log(file_path: str, max_days: int = 7):
    if not os.path.exists(file_path):
        return
    try:
        cutoff_date = datetime.now() - timedelta(days=max_days)
        cutoff_str = cutoff_date.strftime('%Y-%m-%d')
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            
        recent_lines = []
        for line in lines:
            # Check line date prefix [YYYY-MM-DD
            if line.startswith('[') and len(line) > 11:
                date_part = line[1:11]
                if date_part < cutoff_str:
                    continue
            recent_lines.append(line)
            
        if len(recent_lines) < len(lines):
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(recent_lines)
            logger.info(f"Truncated {len(lines) - len(recent_lines)} lines older than 7 days from {os.path.basename(file_path)}")
    except Exception as e:
        logger.warning(f"Log truncation failed for {file_path}: {e}")

def get_recent_logs(max_lines: int = 300) -> str:
    """Reads and returns recent logs from MAIN_LOG_PATH and ERROR_LOG_PATH."""
    out = []
    out.append(f"=== Tcode System Log (Log Dir: {LOG_DIR}) ===")
    out.append(f"=== Auto-Cleanup Task: Keeps logs from last 7 days ===\n")
    
    if os.path.exists(ERROR_LOG_PATH):
        out.append("--- Recent Error Logs (tcode_error.log) ---")
        try:
            with open(ERROR_LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
                err_lines = f.readlines()[-150:]
                out.extend([l.rstrip() for l in err_lines])
        except Exception as e:
            out.append(f"Failed reading error log: {e}")
        out.append("\n")
        
    if os.path.exists(MAIN_LOG_PATH):
        out.append("--- Recent Main Logs (tcode_app.log) ---")
        try:
            with open(MAIN_LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
                main_lines = f.readlines()[-200:]
                out.extend([l.rstrip() for l in main_lines])
        except Exception as e:
            out.append(f"Failed reading main log: {e}")
            
    return "\n".join(out)
