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
      // Check if this is a folder (no URL means it's a folder)
      if (!bookmark.url) {
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
 * Deletes all top-level "RaindropSync" folders from browser bookmarks.
 * This function gets the bookmark tree and removes all root folders with that name.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function deleteExistingRaindropSyncFolder() {
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const foldersToDelete = [];

    // Traverse the root nodes of the bookmark tree
    for (const rootNode of bookmarkTree) {
      if (rootNode.children) {
        for (const child of rootNode.children) {
          // Check for top-level folders named "RaindropSync"
          if (!child.url && child.title === 'RaindropSync') {
            foldersToDelete.push(child.id);
          }
        }
      }
    }

    // Delete all found folders
    for (const folderId of foldersToDelete) {
      console.log(`Deleting existing RaindropSync folder: ${folderId}`);
      await chrome.bookmarks.removeTree(folderId);
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
export async function createCollectionFolderStructure(collectionTree) {
  const collectionToFolderMap = new Map();

  try {
    // Find the bookmark bar
    const bookmarksBar = await findBookmarkBar();

    // Create the main "RaindropSync" folder
    const raindropSyncFolder = await chrome.bookmarks.create({
      parentId: bookmarksBar.id,
      title: 'RaindropSync',
    });
    console.log('Created main RaindropSync folder');

    // Recursive function to create collection folders
    async function createFolderRecursive(parentFolderId, collections) {
      for (const collection of collections) {
        try {
          const folder = await chrome.bookmarks.create({
            parentId: parentFolderId,
            title: collection.title,
          });
          console.log(`Created collection folder: ${collection.title}`);

          if (collection.id === 'unsorted') {
            collectionToFolderMap.set('unsorted', folder.id);
            collectionToFolderMap.set(0, folder.id);
          } else {
            collectionToFolderMap.set(collection.id, folder.id);
          }

          if (collection.children && collection.children.length > 0) {
            await createFolderRecursive(folder.id, collection.children);
          }
        } catch (error) {
          console.error(
            `Error creating collection folder: ${collection.title}`,
            error,
          );
        }
      }
    }

    // Start creating the folder structure from the collection tree
    await createFolderRecursive(raindropSyncFolder.id, collectionTree);
    console.log(
      `Created ${collectionToFolderMap.size} collection folders.`,
    );
  } catch (error) {
    console.error('Error creating collection folder structure:', error);
    throw error; // Re-throw the error to be caught by the caller
  }

  return collectionToFolderMap;
}

/**
 * Finds the bookmark bar folder.
 * @returns {Promise<Object>} The bookmark bar folder object
 */
async function findBookmarkBar() {
  const bookmarkTree = await chrome.bookmarks.getTree();
  const rootNode = bookmarkTree[0];

  if (rootNode.children) {
    // Look for a folder named "Bookmarks bar" or "Bookmarks Bar"
    const bar = rootNode.children.find(
      (child) =>
        !child.url &&
        (child.title === 'Bookmarks bar' || child.title === 'Bookmarks Bar'),
    );
    if (bar) return bar;

    // Fallback: return the first folder that is not 'Other Bookmarks' or 'Mobile Bookmarks'
    const fallback = rootNode.children.find(
      (child) =>
        !child.url &&
        child.title !== 'Other Bookmarks' &&
        child.title !== 'Mobile Bookmarks',
    );
    if (fallback) return fallback;

    // Final fallback: return the first folder
    const firstFolder = rootNode.children.find((child) => !child.url);
    if (firstFolder) return firstFolder;
  }

  throw new Error('Could not find the bookmark bar.');
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
