{
  description = "Chronify (puku-timetracking) — PWA time tracking for German SMEs";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
    in
    {
      devShells = forEachSystem (
        pkgs:
        let
          # Local PostgreSQL 16 cluster in ./.dev-db — no Docker required.
          dev-db = pkgs.writeShellApplication {
            name = "dev-db";
            runtimeInputs = [
              pkgs.postgresql_16
              pkgs.coreutils
            ];
            text = ''
              DATA_DIR="''${DEV_DB_DATA_DIR:-$PWD/.dev-db}"
              PORT="''${DEV_DB_PORT:-5432}"
              export PGHOST=127.0.0.1
              export PGPORT="$PORT"
              export PGUSER=puku

              init_cluster() {
                if [ ! -d "$DATA_DIR/base" ]; then
                  echo "initialising PostgreSQL cluster in $DATA_DIR"
                  initdb -D "$DATA_DIR" -U puku --auth=trust --encoding=UTF8 --locale=C >/dev/null
                fi
              }

              case "''${1:-start}" in
                start)
                  init_cluster
                  if pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1; then
                    echo "already running on $PGHOST:$PGPORT"
                  else
                    pg_ctl -D "$DATA_DIR" -l "$DATA_DIR/server.log" \
                      -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$DATA_DIR" -w start >/dev/null
                    echo "started on $PGHOST:$PGPORT (log: $DATA_DIR/server.log)"
                  fi
                  if ! psql -lqt | cut -d'|' -f1 | grep -qw puku; then
                    createdb puku
                    echo "created database puku"
                  fi
                  echo "DATABASE_URL=\"postgresql://puku:puku@localhost:$PORT/puku?schema=public\""
                  ;;
                stop)
                  pg_ctl -D "$DATA_DIR" stop -m fast
                  ;;
                status)
                  pg_ctl -D "$DATA_DIR" status || true
                  ;;
                psql)
                  exec psql puku
                  ;;
                reset)
                  pg_ctl -D "$DATA_DIR" stop -m immediate >/dev/null 2>&1 || true
                  rm -rf "$DATA_DIR"
                  echo "removed $DATA_DIR"
                  ;;
                *)
                  echo "usage: dev-db {start|stop|status|psql|reset}" >&2
                  exit 64
                  ;;
              esac
            '';
          };

          # Create .env from .env.example with freshly generated secrets.
          dev-env-init = pkgs.writeShellApplication {
            name = "dev-env-init";
            runtimeInputs = [
              pkgs.coreutils
              pkgs.gnused
              pkgs.openssl
            ];
            text = ''
              if [ -f .env ]; then
                echo ".env already exists — leaving it untouched"
                exit 0
              fi
              cp .env.example .env
              set_secret() {
                local key="$1" value="$2"
                sed -i "s|^$key=.*|$key=\"$value\"|" .env
              }
              set_secret NEXTAUTH_SECRET "$(openssl rand -base64 32)"
              set_secret AU_CERT_ENCRYPTION_KEY "$(openssl rand -hex 32)"
              set_secret BACKUP_ENCRYPTION_PASSPHRASE "$(openssl rand -base64 32)"
              echo "wrote .env with generated NEXTAUTH_SECRET, AU_CERT_ENCRYPTION_KEY, BACKUP_ENCRYPTION_PASSPHRASE"
            '';
          };
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              # Provides PRISMA_{SCHEMA,QUERY}_ENGINE* via its Nix setup hook, so
              # `npx prisma generate` / `migrate` work natively on NixOS.
              pkgs.prisma-engines_6
              pkgs.postgresql_16
              pkgs.playwright-driver.browsers
              dev-db
              dev-env-init
              pkgs.git
              pkgs.curl
              pkgs.jq
              pkgs.ripgrep
              pkgs.fd
              pkgs.openssl
              pkgs.unzip
              pkgs.gnutar
              pkgs.gzip
            ];

            env = {
              PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
              PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
              PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
              NEXT_TELEMETRY_DISABLED = "1";
              PRISMA_HIDE_UPDATE_MESSAGE = "1";
              NPM_CONFIG_UPDATE_NOTIFIER = "false";
            };

            shellHook = ''
              echo "chronify dev shell — node $(node --version), npm $(npm --version)"
              [ -d node_modules ] || echo "  → npm ci                      (install dependencies)"
              [ -f .env ] || echo "  → dev-env-init                (create .env with generated secrets)"
              echo "  → dev-db start                (local Postgres 16 on :5432, no Docker)"
              echo "  → npm run db:setup            (migrate + seed)"
              echo "  → npm run dev                 (http://localhost:3001)"
            '';
          };
        }
      );
    };
}
