"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/admin/ImageUploader";
import { createClient } from "@/lib/supabase/client";

type GalleryItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  image_path: string;
  is_published: boolean;
  sort_order: number;
};

const emptyForm = {
  title: "",
  description: "",
  image_url: null as string | null,
  image_path: null as string | null,
  is_published: true,
  sort_order: "0",
};

export default function GalleryAdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    await loadGallery();
  }

  async function loadGallery() {
    setLoading(true);

    const { data, error } = await supabase
      .from("gallery_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setItems(data || []);
    }

    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function editItem(item: GalleryItem) {
    setEditingId(item.id);

    setForm({
      title: item.title,
      description: item.description || "",
      image_url: item.image_url,
      image_path: item.image_path,
      is_published: item.is_published,
      sort_order: String(item.sort_order),
    });

    setMessage("");
    setError("");
  }

  async function deleteImage(path: string) {
    const { error } = await supabase.storage.from("hair-artisan-images").remove([path]);

    if (error) {
      console.warn(error);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    if (!form.title.trim()) {
      setError("Please enter a title.");
      setSaving(false);
      return;
    }

    if (!form.image_url || !form.image_path) {
      setError("Please upload a photo.");
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url,
      image_path: form.image_path,
      is_published: form.is_published,
      sort_order: Number(form.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const oldItem = items.find((item) => item.id === editingId);

        const { error } = await supabase
          .from("gallery_items")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;

        if (oldItem?.image_path && oldItem.image_path !== form.image_path) {
          await deleteImage(oldItem.image_path);
        }

        setMessage("Recent work updated.");
      } else {
        const { error } = await supabase.from("gallery_items").insert(payload);

        if (error) throw error;

        setMessage("Recent work uploaded.");
      }

      await loadGallery();
      resetForm();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not save the photo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: GalleryItem) {
    if (!window.confirm(`Delete "${item.title}" from Recent Work?`)) {
      return;
    }

    const { error } = await supabase.from("gallery_items").delete().eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    await deleteImage(item.image_path);

    setItems((current) => current.filter((galleryItem) => galleryItem.id !== item.id));

    setMessage("Photo deleted.");
  }

  async function togglePublished(item: GalleryItem) {
    const { error } = await supabase
      .from("gallery_items")
      .update({
        is_published: !item.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    setItems((current) =>
      current.map((galleryItem) =>
        galleryItem.id === item.id
          ? { ...galleryItem, is_published: !galleryItem.is_published }
          : galleryItem
      )
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

            <h1 className="mt-1 text-3xl font-semibold">Recent Work</h1>

            <p className="mt-2 text-sm text-neutral-600">
              Upload and manage the photos displayed on your website.
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
            {loading ? (
              <div className="rounded-2xl border bg-white p-8">Loading recent work...</div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border bg-white p-12 text-center">
                <h2 className="font-semibold">No recent work yet</h2>

                <p className="mt-2 text-sm text-neutral-500">
                  Upload your first photo using the form.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {items.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-2xl border bg-white">
                    <div className="aspect-[4/3] bg-neutral-100">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{item.title}</h2>

                          {item.description && (
                            <p className="mt-1 text-sm text-neutral-500">{item.description}</p>
                          )}
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            item.is_published
                              ? "bg-green-100 text-green-700"
                              : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {item.is_published ? "Published" : "Hidden"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => editItem(item)}
                          className="rounded-lg border px-3 py-2 text-xs font-medium"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void togglePublished(item)}
                          className="rounded-lg border px-3 py-2 text-xs font-medium"
                        >
                          {item.is_published ? "Hide" : "Publish"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="sticky top-6 rounded-2xl border bg-white p-5">
              <h2 className="text-xl font-semibold">
                {editingId ? "Edit Recent Work" : "Upload Recent Work"}
              </h2>

              <p className="mb-6 mt-1 text-sm text-neutral-500">
                You can replace the photo whenever you want.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">Title</label>

                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Fresh Fade"
                    className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Description</label>

                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="A recent Hair Artisan look..."
                    className="w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <ImageUploader
                  value={form.image_url}
                  folder="gallery"
                  label="Work photo"
                  onChange={(url, path) => setForm({ ...form, image_url: url, image_path: path })}
                />

                <div>
                  <label className="mb-2 block text-sm font-medium">Display order</label>

                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    className="w-full rounded-xl border px-4 py-3"
                  />
                </div>

                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Show this photo on the website
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Upload Photo"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full rounded-xl border px-5 py-3 text-sm font-medium"
                  >
                    Cancel
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