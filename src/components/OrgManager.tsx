import { createSignal, Show, For, onMount } from "solid-js";
import {
  serverLoadOrgs,
  serverCreateOrg,
  serverUpdateOrg,
  serverDeleteOrg,
  serverCreateBucket,
  serverUpdateBucket,
  serverDeleteBucket,
  type Organization,
  type Bucket,
} from "~/lib/orgs-server";
import { serverInitR2 } from "~/lib/r2-server";

interface Props {
  onBucketConnected?: () => void;
}

export default function OrgManager(props: Props) {
  const [orgs, setOrgs] = createSignal<Organization[]>([]);
  const [buckets, setBuckets] = createSignal<Bucket[]>([]);
  const [selectedOrgId, setSelectedOrgId] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);

  const [showOrgForm, setShowOrgForm] = createSignal(false);
  const [editingOrg, setEditingOrg] = createSignal<Organization | null>(null);
  const [orgName, setOrgName] = createSignal("");
  const [orgDescription, setOrgDescription] = createSignal("");

  const [showBucketForm, setShowBucketForm] = createSignal(false);
  const [editingBucket, setEditingBucket] = createSignal<Bucket | null>(null);
  const [bucketName, setBucketName] = createSignal("");
  const [bucketEndpoint, setBucketEndpoint] = createSignal("");
  const [bucketRegion, setBucketRegion] = createSignal("auto");
  const [bucketBucketName, setBucketBucketName] = createSignal("");
  const [credAccessKeyId, setCredAccessKeyId] = createSignal("");
  const [credSecretAccessKey, setCredSecretAccessKey] = createSignal("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await serverLoadOrgs();
      setOrgs(data.organizations);
      setBuckets(data.buckets);
    } catch (e) {
      console.error("Failed to load orgs:", e);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const resetOrgForm = () => {
    setOrgName("");
    setOrgDescription("");
    setEditingOrg(null);
    setShowOrgForm(false);
  };

  const handleSaveOrg = async () => {
    if (!orgName().trim()) return;

    try {
      if (editingOrg()) {
        await serverUpdateOrg(editingOrg()!.id, orgName(), orgDescription());
      } else {
        await serverCreateOrg(orgName(), orgDescription());
      }
      await loadData();
      resetOrgForm();
    } catch (e) {
      console.error("Failed to save org:", e);
    }
  };

  const handleDeleteOrg = async (id: string) => {
    if (!confirm("Delete this organization and all its buckets?")) return;
    try {
      await serverDeleteOrg(id);
      if (selectedOrgId() === id) {
        setSelectedOrgId(null);
      }
      await loadData();
    } catch (e) {
      console.error("Failed to delete org:", e);
    }
  };

  const startEditOrg = (org: Organization) => {
    setEditingOrg(org);
    setOrgName(org.name);
    setOrgDescription(org.description);
    setShowOrgForm(true);
  };

  const resetBucketForm = () => {
    setBucketName("");
    setBucketEndpoint("");
    setBucketRegion("auto");
    setBucketBucketName("");
    setCredAccessKeyId("");
    setCredSecretAccessKey("");
    setEditingBucket(null);
    setShowBucketForm(false);
  };

  const handleSaveBucket = async () => {
    if (!bucketName().trim() || !selectedOrgId()) return;

    let bucketId: string;

    try {
      if (editingBucket()) {
        await serverUpdateBucket(
          editingBucket()!.id,
          bucketName(),
          bucketEndpoint(),
          bucketRegion(),
          bucketBucketName(),
        );
        bucketId = editingBucket()!.id;
      } else {
        const newBucket = await serverCreateBucket(
          selectedOrgId()!,
          bucketName(),
          bucketEndpoint(),
          bucketRegion(),
          bucketBucketName(),
        );
        bucketId = newBucket.id;
      }

      if (credAccessKeyId() && credSecretAccessKey()) {
        localStorage.setItem(`r2_access_key_id_${bucketId}`, credAccessKeyId());
        localStorage.setItem(
          `r2_secret_access_key_${bucketId}`,
          credSecretAccessKey(),
        );
      }

      await loadData();
      resetBucketForm();
    } catch (e) {
      console.error("Failed to save bucket:", e);
    }
  };

  const handleDeleteBucket = async (id: string) => {
    if (!confirm("Delete this bucket?")) return;
    try {
      await serverDeleteBucket(id);
      await loadData();
    } catch (e) {
      console.error("Failed to delete bucket:", e);
    }
  };

  const startEditBucket = (bucket: Bucket) => {
    setEditingBucket(bucket);
    setBucketName(bucket.name);
    setBucketEndpoint(bucket.endpoint);
    setBucketRegion(bucket.region);
    setBucketBucketName(bucket.bucketName);
    setCredAccessKeyId(
      localStorage.getItem(`r2_access_key_id_${bucket.id}`) || "",
    );
    setCredSecretAccessKey(
      localStorage.getItem(`r2_secret_access_key_${bucket.id}`) || "",
    );
    setShowBucketForm(true);
  };

  const connectToBucket = async (bucket: Bucket) => {
    const accessKeyId =
      localStorage.getItem(`r2_access_key_id_${bucket.id}`) || "";
    const secretAccessKey =
      localStorage.getItem(`r2_secret_access_key_${bucket.id}`) || "";

    if (!accessKeyId || !secretAccessKey) {
      alert(
        "Please enter credentials for this bucket in the bucket form first.",
      );
      return;
    }

    try {
      await serverInitR2({
        endpoint: bucket.endpoint,
        accessKeyId,
        secretAccessKey,
        bucketName: bucket.bucketName,
      });
      localStorage.setItem("r2_endpoint", bucket.endpoint);
      localStorage.setItem("r2_access_key_id", accessKeyId);
      localStorage.setItem("r2_secret_access_key", secretAccessKey);
      localStorage.setItem("r2_bucket_name", bucket.bucketName);
      localStorage.setItem("r2_bucket_id", bucket.id);
      localStorage.setItem("r2_region", bucket.region);

      props.onBucketConnected?.();
      alert(`Connected to ${bucket.name}`);
    } catch (e) {
      console.error("Failed to connect:", e);
      alert("Failed to connect to bucket");
    }
  };

  const getOrgBuckets = (orgId: string) =>
    buckets().filter((b) => b.orgId === orgId);

  return (
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-xl font-semibold mb-4">Organizations & Buckets</h1>

      <Show
        when={!loading()}
        fallback={
          <div class="text-sm text-[var(--text-muted)]">Loading...</div>
        }
      >
        <div class="space-y-6">
          <div class="card p-3">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-medium">Organizations</h2>
              <Show when={!showOrgForm()}>
                <button
                  type="button"
                  onClick={() => setShowOrgForm(true)}
                  class="btn-primary text-xs py-1"
                >
                  + Add Org
                </button>
              </Show>
            </div>

            <Show when={showOrgForm()}>
              <div class="mb-3 p-2 bg-[var(--bg-tertiary)] rounded">
                <div class="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={orgName()}
                    onInput={(e) => setOrgName(e.currentTarget.value)}
                    placeholder="Organization name"
                    class="input text-xs"
                  />
                  <input
                    type="text"
                    value={orgDescription()}
                    onInput={(e) => setOrgDescription(e.currentTarget.value)}
                    placeholder="Description (optional)"
                    class="input text-xs"
                  />
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveOrg}
                    class="btn-primary text-xs py-1"
                  >
                    {editingOrg() ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={resetOrgForm}
                    class="btn-ghost text-xs py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Show>

            <Show when={orgs().length === 0 && !showOrgForm()}>
              <div class="text-sm text-[var(--text-muted)] py-2">
                No organizations yet
              </div>
            </Show>

            <div class="space-y-2">
              <For each={orgs()}>
                {(org) => (
                  <div class="flex items-center justify-between p-2 rounded bg-[var(--bg-tertiary)]">
                    <div class="flex-1">
                      <div class="text-sm font-medium">{org.name}</div>
                      <Show when={org.description}>
                        <div class="text-xs text-[var(--text-muted)]">
                          {org.description}
                        </div>
                      </Show>
                      <div class="text-xs text-[var(--text-muted)] mt-1">
                        {getOrgBuckets(org.id).length} bucket(s)
                      </div>
                    </div>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedOrgId(
                            selectedOrgId() === org.id ? null : org.id,
                          )
                        }
                        class="btn-ghost text-xs py-1 px-2"
                      >
                        {selectedOrgId() === org.id
                          ? "Hide Buckets"
                          : "Show Buckets"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditOrg(org)}
                        class="btn-ghost text-xs py-1 px-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOrg(org.id)}
                        class="btn-ghost text-xs py-1 px-2 text-[var(--error)]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <Show when={selectedOrgId()}>
            <div class="card p-3">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-medium">Buckets</h2>
                <Show when={!showBucketForm()}>
                  <button
                    type="button"
                    onClick={() => setShowBucketForm(true)}
                    class="btn-primary text-xs py-1"
                  >
                    + Add Bucket
                  </button>
                </Show>
              </div>

              <Show when={showBucketForm()}>
                <div class="mb-3 p-2 bg-[var(--bg-tertiary)] rounded">
                  <div class="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={bucketName()}
                      onInput={(e) => setBucketName(e.currentTarget.value)}
                      placeholder="Bucket name (display)"
                      class="input text-xs col-span-2"
                    />
                    <input
                      type="text"
                      value={bucketEndpoint()}
                      onInput={(e) => setBucketEndpoint(e.currentTarget.value)}
                      placeholder="Endpoint (e.g. https://...)"
                      class="input text-xs col-span-2"
                    />
                    <input
                      type="text"
                      value={bucketRegion()}
                      onInput={(e) => setBucketRegion(e.currentTarget.value)}
                      placeholder="Region (e.g. auto)"
                      class="input text-xs"
                    />
                    <input
                      type="text"
                      value={bucketBucketName()}
                      onInput={(e) =>
                        setBucketBucketName(e.currentTarget.value)
                      }
                      placeholder="Bucket name (S3)"
                      class="input text-xs"
                    />
                  </div>
                  <div class="mb-2 p-2 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-muted)]">
                    <div class="font-medium mb-1">
                      Credentials (stored in browser)
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Access Key ID"
                        class="input text-xs"
                        value={credAccessKeyId()}
                        onInput={(e) =>
                          setCredAccessKeyId(e.currentTarget.value)
                        }
                      />
                      <input
                        type="password"
                        placeholder="Secret Access Key"
                        class="input text-xs"
                        value={credSecretAccessKey()}
                        onInput={(e) =>
                          setCredSecretAccessKey(e.currentTarget.value)
                        }
                      />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveBucket}
                      class="btn-primary text-xs py-1"
                    >
                      {editingBucket() ? "Update" : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={resetBucketForm}
                      class="btn-ghost text-xs py-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Show>

              <Show
                when={
                  getOrgBuckets(selectedOrgId()!).length === 0 &&
                  !showBucketForm()
                }
              >
                <div class="text-sm text-[var(--text-muted)] py-2">
                  No buckets yet
                </div>
              </Show>

              <div class="space-y-2">
                <For each={getOrgBuckets(selectedOrgId()!)}>
                  {(bucket) => (
                    <div class="flex items-center justify-between p-2 rounded bg-[var(--bg-tertiary)]">
                      <div class="flex-1">
                        <div class="text-sm font-medium">{bucket.name}</div>
                        <div class="text-xs text-[var(--text-muted)]">
                          {bucket.bucketName}
                        </div>
                        <div class="text-xs text-[var(--text-muted)]">
                          {bucket.endpoint}
                        </div>
                      </div>
                      <div class="flex gap-1">
                        <button
                          type="button"
                          onClick={() => connectToBucket(bucket)}
                          class="btn-primary text-xs py-1 px-2"
                        >
                          Connect
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditBucket(bucket)}
                          class="btn-ghost text-xs py-1 px-2"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBucket(bucket.id)}
                          class="btn-ghost text-xs py-1 px-2 text-[var(--error)]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
