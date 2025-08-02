/**
 * Gets the timestamp of the very last change (updated, created, or deleted).
 * This function fetches the latest updated/created item and the latest deleted item
 * from the Raindrop API and returns the most recent `lastUpdate` timestamp.
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @returns {Promise<number|null>} The latest change timestamp (in milliseconds), or null if none found.
 */
export async function getRaindropsUpdatedSince(
  token,
  lastSyncTimestamp,
  collectionId = 0,
) {
  const query = `lastUpdate:>${new Date(lastSyncTimestamp).toISOString()}`;
  const raindrops = [];
  const onPageReceived = (items) => {
    raindrops.push(...items);
  };
  await fetchRaindropsPaginated(token, onPageReceived, {
    search: query,
    collectionId: collectionId,
  });
  return raindrops;
}

export async function getRaindropByIds(token, ids) {
  const query = ids.map((id) => `_id:${id}`).join(' OR ');
  const raindrops = [];
  const onPageReceived = (items) => {
    raindrops.push(...items);
  };
  await fetchRaindropsPaginated(token, onPageReceived, {
    search: query,
  });
  return raindrops;
}

export async function getCollections(token) {
  const [rootCollections, childCollections] = await Promise.all([
    getRootCollections(token),
    getChildCollections(token),
  ]);
  return [...rootCollections, ...childCollections];
}

/**
 * Fetches raindrops page by page using the Multiple raindrops API.
 * This function fetches raindrops in paginated manner and processes each page immediately.
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @param {Function} onPageReceived - Callback function called for each page of raindrops.
 * @param {Object} [options] - Fetch options.
 * @param {number} [options.collectionId] - Collection ID (0 for all, -1 for unsorted, etc.)
 * @param {number} [options.perPage] - Number of raindrops per page (max 50)
 * @param {boolean} [options.nested] - Include raindrops from nested collections
 * @param {string} [options.sort] - Sort order (-created, created, title, etc.)
 * @returns {Promise<Object>} Summary of the fetch process.
 */
export async function fetchRaindropsPaginated(token, onPageReceived, options) {
  try {
    const defaultOptions = {
      collectionId: 0, // 0 = all collections
      perPage: 50,
      nested: true,
      sort: '-created',
    };
    const finalOptions = { ...defaultOptions, ...(options || {}) };
    const { collectionId, perPage, nested, sort } = finalOptions;

    console.log(
      `Fetching raindrops paginated from collection ${collectionId}...`,
    );

    let currentPage = 0;
    let totalFetched = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(
        `Fetching page ${currentPage} (${perPage} items per page)...`,
      );

      const url = new URL(
        `https://api.raindrop.io/rest/v1/raindrops/${collectionId}`,
      );
      url.searchParams.set('page', currentPage.toString());
      url.searchParams.set('perpage', perPage.toString());
      url.searchParams.set('nested', nested.toString());
      url.searchParams.set('sort', sort);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch raindrops page ${currentPage}: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (!data.result || !data.items) {
        throw new Error(
          data.errorMessage || `Failed to fetch raindrops page ${currentPage}`,
        );
      }

      const raindrops = data.items;
      console.log(
        `Received ${raindrops.length} raindrops on page ${currentPage}`,
      );

      // Process this page of raindrops
      if (raindrops.length > 0) {
        await onPageReceived(raindrops, currentPage, totalFetched);
        totalFetched += raindrops.length;
      }

      // Check if there are more pages
      hasMorePages = raindrops.length === perPage;
      currentPage++;

      // Safety check to prevent infinite loops
      if (currentPage > 1000) {
        console.warn('Reached maximum page limit (1000), stopping fetch');
        break;
      }
    }

    console.log(
      `Finished fetching raindrops. Total: ${totalFetched} raindrops from ${currentPage} pages`,
    );

    return {
      totalFetched,
      totalPages: currentPage,
      success: true,
    };
  } catch (error) {
    console.error('Error fetching raindrops paginated:', error);
    throw error;
  }
}

/**
 * Creates a browser bookmark from a raindrop object.
 * This function creates a bookmark in the appropriate folder based on the raindrop's collection ID.
 * For collection handling:
 * - Collection found: Creates bookmark in the corresponding folder
 * - Collection -1: Creates bookmark in unsorted folder
 * - Other missing collections: Ignores the bookmark (returns null)
 *
 * @async
 * @param {Object} raindrop - The raindrop object from the API.
 * @param {Map} collectionToFolderMap - Map of collection IDs to bookmark folder IDs.
 * @returns {Promise<Object|null>} The created bookmark object, or null if bookmark is ignored.
 */
export async function createBookmarkFromRaindrop(
  raindrop,
  collectionToFolderMap,
) {
  try {
    // Get the collection ID from the raindrop
    const collectionId = raindrop.collection?.$id || 0; // Default to 0 (unsorted) if no collection

    // Find the corresponding folder ID
    let folderId = collectionToFolderMap.get(collectionId);

    // Handle not found collections based on specific rules
    if (!folderId) {
      if (collectionId === -1) {
        // -1: put to unsorted folder
        folderId =
          collectionToFolderMap.get('unsorted') || collectionToFolderMap.get(0);
        if (!folderId) {
          throw new Error(`No unsorted folder available for collection -1`);
        }
        console.log(`Collection -1 (unsorted) mapped to unsorted folder`);
      } else {
        // others: ignore that bookmark
        console.warn(
          `Collection ${collectionId} not found in folder map, ignoring bookmark: ${raindrop.title}`,
        );
        return null;
      }
    }

    // Prepare bookmark title (truncate if too long)
    let title = raindrop.title || 'Untitled';
    if (title.length > 1000) {
      title = title.substring(0, 997) + '...';
    }

    // Ensure we have a valid URL
    const url = raindrop.link;
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      console.warn(
        `Skipping raindrop with invalid URL: ${url} (title: ${title})`,
      );
      return null;
    }

    // Create the bookmark
    const bookmark = await chrome.bookmarks.create({
      parentId: folderId,
      title: title,
      url: url,
    });

    console.log(`Created bookmark: ${title} in collection ${collectionId}`);
    return bookmark;
  } catch (error) {
    console.error('Error creating bookmark from raindrop:', error, raindrop);
    return null;
  }
}

/**
 * Processes a page of raindrops and creates bookmarks for each one.
 * This function is used as a callback for the paginated raindrop fetching.
 *
 * @async
 * @param {Array} raindrops - Array of raindrop objects from the API.
 * @param {Map} collectionToFolderMap - Map of collection IDs to bookmark folder IDs.
 * @param {Function|undefined} onProgress - Optional progress callback function.
 * @returns {Promise<Object>} Processing results.
 */
export async function processRaindropsPage(
  raindrops,
  collectionToFolderMap,
  onProgress,
) {
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < raindrops.length; i++) {
    const raindrop = raindrops[i];

    try {
      const bookmark = await createBookmarkFromRaindrop(
        raindrop,
        collectionToFolderMap,
      );

      if (bookmark) {
        successCount++;
      } else {
        skipCount++;
      }

      // Call progress callback if provided
      if (onProgress && typeof onProgress === 'function') {
        onProgress(
          i + 1,
          raindrops.length,
          successCount,
          skipCount,
          errorCount,
        );
      }
    } catch (error) {
      console.error(`Error processing raindrop: ${raindrop.title}`, error);
      errorCount++;
    }
  }

  console.log(
    `Page processing completed: ${successCount} created, ${skipCount} skipped, ${errorCount} errors`,
  );

  return {
    successCount,
    skipCount,
    errorCount,
    totalProcessed: raindrops.length,
  };
}

/**
 * Parses Raindrop backup HTML and extracts bookmark structure.
 * This function uses text-based parsing since DOMParser is not available in service workers.
 *
 * @param {string} htmlContent - The HTML content of the Raindrop backup.
 * @returns {Array} The parsed bookmark structure.
 */
export function parseRaindropBackup(htmlContent) {
  try {
    // Parse the HTML content using text-based parsing since DOMParser is not available in service workers
    const parsedStructure = parseNetscapeBookmarks(htmlContent);

    // If the structure contains a single folder named "Export", use its children as the root
    if (
      parsedStructure.length === 1 &&
      parsedStructure[0].type === 'folder' &&
      parsedStructure[0].title === 'Export'
    ) {
      console.log('Detected "Export" folder, using its content as the root.');
      return parsedStructure[0].children;
    }

    console.log('Parsed bookmark structure:', parsedStructure);
    return parsedStructure;
  } catch (error) {
    console.error('Error parsing backup HTML:', error);
    throw error;
  }
}

/**
 * Parses Netscape bookmark format using text parsing.
 * This function is used to parse the HTML content of the Raindrop backup.
 *
 * @param {string} htmlContent - The HTML content of the Raindrop backup.
 * @returns {Array} The parsed bookmark structure.
 */
function parseNetscapeBookmarks(htmlContent) {
  const lines = htmlContent.split('\n');
  const result = [];
  const folderStack = [{ children: result, level: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for folder start (H3 tag)
    const folderMatch = line.match(/<H3[^>]*>(.*?)<\/H3>/i);
    if (folderMatch) {
      const folderTitle = decodeHtmlEntities(folderMatch[1]);

      // Extract attributes from H3 tag
      const addDateMatch = line.match(/ADD_DATE="(\d+)"/i);
      const lastModifiedMatch = line.match(/LAST_MODIFIED="(\d+)"/i);

      const folder = {
        type: 'folder',
        title: folderTitle,
        addDate: addDateMatch ? parseInt(addDateMatch[1]) * 1000 : Date.now(),
        lastModified: lastModifiedMatch
          ? parseInt(lastModifiedMatch[1]) * 1000
          : Date.now(),
        children: [],
      };

      // Add to current parent
      const currentParent = folderStack[folderStack.length - 1];
      currentParent.children.push(folder);

      // Push this folder to stack for future children
      folderStack.push({
        children: folder.children,
        level: getCurrentLevel(line),
      });
      continue;
    }

    // Check for bookmark (A tag)
    const bookmarkMatch = line.match(/<A[^>]*HREF="([^"]*)"[^>]*>(.*?)<\/A>/i);
    if (bookmarkMatch) {
      const url = decodeHtmlEntities(bookmarkMatch[1]);
      const title = decodeHtmlEntities(bookmarkMatch[2]);

      // Extract attributes
      const addDateMatch = line.match(/ADD_DATE="(\d+)"/i);
      const lastModifiedMatch = line.match(/LAST_MODIFIED="(\d+)"/i);
      const tagsMatch = line.match(/TAGS="([^"]*)"/i);
      const coverMatch = line.match(/DATA-COVER="([^"]*)"/i);
      const importantMatch = line.match(/DATA-IMPORTANT="([^"]*)"/i);

      // Check for description in next line (DD tag)
      let description = '';
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const descMatch = nextLine.match(/<DD>(.*?)$/i);
        if (descMatch) {
          description = decodeHtmlEntities(descMatch[1]);
        }
      }

      const bookmark = {
        type: 'bookmark',
        title: title,
        url: url,
        addDate: addDateMatch ? parseInt(addDateMatch[1]) * 1000 : Date.now(),
        lastModified: lastModifiedMatch
          ? parseInt(lastModifiedMatch[1]) * 1000
          : Date.now(),
        tags: tagsMatch ? tagsMatch[1] : '',
        description: description,
        cover: coverMatch ? coverMatch[1] : '',
        important: importantMatch ? importantMatch[1] === 'true' : false,
      };

      // Add to current parent
      const currentParent = folderStack[folderStack.length - 1];
      currentParent.children.push(bookmark);
      continue;
    }

    // Check for end of folder (</DL>)
    if (line.match(/<\/DL>/i)) {
      // Pop folder from stack if we're not at root level
      if (folderStack.length > 1) {
        folderStack.pop();
      }
    }
  }

  return result;
}

/**
 * Decodes HTML entities in the given text.
 * This function is used to decode the HTML entities in the bookmark structure.
 *
 * @param {string} text - The text to decode.
 * @returns {string} The decoded text.
 */
function decodeHtmlEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[a-zA-Z0-9#]+;/g, (match) => {
    return entities[match] || match;
  });
}

/**
 * Determines the nesting level of a line in the bookmark structure.
 * This function is used to determine the nesting level of a line in the bookmark structure.
 *
 * @param {string} line - The line to determine the nesting level of.
 * @returns {number} The nesting level of the line.
 */
function getCurrentLevel(line) {
  const leadingSpaces = line.match(/^(\s*)/);
  return leadingSpaces ? Math.floor(leadingSpaces[1].length / 2) : 0;
}

/**
 * Adds new raindrops to the user's collection.
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @param {Array<Object>} raindrops - An array of raindrop objects to add.
 * @returns {Promise<Array<Object>>} The newly created raindrops.
 */
export async function addRaindrops(token, raindrops) {
  try {
    const response = await fetch('https://api.raindrop.io/rest/v1/raindrops', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: raindrops,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result) {
        return data.items;
      } else {
        throw new Error(data.errorMessage || 'Failed to add raindrops');
      }
    } else {
      throw new Error(
        `Failed to add raindrops: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error adding raindrops:', error);
    throw error;
  }
}

/**
 * Fetches user data including groups information from the Raindrop API.
 * This function gets the authenticated user's data, which includes groups that organize collections.
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @returns {Promise<Object>} User data object containing groups information.
 */
export async function getUserData(token) {
  try {
    console.log('Fetching user data with groups...');

    const response = await fetch('https://api.raindrop.io/rest/v1/user', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.result && data.user) {
        console.log(
          `Found user data with ${data.user.groups?.length || 0} groups`,
        );
        return data.user;
      } else {
        throw new Error(data.errorMessage || 'Failed to fetch user data');
      }
    } else {
      throw new Error(
        `Failed to fetch user data: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

/**
 * Fetches all root collections from the Raindrop API.
 * This function gets all collections that don't have a parent (root level).
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @returns {Promise<Array>} Array of root collections.
 */
export async function getRootCollections(token) {
  try {
    console.log('Fetching root collections...');

    const response = await fetch(
      'https://api.raindrop.io/rest/v1/collections',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      if (data.result && data.items) {
        console.log(`Found ${data.items.length} root collections`);
        return data.items;
      } else {
        throw new Error(
          data.errorMessage || 'Failed to fetch root collections',
        );
      }
    } else {
      throw new Error(
        `Failed to fetch root collections: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error fetching root collections:', error);
    throw error;
  }
}

/**
 * Fetches all child collections from the Raindrop API.
 * This function gets all collections that have a parent (nested collections).
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @returns {Promise<Array>} Array of child collections.
 */
export async function getChildCollections(token) {
  try {
    console.log('Fetching child collections...');

    const response = await fetch(
      'https://api.raindrop.io/rest/v1/collections/childrens',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      if (data.result && data.items) {
        console.log(`Found ${data.items.length} child collections`);
        return data.items;
      } else {
        throw new Error(
          data.errorMessage || 'Failed to fetch child collections',
        );
      }
    } else {
      throw new Error(
        `Failed to fetch child collections: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error fetching child collections:', error);
    throw error;
  }
}

/**
 * Builds a hierarchical collection tree structure from root and child collections.
 * This function organizes collections into a tree structure based on parent-child relationships.
 *
 * @param {Array} rootCollections - Array of root collections.
 * @param {Array} childCollections - Array of child collections.
 * @returns {Array} Hierarchical tree structure of collections.
 */
export function buildCollectionTree(rootCollections, childCollections) {
  console.log('Building collection tree structure...');

  // Create a map for quick lookup of children by parent ID
  const childrenByParent = new Map();

  childCollections.forEach((collection) => {
    const parentId = collection.parent?.$id;
    if (parentId) {
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId).push(collection);
    }
  });

  // Sort children by their sort value (descending, as per Raindrop API)
  childrenByParent.forEach((children) => {
    children.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  });

  // Recursive function to attach children to their parents
  function attachChildren(collection) {
    const children = childrenByParent.get(collection._id) || [];
    return {
      id: collection._id,
      title: collection.title,
      sort: collection.sort || 0,
      children: children.map((child) => attachChildren(child)),
    };
  }

  // Sort root collections by their sort value (descending)
  const sortedRootCollections = [...rootCollections].sort(
    (a, b) => (a.sort || 0) - (b.sort || 0),
  );

  // Build the tree starting from sorted root collections
  const tree = sortedRootCollections.map((root) => attachChildren(root));

  // Add "Unsorted" folder at the beginning
  const unsortedFolder = {
    id: 'unsorted',
    title: 'Unsorted',
    sort: Number.MAX_SAFE_INTEGER, // Ensure it sorts first
    children: [],
  };

  tree.unshift(unsortedFolder);

  console.log(
    `Built collection tree with ${tree.length} collections (including Unsorted)`,
  );
  return tree;
}

/**
 * Builds a hierarchical collection tree structure organized by groups.
 * This function organizes collections into groups and maintains hierarchical structure within each group.
 *
 * @param {Array} rootCollections - Array of root collections.
 * @param {Array} childCollections - Array of child collections.
 * @param {Array} groups - Array of groups that organize collections.
 * @returns {Array} Hierarchical tree structure organized by groups.
 */
export function buildCollectionTreeWithGroups(
  rootCollections,
  childCollections,
  groups,
) {
  console.log('Building collection tree structure with groups...');

  // First build the basic collection tree structure
  const childrenByParent = new Map();
  childCollections.forEach((collection) => {
    const parentId = collection.parent?.$id;
    if (parentId) {
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId).push(collection);
    }
  });

  // Sort children by their sort value
  childrenByParent.forEach((children) => {
    children.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  });

  // Create maps for quick lookup
  const allCollections = new Map();
  [...rootCollections, ...childCollections].forEach((collection) => {
    allCollections.set(collection._id, collection);
  });

  // Recursive function to attach children to their parents
  function attachChildren(collection) {
    const children = childrenByParent.get(collection._id) || [];
    return {
      id: collection._id,
      title: collection.title,
      sort: collection.sort || 0,
      children: children.map((child) => attachChildren(child)),
    };
  }

  const result = [];

  // Add "Unsorted" folder first
  const unsortedFolder = {
    id: 'unsorted',
    title: 'Unsorted',
    sort: -1, // Ensure it sorts first
    children: /** @type {Array} */ ([]),
    isGroup: false,
  };
  result.push(unsortedFolder);

  if (groups && groups.length > 0) {
    // Sort groups by their sort value
    const sortedGroups = [...groups].sort(
      (a, b) => (a.sort || 0) - (b.sort || 0),
    );

    // Process each group
    sortedGroups.forEach((group) => {
      const groupFolder = {
        id: `group_${group.title}`,
        title: group.title,
        sort: group.sort || 0,
        children: /** @type {Array} */ ([]),
        isGroup: true,
        hidden: group.hidden || false,
      };

      // Add collections to this group in the specified order
      if (group.collections && group.collections.length > 0) {
        group.collections.forEach((collectionId) => {
          const collection = allCollections.get(collectionId);
          if (collection) {
            // Only add root collections here; children will be attached recursively
            if (!collection.parent || !collection.parent.$id) {
              groupFolder.children.push(attachChildren(collection));
            }
          }
        });
      }

      result.push(groupFolder);
    });

    // Handle collections not in any group (add them to a default "Other" group)
    const collectionsInGroups = new Set();
    groups.forEach((group) => {
      if (group.collections) {
        group.collections.forEach((id) => collectionsInGroups.add(id));
      }
    });

    const ungroupedCollections = rootCollections.filter(
      (collection) => !collectionsInGroups.has(collection._id),
    );

    if (ungroupedCollections.length > 0) {
      const otherFolder = {
        id: 'group_other',
        title: 'Other',
        sort: Number.MAX_SAFE_INTEGER,
        children: /** @type {Array} */ (
          ungroupedCollections.map((collection) => attachChildren(collection))
        ),
        isGroup: true,
        hidden: false,
      };
      result.push(otherFolder);
    }
  } else {
    // No groups defined, fall back to the original structure
    console.log('No groups found, falling back to original structure');
    const sortedRootCollections = [...rootCollections].sort(
      (a, b) => (a.sort || 0) - (b.sort || 0),
    );

    const tree = sortedRootCollections.map((root) => attachChildren(root));
    result.push(...tree);
  }

  console.log(
    `Built collection tree with ${result.length} top-level items (including groups and Unsorted)`,
  );
  return result;
}
