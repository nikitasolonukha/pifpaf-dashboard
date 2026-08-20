import { ApifyClient } from 'apify-client';
import { normalizeReelData } from '../src/lib/apify/instagramNormalization.mjs';

const TEST_URL = process.argv[2] || 'https://www.instagram.com/reel/C8xYz_example/';

async function main() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token || token === 'placeholder') {
    console.error('APIFY_API_TOKEN missing');
    process.exit(1);
  }

  console.log('Testing Apify with URL:', TEST_URL);
  const client = new ApifyClient({ token });

  const run = await client.actor('apify/instagram-reel-scraper').call({
    username: [TEST_URL],
    resultsLimit: 1,
    skipPinnedPosts: false,
    skipTrialReels: false,
    includeSharesCount: false,
    includeTranscript: false,
    includeDownloadedVideo: false,
  });

  console.log('Run ID:', run.id, 'Status:', run.status);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  if (!items?.length) {
    console.error('Empty dataset');
    process.exit(1);
  }

  const raw = items[0];
  console.log('\n--- Raw Apify fields (keys) ---');
  console.log(Object.keys(raw).sort().join(', '));
  console.log('\n--- Raw sample ---');
  console.log(JSON.stringify({
    id: raw.id,
    shortCode: raw.shortCode,
    url: raw.url,
    caption: raw.caption?.slice?.(0, 80),
    displayUrl: raw.displayUrl?.slice?.(0, 60) + '...',
    timestamp: raw.timestamp,
    ownerUsername: raw.ownerUsername,
    ownerFullName: raw.ownerFullName,
    videoPlayCount: raw.videoPlayCount,
    videoViewCount: raw.videoViewCount,
    likesCount: raw.likesCount,
    commentsCount: raw.commentsCount,
    productType: raw.productType,
  }, null, 2));

  const normalized = normalizeReelData(raw);
  console.log('\n--- Normalized ---');
  console.log(JSON.stringify(normalized, null, 2));
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
