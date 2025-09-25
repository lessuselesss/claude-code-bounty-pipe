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
            echo "🎯 Quick commands:"
            echo "  deno task generate        - Generate bounty index"
            echo "  deno task evaluate        - Evaluate bounties"
            echo "  deno task cache:stats     - View cache statistics"
            echo "  deno task cache:cleanup   - Clean up old cache"
            echo ""
            echo "📂 XDG directories:"
            echo "  Cache: ~/.cache/bounty-pipe/"
            echo "  Work:  ~/.local/share/bounty-pipe/work/"
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
          '';

          # Environment variables
          DENO_DIR = "$HOME/.cache/deno";
          DENO_INSTALL_ROOT = "$HOME/.deno";

          # XDG Base Directory Specification
          XDG_CACHE_HOME = "$HOME/.cache";
          XDG_DATA_HOME = "$HOME/.local/share";
          XDG_CONFIG_HOME = "$HOME/.config";
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