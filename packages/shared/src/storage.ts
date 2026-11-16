/** Browser storage locations, scoped per signed-in account when there is one. */
export type StoredCollection = "characters" | "creatures" | "campaigns";

/** Location used before storage was versioned; read once as a migration source. */
export const LEGACY_CHARACTERS_LOCATION = "characters";

export function storageLocation(collection: StoredCollection, accountId?: string): string {
  return accountId ? `grimoire.users.${accountId}.${collection}.v1` : `grimoire.${collection}.v1`;
}

export function isGuestLocation(location: string, collection: StoredCollection): boolean {
  return location === storageLocation(collection);
}
