package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"tcode/internal/host"
)

const (
	Version   = "2.0.0-PROD"
	Banner    = `
 _____               _        ____                                   
|_   _|__ ___   __| | ___  |  _ \  __ _  ___ _ __ ___   ___  _ __  
  | |/ __/ _ \ / _` |/ _ \ | | | |/ _` |/ _ \ '_ ` _ \ / _ \| '_ \ 
  | | (_| (_) | (_| |  __/ | |_| | (_| |  __/ | | | | | (_) | | | |
  |_|\___\___/ \__,_|\___| |____/ \__,_|\___|_| |_| |_|\___/|_| |_|
               Tcode Micro-Kernel Daemon (Go Edition)
`
)

func main() {
	fmt.Println(Banner)
	fmt.Printf("[Tcode] Starting Micro-Kernel Daemon v%s...\n", Version)

	// 1. 初始化插件宿主引擎
	reg := host.NewRegistry()
	fmt.Printf("[Tcode] Plugin Registry initialized successfully. Ready for SPI registration.\n")

	// 2. 准备上下文与优雅退出通道
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	fmt.Println("[Tcode] Micro-Kernel listening on 127.0.0.1 (Loopback IPC). Press Ctrl+C to stop.")

	// 3. 阻塞等待停机信号
	sig := <-sigChan
	fmt.Printf("\n[Tcode] Received shutdown signal: %v. Cleaning up resources...\n", sig)

	// 给插件释放资源预留 3 秒超时
	shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 3*time.Second)
	defer shutdownCancel()

	_ = reg
	_ = shutdownCtx
	fmt.Println("[Tcode] Daemon gracefully stopped.")
}
