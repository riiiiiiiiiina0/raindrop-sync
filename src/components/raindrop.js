/**
 * Gets the timestamp of the very last change (updated, created, or deleted).
 * This function fetches the latest updated/created item and the latest deleted item
 * from the Raindrop API and returns the most recent `lastUpdate` timestamp.
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @returns {Promise<number|null>} The latest change timestamp (in milliseconds), or null if none found.
 */
export async function getLatestChange(token) {
  try {
    const fetchOptions = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const urls = [
      'https://api.raindrop.io/rest/v1/raindrops/0?perpage=1&sort=-lastUpdate', // latest updated/created
      'https://api.raindrop.io/rest/v1/raindrops/-99?perpage=1&sort=-lastUpdate', // latest deleted
    ];

    const promises = urls.map((url) =>
      fetch(url, fetchOptions).then((res) => {
        if (!res.ok) {
          throw new Error(`API request failed: ${res.status} ${res.statusText}`);
        }
        return res.json();
      }),
    );

    const results = await Promise.all(promises);
    let latestTimestamp = 0;

    results.forEach((data) => {
      if (data.result && data.items && data.items.length > 0) {
        const item = data.items[0];
        if (item.lastUpdate) {
          const timestamp = new Date(item.lastUpdate).getTime();
          if (timestamp > latestTimestamp) {
            latestTimestamp = timestamp;
          }
        }
      }
    });

    if (latestTimestamp === 0) {
      console.log('No raindrops found to determine last change.');
      return null;
    }

    console.log(
      'Latest change detected at:',
      new Date(latestTimestamp).toISOString(),
    );
    return latestTimestamp;
  } catch (error) {
    console.error('Error getting latest change:', error);
    throw error;
  }
}

/**
 * Exports all raindrops as HTML directly.
 * This function fetches the HTML content of all raindrops from the Raindrop API.
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @returns {Promise<string>} The HTML content of all raindrops.
 */
export async function exportAllRaindrops(token) {
  try {
    console.log('Exporting all raindrops as HTML...');

    const response = await fetch(
      'https://api.raindrop.io/rest/v1/raindrops/0/export.html',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.ok) {
      const htmlContent = await response.text();

      // Print HTML content in console
      console.log('=== RAINDROP EXPORT HTML CONTENT ===');
      console.log(htmlContent);
      console.log('=== END OF EXPORT CONTENT ===');

      return htmlContent;
    } else {
      throw new Error(
        `Failed to export raindrops: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error exporting raindrops:', error);
    throw error;
  }
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
      console.log(
        'Detected "Export" folder, using its content as the root.',
      );
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
 * Adds a new raindrop to the user's collection.
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @param {string} url - The URL of the page to add.
 * @param {string} title - The title of the page.
 * @returns {Promise<Object>} The newly created raindrop.
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
