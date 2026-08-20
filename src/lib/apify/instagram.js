import { ApifyClient } from 'apify-client';
import { parseReelUrl, validateInstagramUrl } from '@/lib/apify/instagramValidator.mjs';
import { normalizeReelData } from '@/lib/apify/instagramNormalization.mjs';
import {
  extractShortcodeFromInstagramUrl,
  findExactReelMatch,
} from '@/lib/apify/reelMatch.mjs';
import { scrapeProfileReels } from '@/lib/apify/profileScraper.mjs';
import { validateInstagramProfile } from '@/lib/apify/profileValidator.mjs';

export {
  parseReelUrl,
  validateInstagramUrl,
  normalizeReelData,
  extractShortcodeFromInstagramUrl,
  findExactReelMatch,
  scrapeProfileReels as scrapeProfile,
  validateInstagramProfile,
};

export async function scrapeReel(url) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN not configured');

  const client = new ApifyClient({ token });

  // Official direct Reel URL input.
  // Apify docs: `apify/instagram-reel-scraper` expects input similar to:
  // { username: [<url>], skipPinnedPosts, skipTrialReels, includeSharesCount, includeTranscript, includeDownloadedVideo }
  let run;
  try {
    run = await client.actor('apify/instagram-reel-scraper').call({
      username: [url],
      resultsLimit: 1,
      skipPinnedPosts: false,
      skipTrialReels: false,
      includeSharesCount: false,
      includeTranscript: false,
      includeDownloadedVideo: false,
    });
  } catch (err) {
    console.error('Apify actor call failed:', err);
    throw new Error('Instagram сейчас не отдал данные. Попробуй обновить чуть позже.');
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems().catch(err => {
    console.error('Apify dataset listItems failed:', err);
    throw err;
  });

  if (!items || items.length === 0) {
    throw new Error('Apify не вернул данные. Проверь, что ссылка публичная и видео доступно.');
  }

  const inputShortcode = extractShortcodeFromInstagramUrl(url);
  const { match, reason } = findExactReelMatch(items, inputShortcode, url);

  if (!match) {
    console.error('Apify exact-match failed:', { url, inputShortcode, reason, itemCount: items.length });
    throw new Error('Не удалось подтвердить точное совпадение Reel. Попробуй снова.');
  }

  return normalizeReelData(match);
}
