import { seedPermissions } from "./permissions";
import { seedUsers } from "./users";
import { seedDemo } from "./demo";

export const seeds = [seedPermissions, seedUsers, seedDemo];
