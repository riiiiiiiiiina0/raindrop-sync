export async function createBookmark(parentId, title, url) {
  return await chrome.bookmarks.create({
    parentId,
    title,
    url,
  });
}

export async function updateBookmark(bookmarkId, changes) {
  return await chrome.bookmarks.update(bookmarkId, changes);
}

export async function deleteBookmark(bookmarkId) {
  await chrome.bookmarks.remove(bookmarkId);
}

export async function createFolder(parentId, title) {
  return await chrome.bookmarks.create({
    parentId,
    title,
  });
}

export async function updateFolder(folderId, changes) {
  return await chrome.bookmarks.update(folderId, changes);
}

export async function deleteFolder(folderId) {
  await chrome.bookmarks.removeTree(folderId);
}

export async function getLocalBookmarks(rootFolderId) {
  const bookmarks = new Map();
  const nodesToVisit = [rootFolderId];
  while (nodesToVisit.length > 0) {
    const nodeId = nodesToVisit.pop();
    const children = await chrome.bookmarks.getChildren(nodeId);
    for (const child of children) {
      if (child.url) {
        bookmarks.set(child.id, child);
      } else {
        nodesToVisit.push(child.id);
      }
    }
  }
  return bookmarks;
}

export async function getLocalFolders(rootFolderId) {
  const folders = new Map();
  const nodesToVisit = [rootFolderId];
  while (nodesToVisit.length > 0) {
    const nodeId = nodesToVisit.pop();
    const children = await chrome.bookmarks.getChildren(nodeId);
    for (const child of children) {
      if (!child.url) {
        folders.set(child.id, child);
        nodesToVisit.push(child.id);
      }
    }
  }
  return folders;
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
