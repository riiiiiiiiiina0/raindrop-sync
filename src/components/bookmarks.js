/**
 * Deletes the existing "Raindrop" folder from browser bookmarks.
 * This function searches for the folder by title and deletes it.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function deleteExistingRaindropFolder() {
  try {
    // Search for existing Raindrop folder
    const searchResults = await chrome.bookmarks.search({ title: 'Raindrop' });

    for (const bookmark of searchResults) {
      // Check if this is a folder (no URL) and it's at the top level (parentId 0/1/2/3)
      if (
        !bookmark.url &&
        ['0', '1', '2', '3'].includes(bookmark.parentId ?? '')
      ) {
        console.log(`Deleting existing Raindrop folder: ${bookmark.id}`);
        await chrome.bookmarks.removeTree(bookmark.id);
      }
    }
  } catch (error) {
    console.error('Error deleting existing Raindrop folder:', error);
    throw error;
  }
}

/**
 * Deletes the existing "RaindropSync" folder from browser bookmarks.
 * This function searches for the folder by title and deletes it.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function deleteExistingRaindropSyncFolder() {
  try {
    // Search for existing RaindropSync folder
    const searchResults = await chrome.bookmarks.search({
      title: 'RaindropSync',
    });

    for (const bookmark of searchResults) {
      // Check if this is a folder (no URL) and it's at the top level (parentId 0/1/2/3)
      if (
        !bookmark.url &&
        ['0', '1', '2', '3'].includes(bookmark.parentId ?? '')
      ) {
        console.log(`Deleting existing RaindropSync folder: ${bookmark.id}`);
        await chrome.bookmarks.removeTree(bookmark.id);
      }
    }
  } catch (error) {
    console.error('Error deleting existing RaindropSync folder:', error);
    throw error;
  }
}

/**
 * Finds a child folder with given title under parent or creates it if missing.
 * Returns the folder node.
 */
export async function findOrCreateFolderByTitle(parentId, title) {
  // Look for existing child folder with exact title
  const children = await chrome.bookmarks.getChildren(parentId);
  const existing = children.find((n) => !n.url && n.title === title);
  if (existing) return existing;
  // Create new folder if not found
  return await chrome.bookmarks.create({ parentId, title });
}

/**
 * Ensures the collection/group folder structure exists under parent, creating
 * only what is missing and reusing existing nodes by title. Returns a
 * Map of collectionId (or 'unsorted') to folderId for quick lookup.
 * Accepts tree produced by buildCollectionTreeWithGroups.
 */
export async function ensureCollectionFolderStructure(parentId, collectionTree) {
  const collectionToFolderMap = new Map();

  // Load existing mapping from storage to keep stable folder IDs across renames
  const stored = await chrome.storage.local.get(['collectionFolderMap']);
  /** @type {Record<string,string>} */
  const idToFolderId = stored.collectionFolderMap || {};

  async function ensureNodeFolder(currentParentId, node) {
    // Try by stored mapping first when node represents a real collection (not group)
    let folder = null;
    if (!node.isGroup && node.id != null) {
      const key = String(node.id);
      const mappedId = idToFolderId[key];
      if (mappedId) {
        try {
          const result = await chrome.bookmarks.get(mappedId);
          if (result && result.length > 0 && !result[0].url) {
            folder = result[0];
            // Ensure it is under correct parent; if not, move it
            if (folder.parentId !== currentParentId) {
              folder = await chrome.bookmarks.move(folder.id, {
                parentId: currentParentId,
              });
            }
            // Update title if renamed in Raindrop
            if (folder.title !== node.title) {
              await chrome.bookmarks.update(folder.id, { title: node.title });
              folder.title = node.title;
            }
          }
        } catch (e) {
          // If get fails (deleted), we will create anew
        }
      }
    }

    if (!folder) {
      // Fallback: find or create by title under current parent
      folder = await findOrCreateFolderByTitle(currentParentId, node.title);
    }

    // Remember mapping for future runs
    if (node.id != null && !node.isGroup) {
      idToFolderId[String(node.id)] = folder.id;
    }

    // Map collection IDs to folder IDs for this run
    if (node.id === 'unsorted') {
      collectionToFolderMap.set('unsorted', folder.id);
      collectionToFolderMap.set(0, folder.id);
    } else if (!node.isGroup && node.id != null) {
      collectionToFolderMap.set(node.id, folder.id);
    }

    return folder;
  }

  async function ensureRecursive(currentParentId, nodes) {
    for (const node of nodes) {
      try {
        const folder = await ensureNodeFolder(currentParentId, node);
        if (node.children && node.children.length > 0) {
          await ensureRecursive(folder.id, node.children);
        }
      } catch (error) {
        console.error(`Error ensuring folder for: ${node.title}`, error);
        // Continue with others even if one fails
      }
    }
  }

  await ensureRecursive(parentId, collectionTree);
  // Persist updated mapping
  await chrome.storage.local.set({ collectionFolderMap: idToFolderId });
  return collectionToFolderMap;
}

/**
 * Creates bookmark folder structure from collection tree.
 * This function creates a hierarchical folder structure based on Raindrop collections.
 *
 * @async
 * @param {string} parentId - The ID of the parent folder.
 * @param {Array} collectionTree - The hierarchical collection tree structure.
 * @returns {Promise<Object>} Map of collection IDs to bookmark folder IDs.
 */
export async function createCollectionFolderStructure(
  parentId,
  collectionTree,
) {
  const collectionToFolderMap = new Map();

  async function createFolderRecursive(parentFolderId, collections) {
    // Collections are already sorted by the buildCollectionTree function
    for (const collection of collections) {
      try {
        // Create folder for this collection
        const folder = await chrome.bookmarks.create({
          parentId: parentFolderId,
          title: collection.title,
        });

        console.log(`Created collection folder: ${collection.title}`);

        // Map collection ID to folder ID for later use
        // Special handling for the Unsorted folder
        if (collection.id === 'unsorted') {
          collectionToFolderMap.set('unsorted', folder.id);
          // Also map ID 0 to unsorted folder (Raindrop uses collection ID 0 for unsorted)
          collectionToFolderMap.set(0, folder.id);
        } else {
          collectionToFolderMap.set(collection.id, folder.id);
        }

        // Recursively create children folders
        if (collection.children && collection.children.length > 0) {
          await createFolderRecursive(folder.id, collection.children);
        }
      } catch (error) {
        console.error(
          `Error creating collection folder: ${collection.title}`,
          error,
        );
        // Continue with other collections even if one fails
      }
    }
  }

  await createFolderRecursive(parentId, collectionTree);
  console.log(
    `Created ${collectionToFolderMap.size} collection folders with proper sorting`,
  );
  return collectionToFolderMap;
}

/**
 * Creates bookmarks from a parsed structure.
 * This function creates folders and bookmarks from the given structure.
 *
 * @async
 * @param {string} parentId - The ID of the parent folder.
 * @param {Array} bookmarkStructure - The parsed bookmark structure.
 */
export async function createBookmarksFromStructure(
  parentId,
  bookmarkStructure,
) {
  for (const item of bookmarkStructure) {
    try {
      if (item.type === 'folder') {
        // Create folder
        const folder = await chrome.bookmarks.create({
          parentId: parentId,
          title: item.title,
        });

        console.log(`Created folder: ${item.title}`);

        // Recursively create children
        if (item.children && item.children.length > 0) {
          await createBookmarksFromStructure(folder.id, item.children);
        }
      } else if (item.type === 'bookmark') {
        // Create bookmark
        if (item.url) {
          await chrome.bookmarks.create({
            parentId: parentId,
            title: item.title,
            url: item.url,
          });

          console.log(`Created bookmark: ${item.title} -> ${item.url}`);
        }
      }
    } catch (error) {
      console.error(`Error creating ${item.type}: ${item.title}`, error);
      // Continue with other items even if one fails
    }
  }
}
