import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const ORGS_FILE = path.join(DATA_DIR, "organizations.json");

export interface Organization {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Bucket {
  id: string;
  orgId: string;
  name: string;
  endpoint: string;
  region: string;
  bucketName: string;
}

export interface OrganizationsData {
  organizations: Organization[];
  buckets: Bucket[];
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readOrgsFile(): Promise<OrganizationsData> {
  await ensureDataDir();
  if (!existsSync(ORGS_FILE)) {
    return { organizations: [], buckets: [] };
  }
  const content = await readFile(ORGS_FILE, "utf-8");
  return JSON.parse(content);
}

async function writeOrgsFile(data: OrganizationsData): Promise<void> {
  await ensureDataDir();
  await writeFile(ORGS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function generateId(): string {
  return (
    "id_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
  );
}

export async function serverLoadOrgs(): Promise<OrganizationsData> {
  "use server";
  return await readOrgsFile();
}

export async function serverSaveOrgs(data: OrganizationsData): Promise<void> {
  "use server";
  await writeOrgsFile(data);
}

export async function serverCreateOrg(
  name: string,
  description: string,
): Promise<Organization> {
  "use server";
  const data = await readOrgsFile();
  const org: Organization = {
    id: generateId(),
    name,
    description,
    createdAt: new Date().toISOString(),
  };
  data.organizations.push(org);
  await writeOrgsFile(data);
  return org;
}

export async function serverUpdateOrg(
  id: string,
  name: string,
  description: string,
): Promise<Organization | null> {
  "use server";
  const data = await readOrgsFile();
  const org = data.organizations.find((o) => o.id === id);
  if (!org) return null;
  org.name = name;
  org.description = description;
  await writeOrgsFile(data);
  return org;
}

export async function serverDeleteOrg(id: string): Promise<boolean> {
  "use server";
  const data = await readOrgsFile();
  const idx = data.organizations.findIndex((o) => o.id === id);
  if (idx === -1) return false;
  data.organizations.splice(idx, 1);
  data.buckets = data.buckets.filter((b) => b.orgId !== id);
  await writeOrgsFile(data);
  return true;
}

export async function serverCreateBucket(
  orgId: string,
  name: string,
  endpoint: string,
  region: string,
  bucketName: string,
): Promise<Bucket> {
  "use server";
  const data = await readOrgsFile();
  const bucket: Bucket = {
    id: generateId(),
    orgId,
    name,
    endpoint,
    region,
    bucketName,
  };
  data.buckets.push(bucket);
  await writeOrgsFile(data);
  return bucket;
}

export async function serverUpdateBucket(
  id: string,
  name: string,
  endpoint: string,
  region: string,
  bucketName: string,
): Promise<Bucket | null> {
  "use server";
  const data = await readOrgsFile();
  const bucket = data.buckets.find((b) => b.id === id);
  if (!bucket) return null;
  bucket.name = name;
  bucket.endpoint = endpoint;
  bucket.region = region;
  bucket.bucketName = bucketName;
  await writeOrgsFile(data);
  return bucket;
}

export async function serverDeleteBucket(id: string): Promise<boolean> {
  "use server";
  const data = await readOrgsFile();
  const idx = data.buckets.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  data.buckets.splice(idx, 1);
  await writeOrgsFile(data);
  return true;
}

export async function serverGetBucketsByOrg(orgId: string): Promise<Bucket[]> {
  "use server";
  const data = await readOrgsFile();
  return data.buckets.filter((b) => b.orgId === orgId);
}
