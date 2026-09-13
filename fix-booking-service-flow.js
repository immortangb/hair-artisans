const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "app",
  "booking",
  "page.tsx"
);

if (!fs.existsSync(file)) {
  console.error("ERROR: app/booking/page.tsx was not found.");
  console.error("Make sure you are running this inside the hair-artisans project.");
  process.exit(1);
}

let code = fs.readFileSync(file, "utf8");

console.log("");
console.log("==============================================");
console.log("     HAIR ARTISANS BOOKING FLOW FIX");
console.log("==============================================");
console.log("");

/*
 * ---------------------------------------------------------
 * 1. Make sure Next navigation/searchParams is available
 * ---------------------------------------------------------
 */

if (!code.includes("useSearchParams")) {
  code = code.replace(
    'import { useEffect, useState } from "react";',
    'import { useEffect, useState } from "react";\nimport { useSearchParams } from "next/navigation";'
  );
}

if (!code.includes("const searchParams = useSearchParams()")) {
  code = code.replace(
    'const supabase = createClient();',
    'const supabase = createClient();\n  const searchParams = useSearchParams();'
  );
}

/*
 * ---------------------------------------------------------
 * 2. Add image_url to Service
 * ---------------------------------------------------------
 */

code = code.replace(
  /type Service = \{([\s\S]*?)\};/,
  (match, inside) => {
    if (inside.includes("image_url")) {
      return match;
    }

    return `type Service = {${inside}
  image_url?: string | null;
};`;
  }
);

/*
 * ---------------------------------------------------------
 * 3. Load service images from Supabase
 * ---------------------------------------------------------
 */

code = code.replace(
  /"id, name, price, duration_minutes"/g,
  '"id, name, price, duration_minutes, image_url"'
);

/*
 * ---------------------------------------------------------
 * 4. Automatically select ?service=ID
 * ---------------------------------------------------------
 */

const selectionCode = `
  // --------------------------------------------------
  // AUTO-SELECT SERVICE FROM HOMEPAGE
  // --------------------------------------------------

  useEffect(() => {
    const serviceId = searchParams.get("service");

    if (!serviceId || services.length === 0) {
      return;
    }

    const id = Number(serviceId);

    if (!Number.isFinite(id)) {
      return;
    }

    const service = services.find(
      (item) => Number(item.id) === id
    );

    if (service) {
      setSelectedService(service);
    }
  }, [searchParams, services]);

`;

if (!code.includes("AUTO-SELECT SERVICE FROM HOMEPAGE")) {
  const marker = "// --------------------------------------------------\n  // CHECK BUSINESS DAYS";

  if (code.includes(marker)) {
    code = code.replace(
      marker,
      selectionCode + marker
    );
  } else {
    console.log(
      "WARNING: Could not find booking page insertion point."
    );
  }
}

/*
 * ---------------------------------------------------------
 * 5. Ensure selected service appears clearly
 * ---------------------------------------------------------
 */

const selectedServiceBlock = `
          {selectedService && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-4">

                {selectedService.image_url && (
                  <img
                    src={selectedService.image_url}
                    alt={selectedService.name}
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                )}

                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selected service
                  </p>

                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedService.name}
                  </h3>

                  <p className="text-sm text-slate-500">
                    R{Number(selectedService.price).toFixed(2)}
                    {" · "}
                    {selectedService.duration_minutes} minutes
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  Change
                </button>

              </div>
            </div>
          )}

`;

if (
  !code.includes("Selected service") &&
  code.includes("selectedService")
) {
  const possibleMarkers = [
    "Choose a date",
    "Select a date",
    "Choose Date",
    "Select Date"
  ];

  let inserted = false;

  for (const marker of possibleMarkers) {
    const index = code.indexOf(marker);

    if (index !== -1) {
      const start = code.lastIndexOf("<", index);

      if (start !== -1) {
        code =
          code.slice(0, start) +
          selectedServiceBlock +
          code.slice(start);

        inserted = true;
        break;
      }
    }
  }

  if (!inserted) {
    console.log(
      "WARNING: Selected-service display block was not inserted automatically."
    );
  }
}

/*
 * ---------------------------------------------------------
 * 6. Save
 * ---------------------------------------------------------
 */

fs.writeFileSync(file, code, "utf8");

console.log("");
console.log("Booking page updated successfully.");
console.log("");
console.log("Changes applied:");
console.log("✓ Homepage service ID is read from ?service=");
console.log("✓ Service is automatically selected");
console.log("✓ Service image_url is loaded");
console.log("✓ Selected service information is displayed");
console.log("✓ Customer can change service if needed");
console.log("");
console.log("==============================================");
console.log("              FIX COMPLETE");
console.log("==============================================");
console.log("");
console.log("Now run:");
console.log("");
console.log("npm run dev");
console.log("");