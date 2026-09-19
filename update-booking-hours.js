const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/booking/page.tsx',
  'app/admin/dashboard/page.tsx',
  'app/admin/login/page.tsx',
  'app/admin/customers/page.tsx',
  'app/admin/services/page.tsx',
  'app/admin/gallery/page.tsx',
  'app/admin/website/page.tsx',
  'app/admin/calendar/page.tsx',
  'components/home/RecentWork.tsx',
  'lib/booking/config.ts',
];

const OLD_NAMES = ["Hair Artisan's", 'Hair Artisans', 'Hair Artisan'];
const NEW_NAME = "Hair-Artisan's Barbershop";

let changedFiles = 0;

for (const relative of files) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error(`Missing expected file: ${relative}`);
    process.exit(1);
  }

  let source = fs.readFileSync(file, 'utf8');
  const original = source;

  for (const oldName of OLD_NAMES) {
    source = source.split(oldName).join(NEW_NAME);
  }

  if (relative === 'lib/booking/config.ts') {
    source = source
      .replace(/Wednesday - Sunday = 09:00 - 17:00/g, 'Wednesday - Sunday = 10:00 - 17:00')
      .replace(/open: "09:00"/g, 'open: "10:00"');
  }

  source = source
    .replace(/09:00 – 17:00/g, '10:00 – 17:00')
    .replace(/09:00–17:00/g, '10:00–17:00')
    .replace(/09:00 to 17:00/g, '10:00 to 17:00');

  if (source !== original) {
    fs.writeFileSync(file, source, 'utf8');
    changedFiles += 1;
    console.log(`Updated ${relative}`);
  }
}

console.log('');
console.log('Hair-Artisan\'s Barbershop repair completed.');
console.log('New customer booking window: 10:00–17:00.');
console.log('Monday and Tuesday remain closed.');
console.log('Existing database bookings, including 09:00 and 09:30 bookings, were not modified.');
console.log(`Files changed: ${changedFiles}`);
