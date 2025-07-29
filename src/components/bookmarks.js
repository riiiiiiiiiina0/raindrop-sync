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
