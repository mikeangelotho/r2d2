import { createSignal, Show, For, onMount } from "solid-js";
import {
  serverLoadOrgs,
  serverCreateOrg,
  serverUpdateOrg,
  serverDeleteOrg,
  serverCreateBucket,
  serverUpdateBucket,
  serverDeleteBucket,
  serverIsConfigured,
  type Organization,
  type Bucket,
} from "~/lib/orgs-server";
import { serverInitR2 } from "~/lib/r2-server";
import Nav from "~/components/Nav";
import { A } from "@solidjs/router";

export default function Settings() {
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
          bucketBucketName()
        );
        bucketId = editingBucket()!.id;
      } else {
        const newBucket = await serverCreateBucket(
          selectedOrgId()!,
          bucketName(),
          bucketEndpoint(),
          bucketRegion(),
          bucketBucketName()
        );
        bucketId = newBucket.id;
      }

      if (credAccessKeyId() && credSecretAccessKey()) {
        localStorage.setItem(`r2_access_key_id_${bucketId}`, credAccessKeyId());
        localStorage.setItem(`r2_secret_access_key_${bucketId}`, credSecretAccessKey());
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
    setCredAccessKeyId(localStorage.getItem(`r2_access_key_id_${bucket.id}`) || "");
    setCredSecretAccessKey(localStorage.getItem(`r2_secret_access_key_${bucket.id}`) || "");
    setShowBucketForm(true);
  };

  const connectToBucket = async (bucket: Bucket) => {
    const accessKeyId = localStorage.getItem(`r2_access_key_id_${bucket.id}`) || "";
    const secretAccessKey = localStorage.getItem(`r2_secret_access_key_${bucket.id}`) || "";

    if (!accessKeyId || !secretAccessKey) {
      alert("Please enter credentials for this bucket in the bucket form first.");
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

      window.location.href = "/";
    } catch (e) {
      console.error("Failed to connect:", e);
      alert("Failed to connect to bucket");
    }
  };

  const getOrgBuckets = (orgId: string) => buckets().filter((b) => b.orgId === orgId);

  const handleConnected = () => {
    loadData();
  };

  return (
    <div class="h-screen flex flex-col bg-[var(--bg-primary)]">
      <Nav onConnected={handleConnected} />

      <div class="flex-1 overflow-auto p-6">
        <div class="max-w-3xl mx-auto">
          <div class="flex items-center gap-3 mb-6">
            <A href="/" class="btn-icon">
              <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </A>
            <h1 class="text-xl font-semibold">Settings</h1>
          </div>

          <Show when={!loading()} fallback={
            <div class="flex items-center justify-center py-16">
              <div class="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <div class="space-y-6">
              <section class="card p-4">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-2">
                    <svg class="w-[18px] h-[18px] text-[var(--accent)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" /></svg>
                    <h2 class="text-base font-medium">Organizations</h2>
                  </div>
                  <Show when={!showOrgForm()}>
                    <button type="button" onClick={() => setShowOrgForm(true)} class="btn-primary text-sm">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                      Add Org
                    </button>
                  </Show>
                </div>

                <Show when={showOrgForm()}>
                  <div class="mb-4 p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-subtle)]">
                    <div class="grid grid-cols-2 gap-3 mb-3">
                      <input
                        type="text"
                        value={orgName()}
                        onInput={(e) => setOrgName(e.currentTarget.value)}
                        placeholder="Organization name"
                        class="input"
                      />
                      <input
                        type="text"
                        value={orgDescription()}
                        onInput={(e) => setOrgDescription(e.currentTarget.value)}
                        placeholder="Description (optional)"
                        class="input"
                      />
                    </div>
                    <div class="flex gap-2">
                      <button type="button" onClick={handleSaveOrg} class="btn-primary text-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                        {editingOrg() ? "Update" : "Create"}
                      </button>
                      <button type="button" onClick={resetOrgForm} class="btn-ghost text-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        Cancel
                      </button>
                    </div>
                  </div>
                </Show>

                <Show when={orgs().length === 0 && !showOrgForm()}>
                  <div class="text-sm text-[var(--text-muted)] py-4 text-center bg-[var(--bg-tertiary)] rounded-lg">
                    No organizations yet
                  </div>
                </Show>

                <div class="space-y-2">
                  <For each={orgs()}>
                    {(org) => (
                      <div class="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors">
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium">{org.name}</div>
                          <Show when={org.description}>
                            <div class="text-xs text-[var(--text-muted)] mt-0.5">{org.description}</div>
                          </Show>
                          <div class="text-xs text-[var(--text-tertiary)] mt-1">
                            {getOrgBuckets(org.id).length} bucket(s)
                          </div>
                        </div>
                        <div class="flex gap-1 ml-3">
                          <button
                            type="button"
                            onClick={() => setSelectedOrgId(selectedOrgId() === org.id ? null : org.id)}
                            class={`btn-ghost text-sm px-2.5 ${selectedOrgId() === org.id ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : ""}`}
                          >
                            {selectedOrgId() === org.id ? "Hide" : "Buckets"}
                          </button>
                          <button type="button" onClick={() => startEditOrg(org)} class="btn-icon" title="Edit">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button type="button" onClick={() => handleDeleteOrg(org.id)} class="btn-icon text-[var(--error)]" title="Delete">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </section>

              <Show when={selectedOrgId()}>
                <section class="card p-4">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                      <svg class="w-[18px] h-[18px] text-[var(--warning)]" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h16v12H5.17L4 17.17V4m0-2c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4zm2 10h12v2H6v-2zm0-3h12v2H6V9zm0-3h12v2H6V6z" /></svg>
                      <h2 class="text-base font-medium">Buckets</h2>
                    </div>
                    <Show when={!showBucketForm()}>
                      <button type="button" onClick={() => setShowBucketForm(true)} class="btn-primary text-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                        Add Bucket
                      </button>
                    </Show>
                  </div>

                  <Show when={showBucketForm()}>
                    <div class="mb-4 p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-subtle)]">
                      <div class="grid grid-cols-2 gap-3 mb-3">
                        <input
                          type="text"
                          value={bucketName()}
                          onInput={(e) => setBucketName(e.currentTarget.value)}
                          placeholder="Bucket name (display)"
                          class="input col-span-2"
                        />
                        <input
                          type="text"
                          value={bucketEndpoint()}
                          onInput={(e) => setBucketEndpoint(e.currentTarget.value)}
                          placeholder="Endpoint (e.g. https://...)"
                          class="input col-span-2"
                        />
                        <input
                          type="text"
                          value={bucketRegion()}
                          onInput={(e) => setBucketRegion(e.currentTarget.value)}
                          placeholder="Region (e.g. auto)"
                          class="input"
                        />
                        <input
                          type="text"
                          value={bucketBucketName()}
                          onInput={(e) => setBucketBucketName(e.currentTarget.value)}
                          placeholder="Bucket name (S3)"
                          class="input"
                        />
                      </div>
                      <div class="mb-3 p-3 bg-[var(--bg-secondary)] rounded border border-[var(--border-subtle)]">
                        <div class="text-xs font-medium text-[var(--text-secondary)] mb-2">Credentials (stored in browser)</div>
                        <div class="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Access Key ID"
                            class="input"
                            value={credAccessKeyId()}
                            onInput={(e) => setCredAccessKeyId(e.currentTarget.value)}
                          />
                          <input
                            type="password"
                            placeholder="Secret Access Key"
                            class="input"
                            value={credSecretAccessKey()}
                            onInput={(e) => setCredSecretAccessKey(e.currentTarget.value)}
                          />
                        </div>
                      </div>
                      <div class="flex gap-2">
                        <button type="button" onClick={handleSaveBucket} class="btn-primary text-sm">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                          {editingBucket() ? "Update" : "Create"}
                        </button>
                        <button type="button" onClick={resetBucketForm} class="btn-ghost text-sm">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </Show>

                  <Show when={getOrgBuckets(selectedOrgId()!).length === 0 && !showBucketForm()}>
                    <div class="text-sm text-[var(--text-muted)] py-4 text-center bg-[var(--bg-tertiary)] rounded-lg">
                      No buckets yet
                    </div>
                  </Show>

                  <div class="space-y-2">
                    <For each={getOrgBuckets(selectedOrgId()!)}>
                      {(bucket) => (
                        <div class="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors">
                          <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium flex items-center gap-2">
                              {bucket.name}
                            </div>
                            <div class="text-xs text-[var(--text-tertiary)] mt-0.5 font-mono">{bucket.bucketName}</div>
                            <div class="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                              {bucket.endpoint}
                            </div>
                          </div>
                          <div class="flex gap-1 ml-3">
                            <button
                              type="button"
                              onClick={() => connectToBucket(bucket)}
                              class="btn-primary text-sm px-3"
                            >
                              Connect
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditBucket(bucket)}
                              class="btn-icon"
                              title="Edit"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBucket(bucket.id)}
                              class="btn-icon text-[var(--error)]"
                              title="Delete"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
