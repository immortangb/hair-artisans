"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/admin/ImageUploader";
import { createClient } from "@/lib/supabase/client";

type Service = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  category: string | null;
  image_url: string | null;
  image_path: string | null;
  active: boolean;
};

const emptyForm = {
  name: "",
  description: "",
  price: "",
  duration_minutes: "30",
  category: "Haircuts",
  image_url: null as string | null,
  image_path: null as string | null,
};

export default function ServicesAdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/admin/login");
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    setCheckingAuth(false);
    await loadServices();
  }

  async function loadServices() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("services")
      .select(
        "id,name,description,price,duration_minutes,category,image_url,image_path,active"
      )
      .order("name");

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setServices(data || []);
    }

    setLoading(false);
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  function startEdit(service: Service) {
    setEditingId(service.id);

    setForm({
      name: service.name || "",
      description: service.description || "",
      price: String(service.price),
      duration_minutes:
        service.duration_minutes !== null && service.duration_minutes !== undefined
          ? String(service.duration_minutes)
          : "30",
      category: service.category || "Haircuts",
      image_url: service.image_url,
      image_path: service.image_path,
    });

    setMessage("");
    setError("");
  }

  async function deleteImage(path: string | null) {
    if (!path) return;

    const { error } = await supabase.storage.from("hair-artisan-images").remove([path]);

    if (error) {
      console.warn("Could not delete image:", error);
    }
  }

  async function handleDelete(service: Service) {
    const confirmed = window.confirm(`Delete "${service.name}"? This cannot be undone.`);

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error } = await supabase.from("services").delete().eq("id", service.id);

    if (error) {
      setError(error.message);
      return;
    }

    await deleteImage(service.image_path);

    setServices((current) => current.filter((item) => item.id !== service.id));

    if (editingId === service.id) {
      startAdd();
    }

    setMessage("Service deleted.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    if (!form.name.trim()) {
      setError("Please enter a service name.");
      setSaving(false);
      return;
    }

    if (!form.price || Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      setError("Please enter a valid price.");
      setSaving(false);
      return;
    }

    const duration = Number(form.duration_minutes);

    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Please enter a valid duration.");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      duration_minutes: duration,
      category: form.category.trim() || null,
      image_url: form.image_url,
      image_path: form.image_path,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId !== null) {
        const { error } = await supabase.from("services").update(payload).eq("id", editingId);

        if (error) {
          throw error;
        }

        setMessage("Service updated successfully.");
      } else {
        const { error } = await supabase.from("services").insert({
          ...payload,
          active: true,
        });

        if (error) {
          throw error;
        }

        setMessage("Service added successfully.");
      }

      await loadServices();

      if (editingId === null) {
        setForm(emptyForm);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not save service.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: Service) {
    const { error } = await supabase
      .from("services")
      .update({
        active: !service.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", service.id);

    if (error) {
      setError(error.message);
      return;
    }

    setServices((current) =>
      current.map((item) => (item.id === service.id ? { ...item, active: !item.active } : item))
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-sm text-neutral-500">Checking access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
              Hair Artisan
            </p>

            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Service Management</h1>

            <p className="mt-2 text-sm text-neutral-600">
              Add, edit and manage the services shown to customers.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/admin/dashboard")}
              className="rounded-xl border px-4 py-3 text-sm font-medium hover:bg-neutral-50"
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Logout
            </button>

            <button
              type="button"
              onClick={startAdd}
              className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              + Add Service
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <section>
            <div className="rounded-2xl border bg-white">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">Your Services</h2>
              </div>

              {loading ? (
                <div className="p-8 text-sm text-neutral-500">Loading services...</div>
              ) : services.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-medium">No services yet</p>

                  <p className="mt-1 text-sm text-neutral-500">
                    Add your first service using the button above.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {services.map((service) => (
                    <div key={service.id} className="flex gap-4 p-4">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                        {service.image_url ? (
                          <img
                            src={service.image_url}
                            alt={service.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                            No photo
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{service.name}</h3>

                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              service.active
                                ? "bg-green-100 text-green-700"
                                : "bg-neutral-100 text-neutral-500"
                            }`}
                          >
                            {service.active ? "Active" : "Hidden"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-neutral-500">
                          {service.category || "General"}
                          {" · "}
                          {service.duration_minutes || 0} min
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          R{Number(service.price).toFixed(2)}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(service)}
                            className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => void toggleActive(service)}
                            className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"
                          >
                            {service.active ? "Hide" : "Show"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDelete(service)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="sticky top-6 rounded-2xl border bg-white p-5">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">
                  {editingId !== null ? "Edit Service" : "Add Service"}
                </h2>

                <p className="mt-1 text-sm text-neutral-500">
                  Your photo can be changed at any time.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">Service name</label>

                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Classic Haircut"
                    className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Category</label>

                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Haircuts"
                    className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Description</label>

                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    placeholder="Describe the service..."
                    className="w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Price (R)</label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="250"
                      className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Duration</label>

                    <input
                      type="number"
                      min="1"
                      value={form.duration_minutes}
                      onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                      className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
                    />

                    <p className="mt-1 text-xs text-neutral-500">Minutes</p>
                  </div>
                </div>

                <ImageUploader
                  value={form.image_url}
                  folder="services"
                  label="Service photo"
                  onChange={(url, path) => setForm({ ...form, image_url: url, image_path: path })}
                />

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId !== null ? "Save Changes" : "Add Service"}
                </button>

                {editingId !== null && (
                  <button
                    type="button"
                    onClick={startAdd}
                    className="w-full rounded-xl border px-5 py-3 text-sm font-medium hover:bg-neutral-50"
                  >
                    Cancel Editing
                  </button>
                )}
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}