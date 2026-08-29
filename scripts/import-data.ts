import path from "path";
import { fileURLToPath } from "url";
import { importService } from "../src/services/import.service.js";
import { logger } from "../src/utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const filePath = process.argv[2] || path.resolve(__dirname, "../data/import.json");
  logger.info(`Starting data import from: ${filePath}`);

  const result = await importService.importFromFile(filePath);

  console.log("\n=================================");
  console.log("DATA RE-IMPORT REPORT");
  console.log("=================================");
  console.log(`Success:                   ${result.success ? "YES" : "NO"}`);
  console.log(`Imported / Updated Users:  ${result.importedUsers}`);
  console.log(`Imported People (Contacts):${result.importedPeople}`);
  console.log(`Imported Notes:            ${result.importedNotes}`);
  console.log(`Imported Reminders:        ${result.importedReminders}`);
  console.log(`Imported Birthday Offsets: ${result.importedBirthdayReminders}`);
  if (result.errors.length > 0) {
    console.log(`Errors encountered:        ${result.errors.length}`);
    result.errors.forEach((err, idx) => console.log(`  ${idx + 1}. ${err}`));
  }
  console.log("=================================\n");

  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  logger.error("Fatal error during data import:", err);
  process.exit(1);
});
