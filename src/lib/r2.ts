import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region?: string;
}

export interface R2File {
  key: string;
  lastModified?: Date;
  size?: number;
}

let client: S3Client | null = null;
let currentConfig: R2Config | null = null;

export function initR2Client(config: R2Config) {
  client = new S3Client({
    endpoint: config.endpoint,
    region: config.region || "auto",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
  currentConfig = config;
  return client;
}

export function getClient(): S3Client | null {
  return client;
}

export function getCurrentConfig(): R2Config | null {
  return currentConfig;
}

export async function listJsonFiles(): Promise<R2File[]> {
  if (!client || !currentConfig) {
    throw new Error("R2 client not initialized");
  }

  const command = new ListObjectsV2Command({
    Bucket: currentConfig.bucketName,
  });

  const response = await client.send(command);

  return (response.Contents || [])
    .filter((obj) => obj.Key?.endsWith(".json"))
    .map((obj) => ({
      key: obj.Key!,
      lastModified: obj.LastModified,
      size: obj.Size,
    }));
}

export async function getJsonFile(key: string): Promise<unknown> {
  if (!client || !currentConfig) {
    throw new Error("R2 client not initialized");
  }

  const command = new GetObjectCommand({
    Bucket: currentConfig.bucketName,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error("Empty file content");
  }

  const text = await response.Body.transformToString();
  return JSON.parse(text);
}

export async function putJsonFile(key: string, data: unknown): Promise<void> {
  if (!client || !currentConfig) {
    throw new Error("R2 client not initialized");
  }

  const content = JSON.stringify(data, null, 2);

  const command = new PutObjectCommand({
    Bucket: currentConfig.bucketName,
    Key: key,
    Body: content,
    ContentType: "application/json",
  });

  await client.send(command);
}

export function isConfigured(): boolean {
  return client !== null;
}

export function resetClient(): void {
  client = null;
  currentConfig = null;
}
