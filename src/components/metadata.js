/**
 * This component manages sync metadata using chrome.storage.local.
 * It provides a simple key-value store for mappings between Raindrop items
 * and local bookmarks, as well as other sync-related data.
 */

const METADATA_PREFIX = 'rd-sync-meta_';

/**
 * Get a metadata value by key.
 * @param {string} key - The metadata key.
 * @returns {Promise<any>} The metadata value.
 */
export async function getMetadata(key) {
  const storageKey = `${METADATA_PREFIX}${key}`;
  const result = await chrome.storage.local.get([storageKey]);
  return result[storageKey];
}

/**
 * Set a metadata value by key.
 * @param {string} key - The metadata key.
 * @param {any} value - The metadata value.
 * @returns {Promise<void>}
 */
export async function setMetadata(key, value) {
  const storageKey = `${METADATA_PREFIX}${key}`;
  await chrome.storage.local.set({ [storageKey]: value });
}

/**
 * Get the mapping of Raindrop collection IDs to bookmark folder IDs.
 * @returns {Promise<Map<number, string>>} A map where keys are collection IDs and values are folder IDs.
 */
export async function getCollectionMapping() {
  const mapping = await getMetadata('collectionMapping');
  return new Map(mapping || []);
}

/**
 * Set the mapping of Raindrop collection IDs to bookmark folder IDs.
 * @param {Map<number, string>} mapping - The collection mapping to store.
 * @returns {Promise<void>}
 */
export async function setCollectionMapping(mapping) {
  await setMetadata('collectionMapping', Array.from(mapping.entries()));
}

/**
 * Get the mapping of Raindrop item IDs to bookmark IDs.
 * @returns {Promise<Map<number, string>>} A map where keys are raindrop IDs and values are bookmark IDs.
 */
export async function getRaindropMapping() {
  const mapping = await getMetadata('raindropMapping');
  return new Map(mapping || []);
}

/**
 * Set the mapping of Raindrop item IDs to bookmark IDs.
 * @param {Map<number, string>} mapping - The raindrop mapping to store.
 * @returns {Promise<void>}
 */
export async function setRaindropMapping(mapping) {
  await setMetadata('raindropMapping', Array.from(mapping.entries()));
}

/**
 * Get the last successful sync timestamp.
 * @returns {Promise<number>} The timestamp of the last sync.
 */
export async function getLastSyncTimestamp() {
  return (await getMetadata('lastSyncTimestamp')) || 0;
}

/**
 * Set the last successful sync timestamp.
 * @param {number} timestamp - The timestamp of the last sync.
 * @returns {Promise<void>}
 */
export async function setLastSyncTimestamp(timestamp) {
  await setMetadata('lastSyncTimestamp', timestamp);
}
