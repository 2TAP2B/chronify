import { loadEnvFile } from "node:process";

try {
  // .env is optional: Docker/most CI runs supply real environment variables,
  // and loadEnvFile never overwrites variables that are already set.
  loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // no .env present — fall back to the ambient environment
}
