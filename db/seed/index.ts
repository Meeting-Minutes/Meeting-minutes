import { seeds } from "./seeds";

async function main() {
  console.log("Seeding database...");

  for (const seed of seeds) {
    console.log(`Running ${seed.name}...`);
    await seed();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
