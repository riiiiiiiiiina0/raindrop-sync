/**
 * Gets the latest raindrop to check if sync is needed.
 * This function fetches the latest raindrop from the Raindrop API.
 *
 * @async
 * @param {string} token - The API token for the Raindrop API.
 * @returns {Promise<Object>} The latest raindrop.
 */
export async function getLatestRaindrop(token) {
  try {
    const response = await fetch(
      'https://api.raindrop.io/rest/v1/raindrops/0?perpage=1',
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
      if (data.result && data.items && data.items.length > 0) {
        const latestRaindrop = data.items[0];
        console.log('Latest raindrop:', latestRaindrop);
        return {
          id: latestRaindrop._id,
          created: latestRaindrop.created,
          title: latestRaindrop.title,
        };
      } else {
        throw new Error('No raindrops found');
      }
    } else {
      throw new Error(
        `Failed to get latest raindrop: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error('Error getting latest raindrop:', error);
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
    console.log('Exporting all raindrops as CSV...');

    const response = await fetch(
      'https://api.raindrop.io/rest/v1/raindrops/0/export.csv',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.ok) {
      const csvContent = await response.text();

      // Print CSV content in console
      console.log('=== RAINDROP EXPORT CSV CONTENT ===');
      console.log(csvContent);
      console.log('=== END OF EXPORT CONTENT ===');

      return csvContent;
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
 * Parses Raindrop backup CSV and extracts bookmark structure.
 *
 * @param {string} csvContent - The CSV content of the Raindrop backup.
 * @returns {Array} The parsed bookmark structure.
 */
function parseRaindropCSV(csvContent) {
  const bookmarks = [];
  const lines = csvContent.trim().split('\\n');
  const headers = lines[0].split(',');

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(','); // This is a simplistic approach. A more robust solution would handle commas within quoted fields.
    const entry = headers.reduce((obj, header, index) => {
      obj[header.trim()] = values[index] ? values[index].trim() : '';
      return obj;
    }, {});

    if (entry.url) {
      bookmarks.push({
        type: 'bookmark',
        title: entry.title,
        url: entry.url,
        addDate: new Date(entry.created).getTime() || Date.now(),
        lastModified: new Date(entry.created).getTime() || Date.now(),
        tags: entry.tags,
        description: `${entry.note} ${entry.excerpt}`.trim(),
        cover: entry.cover,
        important: entry.favorite === 'true',
      });
    }
  }

  return bookmarks;
}

/**
 * Parses Raindrop backup HTML and extracts bookmark structure.
 * This function uses text-based parsing since DOMParser is not available in service workers.
 *
 * @param {string} htmlContent - The HTML content of the Raindrop backup.
 * @returns {Array} The parsed bookmark structure.
 */
export function parseRaindropBackup(csvContent) {
  try {
    // Parse the CSV content
    const parsedStructure = parseRaindropCSV(csvContent);

    console.log('Parsed bookmark structure:', parsedStructure);
    return parsedStructure;
  } catch (error) {
    console.error('Error parsing backup CSV:', error);
    throw error;
  }
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
