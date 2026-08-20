function toFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNullableString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

export function normalizeReelData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Пустой ответ от Apify');
  }

  if (data.error || data.errorDescription) {
    throw new Error(
      data.errorDescription ||
        'Не получилось получить этот Reel. Проверь, что ссылка публичная и видео доступно.'
    );
  }

  // Shortcode is mandatory for de-duplication and DB key.
  const shortcode = toNullableString(data.shortCode ?? data.shortcode ?? data.shortcodeStr);
  if (!shortcode) {
    throw new Error('Не удалось извлечь shortcode из данных Apify');
  }

  const sourceCoverUrl = toNullableString(data.displayUrl ?? data.coverUrl ?? data.sourceCoverUrl);
  const caption = toNullableString(data.caption ?? data.edgeCaptionToText?.text);

  const ownerUsername = toNullableString(data.ownerUsername ?? data.owner_user_name ?? data.username);
  const ownerFullName = toNullableString(data.ownerFullName ?? data.owner_full_name);

  const instagramReelId = toNullableString(data.id ?? data.instagramReelId ?? data.reelId);
  const publishedAt =
    data.timestamp && !Number.isNaN(Date.parse(data.timestamp)) ? new Date(data.timestamp).toISOString() : null;

  // Views normalization: videoPlayCount ?? videoViewCount ?? 0
  const playCount = toFiniteNumber(data.videoPlayCount);
  const viewCount = toFiniteNumber(data.videoViewCount);
  if (playCount === null && viewCount === null) {
    throw new Error(
      'Instagram сейчас не отдал данные. Попробуй обновить чуть позже.'
    );
  }
  const views = playCount ?? viewCount ?? 0;

  const likes = toFiniteNumber(data.likesCount) ?? toFiniteNumber(data.likeCount) ?? 0;
  const comments = toFiniteNumber(data.commentsCount) ?? toFiniteNumber(data.commentCount) ?? 0;

  // Also keep canonical reel URL if present; DB insert uses user input url.
  const reelUrl = toNullableString(data.url ?? data.instagramUrl ?? data.reelUrl);

  return {
    instagram_reel_id: instagramReelId,
    shortcode,
    caption,
    owner_username: ownerUsername,
    owner_full_name: ownerFullName,
    source_cover_url: sourceCoverUrl,
    published_at: publishedAt,
    views,
    likes,
    comments,
    instagram_url_from_apify: reelUrl,
  };
}

