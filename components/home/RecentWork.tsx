"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type GalleryItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
};

export default function RecentWork() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    async function loadGallery() {
      const { data, error } = await supabase
        .from("gallery_items")
        .select("id,title,description,image_url")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) {
        console.error("Could not load Our Work:", error);
        return;
      }

      setItems((data || []) as GalleryItem[]);
    }

    void loadGallery();
  }, [supabase]);

  if (items.length === 0) return null;

  return (
    <section id="our-work" className="border-t border-neutral-200 bg-white px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">Our Work</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">See our work</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-neutral-600">
            Browse recent Hair Artisans styles before choosing your appointment.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <article key={item.id} className="group overflow-hidden rounded-2xl bg-neutral-100">
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="bg-white p-4">
                <h3 className="font-semibold">{item.title}</h3>
                {item.description && (
                  <p className="mt-1 text-sm text-neutral-500">{item.description}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
