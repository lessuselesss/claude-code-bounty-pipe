{
  description = "Claude Code Bounty Pipeline - Automated bounty discovery, evaluation, and preparation system";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Core runtime
            deno

            # Git for repository operations
            git

            # GitHub CLI for API interactions
            gh

            # Development tools
            nodePackages.typescript
            nodePackages.typescript-language-server

            # System utilities for repository caching
            coreutils
            findutils
            gnugrep
          ];

          shellHook = ''
            echo "🚀 Claude Code Bounty Pipeline Development Environment"
            echo ""
            echo "📦 Available tools:"
            echo "  - Deno $(deno --version | head -1)"
            echo "  - Git $(git --version)"
            echo "  - GitHub CLI $(gh --version | head -1)"
            echo ""
            echo "🎯 Main Pipeline Commands:"
            echo "  deno task generate               - Generate bounty index from 128+ organizations"
            echo "  deno task generate:full          - Full scan with --full-scan flag"
            echo "  deno task generate:quick         - Quick scan with 6h max age"
            echo ""
            echo "  deno task pre-filter             - Quick scoring assessment of bounties"
            echo "  deno task pre-filter:batch       - Process up to 50 bounties"
            echo "  deno task pre-filter:conservative - Conservative scoring (min 70%, max 25)"
            echo ""
            echo "  deno task evaluate               - 5-phase comprehensive evaluation"
            echo "  deno task evaluate:priority      - Focus on priority orgs (tscircuit,zio,twentyhq)"
            echo "  deno task evaluate:pre-filtered  - Only evaluate pre-filter score ≥80%"
            echo "  deno task evaluate:single        - Evaluate just one bounty"
            echo "  deno task evaluate:slash         - Use slash commands for evaluation"
            echo ""
            echo "  deno task pipeline               - Complete orchestrated pipeline"
            echo "  deno task pipeline:auto-prep     - Auto-prep bounties with ≥80% success"
            echo "  deno task pipeline:conservative  - Conservative pipeline (≥85% success, max 1 prep)"
            echo "  deno task pipeline:full          - Full pipeline with auto-implementation"
            echo ""
            echo "  deno task implement              - TDD implementation workflow"
            echo "  deno task submit                 - Professional submission workflow"
            echo "  deno task submit:dry-run         - Test submission without creating PRs"
            echo ""
            echo "🗂️  Cache Management:"
            echo "  deno task cache:stats            - View repository cache statistics"
            echo "  deno task cache:cleanup          - Clean up old cache entries (>30 days)"
            echo "  deno task cache:force-cleanup    - Force cleanup (>1 day, including active)"
            echo ""
            echo "⚡ Quick Workflows:"
            echo "  deno task daily                  - Daily maintenance routine"
            echo "  deno task daily:safe             - Safe daily with conservative settings"
            echo "  deno task weekly                 - Weekly comprehensive analysis"
            echo "  deno task smart-pipeline         - Intelligent pipeline with pre-filtering"
            echo ""
            echo "🧪 Testing & Validation:"
            echo "  deno task test:validation        - Double-blind validation with real data"
            echo "  deno task test:find-real-bounties - Find completed bounties for testing"
            echo "  deno task test:validate-methodology - Validate evaluation methodology"
            echo ""
            echo "💬 Slash Commands (use in Claude Code):"
            echo "  /bounty-pipe:evaluate            - Interactive bounty evaluation"
            echo "  /bounty-pipe:prep                - 10-step preparation workflow"
            echo "  /bounty-pipe:implement           - TDD implementation execution"
            echo "  /bounty-pipe:submit              - Professional submission workflow"
            echo "  /bounty-pipe:pipeline            - Complete end-to-end pipeline"
            echo "  /bounty-pipe:workspace create <org>/<repo>#<issue> - Create development workspace"
            echo "  /bounty-pipe:workspace list      - List active workspaces"
            echo "  /bounty-pipe:workspace cleanup   - Clean up old workspaces"
            echo ""
            echo "📂 XDG Directory Structure:"
            echo "  Cache:     ~/.cache/bounty-pipe/<org>/<repo>/"
            echo "  Metadata:  ~/.cache/bounty-pipe/repo_metadata.json"
            echo "  Evals:     ~/.cache/bounty-pipe/<org>/<org>-<repo>-<issue>.md"
            echo "  Work:      ~/.local/share/bounty-pipe/work/<org>-<repo>-<issue>/"
            echo ""
            echo "📖 Documentation:"
            echo "  workflows/CLAUDE-EVALUATE-BOUNTY.md  - 5-phase evaluation methodology"
            echo "  workflows/CLAUDE-PREP-BOUNTY.md      - 10-step preparation workflow"
            echo "  .claude/commands/bounty-pipe/         - Slash command documentation"
            echo ""

            # Ensure XDG directories exist
            mkdir -p ~/.cache/bounty-pipe
            mkdir -p ~/.local/share/bounty-pipe/work

            # Set up environment for Deno
            export DENO_DIR="$HOME/.cache/deno"
            export DENO_INSTALL_ROOT="$HOME/.deno"

            # GitHub CLI setup hint
            if ! gh auth status >/dev/null 2>&1; then
              echo "⚠️  GitHub CLI not authenticated. Run 'gh auth login' to authenticate."
              echo ""
            fi

            echo "🔥 Ready to discover and evaluate bounties!"
            echo ""
          '';

          # Environment variables
          # These will be expanded at runtime when the shell is entered
          DENO_DIR = "\${HOME}/.cache/deno";
          DENO_INSTALL_ROOT = "\${HOME}/.deno";

          # XDG Base Directory Specification
          XDG_CACHE_HOME = "\${HOME}/.cache";
          XDG_DATA_HOME = "\${HOME}/.local/share";
          XDG_CONFIG_HOME = "\${HOME}/.config";
        };

        # Package the application
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "claude-code-bounty-pipe";
          version = "1.0.0";

          src = ./.;

          buildInputs = [ pkgs.deno ];

          buildPhase = ''
            # Cache dependencies
            deno cache --reload src/*.ts
          '';

          installPhase = ''
            mkdir -p $out/bin $out/share/bounty-pipe

            # Copy source files
            cp -r src workflows scripts .claude $out/share/bounty-pipe/
            cp deno.json $out/share/bounty-pipe/

            # Create wrapper scripts for main commands
            cat > $out/bin/bounty-pipe-generate <<EOF
            #!/usr/bin/env bash
            cd $out/share/bounty-pipe
            exec ${pkgs.deno}/bin/deno task generate "\$@"
            EOF

            cat > $out/bin/bounty-pipe-evaluate <<EOF
            #!/usr/bin/env bash
            cd $out/share/bounty-pipe
            exec ${pkgs.deno}/bin/deno task evaluate "\$@"
            EOF

            cat > $out/bin/bounty-pipe-pipeline <<EOF
            #!/usr/bin/env bash
            cd $out/share/bounty-pipe
            exec ${pkgs.deno}/bin/deno task pipeline "\$@"
            EOF

            cat > $out/bin/bounty-pipe-cache-stats <<EOF
            #!/usr/bin/env bash
            cd $out/share/bounty-pipe
            exec ${pkgs.deno}/bin/deno task cache:stats "\$@"
            EOF

            chmod +x $out/bin/*
          '';

          meta = with pkgs.lib; {
            description = "Automated bounty discovery, evaluation, and preparation system using Claude Code";
            homepage = "https://github.com/your-username/claude-code-bounty-pipe";
            license = licenses.mit;
            maintainers = [ ];
            platforms = platforms.unix;
          };
        };

        # Development apps for easy access
        apps = {
          generate = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScript "bounty-pipe-generate" ''
              cd ${self}
              exec ${pkgs.deno}/bin/deno task generate "$@"
            '';
          };

          evaluate = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScript "bounty-pipe-evaluate" ''
              cd ${self}
              exec ${pkgs.deno}/bin/deno task evaluate "$@"
            '';
          };

          pipeline = flake-utils.lib.mkApp {
            drv = pkgs.writeShellScript "bounty-pipe-pipeline" ''
              cd ${self}
              exec ${pkgs.deno}/bin/deno task pipeline "$@"
            '';
          };
        };

        # Formatter for the flake
        formatter = pkgs.nixpkgs-fmt;
      });
}