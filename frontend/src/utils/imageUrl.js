/**
 * imageUrl.js
 * -----------
 * Centralised helper for building absolute image URLs from stored paths.
 *
 * Images in this project are stored in the server's /uploads/ directory.
 * The database only stores the relative path, e.g. "/uploads/photo-1234.jpg".
 * In production the frontend and backend are on different origins, so the
 * browser cannot resolve "/uploads/..." relative to the frontend domain.
 *
 * This utility prepends the backend base URL so images load in every env.
 */

import { baseURL } from './axios';

/**
 * Given a stored image path (e.g. "/uploads/photo.jpg" or null),
 * returns a fully-qualified URL pointing at the backend, or null if no path.
 *
 * @param {string|null|undefined} path  - The stored path from the database.
 * @returns {string|null}
 */
export const resolveImageUrl = (path) => {
  if (!path) return null;

  // Already a fully-qualified URL (e.g. external CDN) — return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  // Normalise: ensure exactly one leading slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseURL}${cleanPath}`;
};

/**
 * Same as resolveImageUrl but returns a fallback placeholder URL when no path.
 *
 * @param {string|null|undefined} path
 * @param {string} [fallback='']  - URL to use when path is absent.
 * @returns {string}
 */
export const resolveImageUrlWithFallback = (path, fallback = '') => {
  return resolveImageUrl(path) || fallback;
};
