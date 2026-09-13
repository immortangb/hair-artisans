const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const bookingFile = path.join(
  projectRoot,
  "app",
  "booking",
  "page.tsx"
);

if (!fs.existsSync(bookingFile)) {
  console.error("");
  console.error("ERROR: Could not find:");
  console.error("app/booking/page.tsx");
  console.error("");
  console.error("Make sure this script is inside your hair-artisans folder.");
  process.exit(1);
}

let source = fs.readFileSync(bookingFile, "utf8");

console.log("");
console.log("Updating Hair Artisan's Barbershop booking hours...");
console.log("");

/*
|--------------------------------------------------------------------------
| Replace common 09:00 opening-hour references
|--------------------------------------------------------------------------
*/

const replacements = [
  {
    oldText: "09:00",
    newText: "10:00",
  },
];

let changed = false;

for (const replacement of replacements) {
  if (source.includes(replacement.oldText)) {
    source = source.replace(
      new RegExp(
        replacement.oldText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "g"
      ),
      replacement.newText
    );

    changed = true;
  }
}

if (!changed) {
  console.log(
    "WARNING: No 09:00 value was found in app/booking/page.tsx."
  );
  console.log(
    "Your booking page may already use a different time-generation system."
  );
  console.log("");
  process.exit(0);
}

fs.writeFileSync(bookingFile, source, "utf8");

console.log("SUCCESS!");
console.log("");
console.log("New website booking start time: 10:00");
console.log("Closing time: 17:00");
console.log("");
console.log("Existing 09:00 and 09:30 database bookings were NOT changed.");
console.log("");