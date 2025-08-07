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
