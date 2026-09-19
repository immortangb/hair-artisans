// ============================================================
// HAIR ARTISAN'S SERVICE IMAGE MAPPING
// ============================================================
//
// The supplied photographs are stored in:
//
// public/images/gallery/
//
// The helper below gives services sensible photographs without
// requiring image URLs to be stored in Supabase.
//
// ============================================================

const galleryImages = [
  "/images/gallery/gallery-01.jpeg",
  "/images/gallery/gallery-02.jpeg",
  "/images/gallery/gallery-03.jpeg",
  "/images/gallery/gallery-04.jpeg",
  "/images/gallery/gallery-05.jpeg",
  "/images/gallery/gallery-06.jpeg",
  "/images/gallery/gallery-07.jpeg",
  "/images/gallery/gallery-08.jpeg",
  "/images/gallery/gallery-09.jpeg",
  "/images/gallery/gallery-10.jpeg",
  "/images/gallery/gallery-11.jpeg",
  "/images/gallery/gallery-12.jpeg",
  "/images/gallery/gallery-13.jpeg",
  "/images/gallery/gallery-14.jpeg",
];

export function getServiceImage(
  serviceName: string,
  serviceId?: number
): string {
  const name = serviceName.trim().toLowerCase();

  // Try to make the image selection meaningful based on service name.

  if (
    name.includes("kids") ||
    name.includes("kid")
  ) {
    return galleryImages[0] ?? galleryImages[0];
  }

  if (
    name.includes("beard")
  ) {
    return galleryImages[1] ?? galleryImages[0];
  }

  if (
    name.includes("bleach") ||
    name.includes("dye")
  ) {
    return galleryImages[2] ?? galleryImages[0];
  }

  if (
    name.includes("fade")
  ) {
    return galleryImages[3] ?? galleryImages[0];
  }

  // Fall back to a deterministic image based on service ID.

  if (serviceId) {
    const index =
      Math.abs(serviceId) % galleryImages.length;

    return galleryImages[index] ?? galleryImages[0];
  }

  return galleryImages[0];
}

export function getGalleryImages(): string[] {
  return galleryImages;
}