package sandbox

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ProjectStackInfo 项目技术栈侦测元数据
type ProjectStackInfo struct {
	PrimaryLanguage string   `json:"primary_language"`
	Framework       string   `json:"framework,omitempty"`
	BuildTool       string   `json:"build_tool,omitempty"`
	TestCommand     string   `json:"test_command,omitempty"`
	ConfigFiles     []string `json:"config_files"`
	Summary         string   `json:"summary"`
}

// DetectProjectStack 自动扫描工作区根目录并识别技术栈特征
func DetectProjectStack(workspace string) ProjectStackInfo {
	info := ProjectStackInfo{
		PrimaryLanguage: "通用/未特定",
		ConfigFiles:     make([]string, 0),
	}

	// 1. 探测 Node / 前端技术栈 (package.json)
	pkgPath := filepath.Join(workspace, "package.json")
	if data, err := os.ReadFile(pkgPath); err == nil {
		info.ConfigFiles = append(info.ConfigFiles, "package.json")
		info.PrimaryLanguage = "TypeScript/JavaScript"
		info.BuildTool = "npm"
		info.TestCommand = "npm test"

		var pkg struct {
			Scripts      map[string]string `json:"scripts"`
			Dependencies map[string]string `json:"dependencies"`
			DevDeps      map[string]string `json:"devDependencies"`
		}
		if err := json.Unmarshal(data, &pkg); err == nil {
			allDeps := make(map[string]bool)
			for k := range pkg.Dependencies {
				allDeps[strings.ToLower(k)] = true
			}
			for k := range pkg.DevDeps {
				allDeps[strings.ToLower(k)] = true
			}

			if allDeps["vue"] {
				info.Framework = "Vue 3"
			} else if allDeps["react"] {
				info.Framework = "React"
			} else if allDeps["svelte"] {
				info.Framework = "Svelte"
			} else if allDeps["next"] {
				info.Framework = "Next.js"
			}

			if allDeps["vite"] {
				info.BuildTool = "vite"
			} else if allDeps["webpack"] {
				info.BuildTool = "webpack"
			}

			if pkg.Scripts != nil {
				if _, ok := pkg.Scripts["test"]; ok {
					info.TestCommand = "npm test"
				} else if _, ok := pkg.Scripts["build"]; ok {
					info.TestCommand = "npm run build"
				}
			}
		}
	}

	// 2. 探测 Rust (Cargo.toml)
	cargoPath := filepath.Join(workspace, "Cargo.toml")
	if _, err := os.Stat(cargoPath); err == nil {
		info.ConfigFiles = append(info.ConfigFiles, "Cargo.toml")
		if info.PrimaryLanguage == "通用/未特定" || info.PrimaryLanguage == "TypeScript/JavaScript" {
			if info.PrimaryLanguage == "TypeScript/JavaScript" {
				info.PrimaryLanguage = "混合技术栈 (Rust + Web)"
			} else {
				info.PrimaryLanguage = "Rust"
			}
		}
		info.BuildTool = "cargo"
		info.TestCommand = "cargo test"
	}

	// 3. 探测 Go (go.mod)
	goModPath := filepath.Join(workspace, "go.mod")
	if _, err := os.Stat(goModPath); err == nil {
		info.ConfigFiles = append(info.ConfigFiles, "go.mod")
		if info.PrimaryLanguage == "通用/未特定" || info.PrimaryLanguage == "TypeScript/JavaScript" {
			if info.PrimaryLanguage == "TypeScript/JavaScript" {
				info.PrimaryLanguage = "混合技术栈 (Go + Web)"
			} else {
				info.PrimaryLanguage = "Go"
			}
		}
		info.BuildTool = "go"
		info.TestCommand = "go test ./..."
	}

	// 4. 探测 Python (pyproject.toml / requirements.txt)
	pyProject := filepath.Join(workspace, "pyproject.toml")
	reqTxt := filepath.Join(workspace, "requirements.txt")
	if _, err := os.Stat(pyProject); err == nil {
		info.ConfigFiles = append(info.ConfigFiles, "pyproject.toml")
		info.PrimaryLanguage = "Python"
		info.BuildTool = "pip/poetry"
		info.TestCommand = "pytest"
	} else if _, err := os.Stat(reqTxt); err == nil {
		info.ConfigFiles = append(info.ConfigFiles, "requirements.txt")
		info.PrimaryLanguage = "Python"
		info.BuildTool = "pip"
		info.TestCommand = "pytest"
	}

	// 5. 探测 Java (pom.xml / build.gradle)
	pomPath := filepath.Join(workspace, "pom.xml")
	gradlePath := filepath.Join(workspace, "build.gradle")
	if _, err := os.Stat(pomPath); err == nil {
		info.ConfigFiles = append(info.ConfigFiles, "pom.xml")
		info.PrimaryLanguage = "Java (Maven)"
		info.BuildTool = "mvn"
		info.TestCommand = "mvn test"
	} else if _, err := os.Stat(gradlePath); err == nil {
		info.ConfigFiles = append(info.ConfigFiles, "build.gradle")
		info.PrimaryLanguage = "Java (Gradle)"
		info.BuildTool = "gradle"
		info.TestCommand = "gradle test"
	}

	// 生成结构化描述摘要
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("主技术栈: %s", info.PrimaryLanguage))
	if info.Framework != "" {
		sb.WriteString(fmt.Sprintf(" (框架: %s)", info.Framework))
	}
	if info.BuildTool != "" {
		sb.WriteString(fmt.Sprintf(", 构建工具: %s", info.BuildTool))
	}
	if info.TestCommand != "" {
		sb.WriteString(fmt.Sprintf(", 推荐验证命令: `%s`", info.TestCommand))
	}
	info.Summary = sb.String()
	return info
}

// FormatStackPrompt 将探测到的技术栈转换为注入提示词的标准环境语块
func FormatStackPrompt(info ProjectStackInfo) string {
	if len(info.ConfigFiles) == 0 {
		return ""
	}
	var sb strings.Builder
	sb.WriteString("\n[工作区技术栈自适应环境感知]\n")
	sb.WriteString(fmt.Sprintf("- 当前项目主语言: %s\n", info.PrimaryLanguage))
	if info.Framework != "" {
		sb.WriteString(fmt.Sprintf("- 架构框架: %s\n", info.Framework))
	}
	if info.BuildTool != "" {
		sb.WriteString(fmt.Sprintf("- 常用构建工具: %s\n", info.BuildTool))
	}
	if info.TestCommand != "" {
		sb.WriteString(fmt.Sprintf("- 建议测试验证命令: `%s`\n", info.TestCommand))
	}
	sb.WriteString(fmt.Sprintf("- 检测到的配置文件: %s\n", strings.Join(info.ConfigFiles, ", ")))
	sb.WriteString("💡 开发者指引：在编写、修改代码或进行自愈验证时，请严格结合上述识别到的项目生态使用匹配的命令，切勿盲目假设特定语言环境。")
	return sb.String()
}
