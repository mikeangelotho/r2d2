import { initR2Client, listJsonFiles, getJsonFile, putJsonFile, isConfigured, type R2Config } from "~/lib/r2";

export async function serverListJsonFiles() {
  "use server";
  return await listJsonFiles();
}

export async function serverGetJsonFile(key: string) {
  "use server";
  return await getJsonFile(key);
}

export async function serverPutJsonFile(key: string, data: unknown) {
  "use server";
  return await putJsonFile(key, data);
}

export async function serverInitR2(config: R2Config) {
  "use server";
  initR2Client(config);
  return isConfigured();
}

export async function serverIsConfigured() {
  "use server";
  return isConfigured();
}

export async function serverResetR2() {
  "use server";
  return true;
}
