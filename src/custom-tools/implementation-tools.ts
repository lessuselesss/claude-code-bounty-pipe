#!/usr/bin/env -S deno run --allow-all

/**
 * Custom Implementation Tools for Bounty Pipeline
 *
 * Specialized tools for enhanced implementation workflow
 */

import { createSdkMcpServer, tool } from "npm:@anthropic-ai/claude-code@latest";
import { z } from "npm:zod@3.22.4";

export const implementationToolsServer = createSdkMcpServer({
  name: "implementation-tools",
  version: "1.0.0",
  tools: [

    // Test Runner Tool
    tool(
      "run_tests",
      "Execute tests with detailed reporting and coverage analysis",
      {
        testCommand: z.string().describe("Test command to execute (e.g., 'npm test', 'cargo test', 'python -m pytest')"),
        workingDir: z.string().optional().describe("Working directory for test execution"),
        coverage: z.boolean().default(true).describe("Include coverage analysis"),
        verbose: z.boolean().default(false).describe("Verbose test output")
      },
      async (args) => {
        const { testCommand, workingDir = ".", coverage, verbose } = args;

        try {
          // Build command with options
          let fullCommand = testCommand;
          if (coverage && testCommand.includes("npm")) {
            fullCommand = "npm run test:coverage || npm test -- --coverage";
          } else if (coverage && testCommand.includes("cargo")) {
            fullCommand = "cargo tarpaulin --out Xml || cargo test";
          }

          if (verbose) {
            fullCommand += " --verbose";
          }

          // Execute test command
          const process = new Deno.Command("bash", {
            args: ["-c", fullCommand],
            cwd: workingDir,
            stdout: "piped",
            stderr: "piped"
          });

          const { code, stdout, stderr } = await process.output();
          const output = new TextDecoder().decode(stdout);
          const error = new TextDecoder().decode(stderr);

          const success = code === 0;
          let summary = `Test execution ${success ? "✅ PASSED" : "❌ FAILED"}`;

          // Parse test results for better reporting
          if (output.includes("passing") || output.includes("passed")) {
            const passedMatch = output.match(/(\d+)\s+(?:passing|passed)/);
            if (passedMatch) summary += ` (${passedMatch[1]} tests passed)`;
          }

          if (output.includes("failing") || output.includes("failed")) {
            const failedMatch = output.match(/(\d+)\s+(?:failing|failed)/);
            if (failedMatch) summary += ` (${failedMatch[1]} tests failed)`;
          }

          // Extract coverage information
          let coverageInfo = "";
          if (coverage && output.includes("Coverage")) {
            const coverageMatch = output.match(/Coverage.*?(\d+\.?\d*%)/);
            if (coverageMatch) {
              coverageInfo = `\n📊 Code Coverage: ${coverageMatch[1]}`;
            }
          }

          return {
            content: [{
              type: "text",
              text: `${summary}${coverageInfo}\n\n**Command:** ${fullCommand}\n**Exit Code:** ${code}\n\n**Output:**\n${output}\n\n**Errors:**\n${error}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `❌ Test execution failed: ${error.message}`
            }]
          };
        }
      }
    ),

    // Code Quality Checker
    tool(
      "quality_check",
      "Run comprehensive code quality checks including linting, formatting, and security scans",
      {
        language: z.enum(["javascript", "typescript", "python", "rust", "go", "java"]).describe("Programming language"),
        workingDir: z.string().optional().default(".").describe("Working directory"),
        includeFormatting: z.boolean().default(true).describe("Include code formatting checks"),
        includeLinting: z.boolean().default(true).describe("Include linting checks"),
        includeSecurity: z.boolean().default(true).describe("Include security vulnerability scans")
      },
      async (args) => {
        const { language, workingDir, includeFormatting, includeLinting, includeSecurity } = args;
        const results: string[] = [];

        try {
          // Language-specific quality checks
          const commands = {
            typescript: {
              lint: "npx eslint . --ext .ts,.tsx --format=compact",
              format: "npx prettier --check .",
              typeCheck: "npx tsc --noEmit",
              security: "npx audit-ci --moderate"
            },
            javascript: {
              lint: "npx eslint . --ext .js,.jsx --format=compact",
              format: "npx prettier --check .",
              security: "npm audit --audit-level=moderate"
            },
            python: {
              lint: "flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics",
              format: "black --check .",
              security: "bandit -r . -f json"
            },
            rust: {
              lint: "cargo clippy -- -D warnings",
              format: "cargo fmt -- --check",
              security: "cargo audit"
            },
            go: {
              lint: "golangci-lint run",
              format: "gofmt -d .",
              security: "gosec ./..."
            },
            java: {
              lint: "mvn checkstyle:check",
              format: "mvn com.coveo:fmt-maven-plugin:check",
              security: "mvn org.owasp:dependency-check-maven:check"
            }
          };

          const langCommands = commands[language];
          if (!langCommands) {
            throw new Error(`Unsupported language: ${language}`);
          }

          // Run checks based on options
          if (includeLinting && langCommands.lint) {
            results.push("🔍 **Linting Check:**");
            try {
              const process = new Deno.Command("bash", {
                args: ["-c", langCommands.lint],
                cwd: workingDir,
                stdout: "piped",
                stderr: "piped"
              });
              const { code, stdout, stderr } = await process.output();
              const output = new TextDecoder().decode(stdout);
              const error = new TextDecoder().decode(stderr);

              results.push(code === 0 ? "✅ Linting passed" : `❌ Linting failed:\n${output}${error}`);
            } catch (error) {
              results.push(`❌ Linting error: ${error.message}`);
            }
          }

          if (includeFormatting && langCommands.format) {
            results.push("\n📏 **Format Check:**");
            try {
              const process = new Deno.Command("bash", {
                args: ["-c", langCommands.format],
                cwd: workingDir,
                stdout: "piped",
                stderr: "piped"
              });
              const { code, stdout, stderr } = await process.output();
              const output = new TextDecoder().decode(stdout);

              results.push(code === 0 ? "✅ Formatting correct" : `❌ Formatting issues found:\n${output}`);
            } catch (error) {
              results.push(`❌ Format check error: ${error.message}`);
            }
          }

          // Type checking for TypeScript
          if (language === "typescript" && langCommands.typeCheck) {
            results.push("\n🔧 **Type Check:**");
            try {
              const process = new Deno.Command("bash", {
                args: ["-c", langCommands.typeCheck],
                cwd: workingDir,
                stdout: "piped",
                stderr: "piped"
              });
              const { code, stdout, stderr } = await process.output();
              const output = new TextDecoder().decode(stdout);
              const error = new TextDecoder().decode(stderr);

              results.push(code === 0 ? "✅ Type checking passed" : `❌ Type errors found:\n${output}${error}`);
            } catch (error) {
              results.push(`❌ Type check error: ${error.message}`);
            }
          }

          if (includeSecurity && langCommands.security) {
            results.push("\n🔒 **Security Scan:**");
            try {
              const process = new Deno.Command("bash", {
                args: ["-c", langCommands.security],
                cwd: workingDir,
                stdout: "piped",
                stderr: "piped"
              });
              const { code, stdout, stderr } = await process.output();
              const output = new TextDecoder().decode(stdout);
              const error = new TextDecoder().decode(stderr);

              results.push(code === 0 ? "✅ No security issues found" : `⚠️ Security scan results:\n${output}${error}`);
            } catch (error) {
              results.push(`❌ Security scan error: ${error.message}`);
            }
          }

          return {
            content: [{
              type: "text",
              text: `**Code Quality Check Results for ${language}**\n\n${results.join("\n")}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `❌ Quality check failed: ${error.message}`
            }]
          };
        }
      }
    ),

    // Project Structure Analyzer
    tool(
      "analyze_project_structure",
      "Analyze project structure, dependencies, and provide implementation guidance",
      {
        workingDir: z.string().optional().default(".").describe("Project directory to analyze"),
        includeMetrics: z.boolean().default(true).describe("Include code metrics and complexity analysis")
      },
      async (args) => {
        const { workingDir, includeMetrics } = args;

        try {
          const analysis = {
            projectType: "unknown",
            language: "unknown",
            framework: "unknown",
            buildTool: "unknown",
            testFramework: "unknown",
            dependencies: [] as string[],
            structure: {} as any,
            recommendations: [] as string[]
          };

          // Detect project type and language
          const files = [];
          for await (const dirEntry of Deno.readDir(workingDir)) {
            files.push(dirEntry.name);
          }

          // Language and framework detection
          if (files.includes("package.json")) {
            analysis.language = "JavaScript/TypeScript";
            analysis.buildTool = "npm/yarn";

            try {
              const packageJson = JSON.parse(await Deno.readTextFile(`${workingDir}/package.json`));

              // Framework detection
              if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
                analysis.framework = "React";
              } else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
                analysis.framework = "Vue.js";
              } else if (packageJson.dependencies?.angular || packageJson.devDependencies?.angular) {
                analysis.framework = "Angular";
              } else if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
                analysis.framework = "Next.js";
              }

              // Test framework detection
              if (packageJson.devDependencies?.jest) {
                analysis.testFramework = "Jest";
              } else if (packageJson.devDependencies?.mocha) {
                analysis.testFramework = "Mocha";
              } else if (packageJson.devDependencies?.vitest) {
                analysis.testFramework = "Vitest";
              }

              analysis.dependencies = Object.keys(packageJson.dependencies || {});
            } catch (error) {
              analysis.recommendations.push("⚠️ Could not parse package.json");
            }
          } else if (files.includes("Cargo.toml")) {
            analysis.language = "Rust";
            analysis.buildTool = "Cargo";
            analysis.projectType = "Rust crate";
          } else if (files.includes("go.mod")) {
            analysis.language = "Go";
            analysis.buildTool = "Go modules";
            analysis.projectType = "Go module";
          } else if (files.includes("requirements.txt") || files.includes("setup.py") || files.includes("pyproject.toml")) {
            analysis.language = "Python";
            analysis.buildTool = files.includes("pyproject.toml") ? "Poetry/pip" : "pip";
          }

          // Project structure analysis
          const commonDirs = ["src", "lib", "app", "components", "utils", "tests", "__tests__", "test"];
          analysis.structure = {
            hasSourceDir: commonDirs.some(dir => files.includes(dir)),
            hasTestDir: ["tests", "__tests__", "test", "spec"].some(dir => files.includes(dir)),
            hasDocsDir: ["docs", "documentation"].some(dir => files.includes(dir)),
            configFiles: files.filter(file =>
              file.endsWith(".config.js") || file.endsWith(".config.ts") ||
              file.endsWith(".json") || file.endsWith(".yml") || file.endsWith(".yaml")
            )
          };

          // Generate recommendations
          if (!analysis.structure.hasTestDir) {
            analysis.recommendations.push("🧪 Consider adding a dedicated test directory");
          }
          if (!analysis.structure.hasDocsDir) {
            analysis.recommendations.push("📚 Consider adding documentation directory");
          }
          if (analysis.testFramework === "unknown") {
            analysis.recommendations.push("🔧 Set up a testing framework for better code quality");
          }

          // Code metrics (if requested)
          let metricsInfo = "";
          if (includeMetrics) {
            try {
              // Count lines of code
              const process = new Deno.Command("find", {
                args: [workingDir, "-name", "*.ts", "-o", "-name", "*.js", "-o", "-name", "*.py", "-o", "-name", "*.rs", "-o", "-name", "*.go"],
                stdout: "piped"
              });
              const { stdout } = await process.output();
              const fileList = new TextDecoder().decode(stdout).trim().split("\n").filter(f => f);

              if (fileList.length > 0) {
                metricsInfo = `\n📊 **Code Metrics:**\n- Source files found: ${fileList.length}`;

                // Simple complexity analysis
                let totalLines = 0;
                let functionCount = 0;

                for (const file of fileList.slice(0, 10)) { // Limit to first 10 files for performance
                  try {
                    const content = await Deno.readTextFile(file);
                    const lines = content.split("\n").length;
                    totalLines += lines;

                    // Count functions (simple heuristic)
                    const funcMatches = content.match(/(?:function|def|fn|func)\s+\w+/g);
                    if (funcMatches) functionCount += funcMatches.length;
                  } catch (error) {
                    // Skip files we can't read
                  }
                }

                if (totalLines > 0) {
                  metricsInfo += `\n- Estimated lines of code: ${totalLines}`;
                  metricsInfo += `\n- Estimated functions: ${functionCount}`;
                  metricsInfo += `\n- Average lines per file: ${Math.round(totalLines / fileList.length)}`;
                }
              }
            } catch (error) {
              metricsInfo = "\n📊 Could not gather code metrics";
            }
          }

          const report = `**Project Analysis Report**

**Language & Framework:**
- Language: ${analysis.language}
- Framework: ${analysis.framework}
- Build Tool: ${analysis.buildTool}
- Test Framework: ${analysis.testFramework}

**Project Structure:**
- Source directory: ${analysis.structure.hasSourceDir ? "✅" : "❌"}
- Test directory: ${analysis.structure.hasTestDir ? "✅" : "❌"}
- Documentation: ${analysis.structure.hasDocsDir ? "✅" : "❌"}
- Config files: ${analysis.structure.configFiles.join(", ")}

**Dependencies:** ${analysis.dependencies.slice(0, 10).join(", ")}${analysis.dependencies.length > 10 ? "..." : ""}

**Recommendations:**
${analysis.recommendations.map(rec => `- ${rec}`).join("\n")}

${metricsInfo}`;

          return {
            content: [{
              type: "text",
              text: report
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `❌ Project analysis failed: ${error.message}`
            }]
          };
        }
      }
    ),

    // Implementation Progress Tracker
    tool(
      "track_implementation_progress",
      "Track and report detailed implementation progress with metrics",
      {
        phase: z.enum(["analysis", "test-design", "implementation", "validation", "documentation"]).describe("Current implementation phase"),
        completedTasks: z.array(z.string()).describe("List of completed tasks"),
        currentTask: z.string().describe("Currently working on task"),
        blockers: z.array(z.string()).optional().describe("Current blockers or issues"),
        testsPassing: z.number().optional().describe("Number of tests passing"),
        testsFailing: z.number().optional().describe("Number of tests failing"),
        coverage: z.number().optional().describe("Test coverage percentage")
      },
      async (args) => {
        const { phase, completedTasks, currentTask, blockers = [], testsPassing = 0, testsFailing = 0, coverage } = args;

        const timestamp = new Date().toISOString();
        const totalTasks = completedTasks.length + 1; // +1 for current task
        const progressPercentage = Math.round((completedTasks.length / totalTasks) * 100);

        // Calculate phase progress
        const phases = ["analysis", "test-design", "implementation", "validation", "documentation"];
        const currentPhaseIndex = phases.indexOf(phase);
        const overallProgress = Math.round(((currentPhaseIndex + (progressPercentage / 100)) / phases.length) * 100);

        // Quality indicators
        const qualityIndicators = [];
        if (testsPassing > 0 || testsFailing > 0) {
          const totalTests = testsPassing + testsFailing;
          const testSuccessRate = Math.round((testsPassing / totalTests) * 100);
          qualityIndicators.push(`Tests: ${testsPassing}/${totalTests} passing (${testSuccessRate}%)`);
        }

        if (coverage !== undefined) {
          const coverageStatus = coverage >= 80 ? "✅" : coverage >= 60 ? "⚠️" : "❌";
          qualityIndicators.push(`Coverage: ${coverage}% ${coverageStatus}`);
        }

        // Status determination
        let status = "🔧 In Progress";
        if (blockers.length > 0) {
          status = "⚠️ Blocked";
        } else if (phase === "documentation" && progressPercentage >= 90) {
          status = "🎉 Near Completion";
        } else if (testsFailing > 0) {
          status = "🔴 Tests Failing";
        }

        const report = `**Implementation Progress Report**
*Generated: ${timestamp}*

**Status:** ${status}
**Overall Progress:** ${overallProgress}% (Phase: ${phase})
**Current Task:** ${currentTask}

**Phase Progress:**
${phases.map((p, i) => {
  if (i < currentPhaseIndex) return `✅ ${p}`;
  if (i === currentPhaseIndex) return `🔧 ${p} (${progressPercentage}%)`;
  return `⭕ ${p}`;
}).join("\n")}

**Completed Tasks (${completedTasks.length}):**
${completedTasks.map(task => `✅ ${task}`).join("\n")}

**Quality Metrics:**
${qualityIndicators.length > 0 ? qualityIndicators.map(qi => `📊 ${qi}`).join("\n") : "📊 No test metrics available yet"}

${blockers.length > 0 ? `**Blockers (${blockers.length}):**\n${blockers.map(b => `🚫 ${b}`).join("\n")}` : ""}

**Next Steps:**
${currentPhaseIndex < phases.length - 1 ? `- Complete current ${phase} phase\n- Move to ${phases[currentPhaseIndex + 1]} phase` : "- Final review and submission preparation"}`;

        return {
          content: [{
            type: "text",
            text: report
          }]
        };
      }
    )
  ]
});

// Export the server for use in the main pipeline
if (import.meta.main) {
  console.log("🛠️ Implementation Tools MCP Server");
  console.log("Available tools:");
  console.log("- run_tests: Execute tests with coverage analysis");
  console.log("- quality_check: Comprehensive code quality validation");
  console.log("- analyze_project_structure: Project analysis and recommendations");
  console.log("- track_implementation_progress: Detailed progress tracking");
}