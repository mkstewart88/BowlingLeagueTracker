import { PatchRelease, VersionManifest } from '../types/bowling';
import { LATEST_AVAILABLE_VERSION, PATCH_NOTES_HISTORY } from './bowlingLogic';

export interface ParsedGithubRepo {
  owner: string;
  repo: string;
  branch: string;
}

/**
 * Compares two version strings numerically segment by segment (e.g. "1.0.08" > "1.0.07" > "1.0.06").
 * Returns 1 if vA > vB, -1 if vA < vB, 0 if equal.
 */
export function compareSemverVersions(vA: string, vB: string): number {
  const cleanA = String(vA || '0').replace(/^v/i, '').trim();
  const cleanB = String(vB || '0').replace(/^v/i, '').trim();
  if (cleanA === cleanB) return 0;

  const partsA = cleanA.split('.').map((n) => parseInt(n, 10) || 0);
  const partsB = cleanB.split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const a = partsA[i] ?? 0;
    const b = partsB[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Parses a GitHub repository string or URL (e.g. "MKStewart88/bowling-league-helper"
 * or "https://github.com/MKStewart88/bowling-league-helper/tree/main") into owner, repo, and branch.
 */
export function parseGithubRepoSpec(
  rawRepo?: string,
  rawBranch?: string
): ParsedGithubRepo | null {
  const branchDefault = (rawBranch || 'main').trim() || 'main';
  let trimmed = (rawRepo || '').trim();

  // Auto-detect if hosted on GitHub Pages (*.github.io/repo-name)
  if (!trimmed && typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
    const owner = window.location.hostname.replace(/\.github\.io$/i, '');
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (owner && pathParts.length > 0) {
      return { owner, repo: pathParts[0], branch: branchDefault };
    }
  }

  if (!trimmed) return null;

  // Handle raw.githubusercontent.com/<owner>/<repo>/<branch>/...
  const rawMatch = trimmed.match(
    /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)(?:\/([^/]+))?/i
  );
  if (rawMatch) {
    return {
      owner: rawMatch[1],
      repo: rawMatch[2].replace(/\.git$/i, ''),
      branch: rawMatch[3] || branchDefault,
    };
  }

  // Handle https://github.com/<owner>/<repo>(/tree/<branch>)?
  const ghUrlMatch = trimmed.match(
    /github\.com\/([^/]+)\/([^/#?]+)(?:\/(?:tree|blob)\/([^/#?]+))?/i
  );
  if (ghUrlMatch) {
    return {
      owner: ghUrlMatch[1],
      repo: ghUrlMatch[2].replace(/\.git$/i, ''),
      branch: ghUrlMatch[3] || branchDefault,
    };
  }

  // Handle shorthand "owner/repo"
  const shortMatch = trimmed.replace(/^\/+|\/+$/g, '').match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2].replace(/\.git$/i, ''),
      branch: branchDefault,
    };
  }

  return null;
}

export function getBuiltInFallbackManifest(): VersionManifest {
  const latestRel = PATCH_NOTES_HISTORY[0];
  return {
    appName: 'Bowling League Helper',
    latestVersion: LATEST_AVAILABLE_VERSION,
    releaseDate: latestRel?.date || 'November 14, 2026',
    title:
      latestRel?.title ||
      'Team Performance Bar Charts, Clean Sub-Tab Workspace, League-Agnostic Rules & GitHub Auto-Updater',
    htmlBundlePath: 'Bowling_League_Helper_Latest.html',
    fallbackHtmlPaths: [
      `Bowling_League_Helper_v${LATEST_AVAILABLE_VERSION}.html`,
      'public/standalone_template.html',
      'Bowling_League_Helper_v1.0.06.html',
    ],
    releases: PATCH_NOTES_HISTORY,
  };
}

function isValidVersionManifest(obj: unknown): obj is VersionManifest {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.latestVersion === 'string' &&
    candidate.latestVersion.trim().length > 0 &&
    Array.isArray(candidate.releases)
  );
}

/**
 * Fetches the live `version.json` manifest from GitHub (if configured) and/or the current web origin,
 * bypassing browser and CDN caches so newly pushed GitHub updates are detected immediately.
 */
export async function fetchVersionManifest(
  githubRepo?: string,
  githubBranch?: string
): Promise<{
  manifest: VersionManifest;
  sourceUrl: string;
  isFromGithub: boolean;
  error?: string;
}> {
  const fallback = getBuiltInFallbackManifest();
  const parsed = parseGithubRepoSpec(githubRepo, githubBranch);
  const cacheBuster = Date.now();

  if (parsed && typeof fetch === 'function') {
    const branchesToTry = Array.from(new Set([parsed.branch, 'main', 'master']));
    for (const branch of branchesToTry) {
      // 1. Try GitHub REST API with raw media type first (instant updates, zero 5-minute Raw CDN delay)
      const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/version.json?ref=${encodeURIComponent(
        branch
      )}&_t=${cacheBuster}`;
      try {
        const apiResp = await fetch(apiUrl, {
          headers: { Accept: 'application/vnd.github.v3.raw' },
          cache: 'no-store',
        });
        if (apiResp.ok) {
          const data = await apiResp.json();
          if (isValidVersionManifest(data)) {
            return {
              manifest: data,
              sourceUrl: `https://github.com/${parsed.owner}/${parsed.repo}/blob/${branch}/version.json`,
              isFromGithub: true,
            };
          }
        }
      } catch {
        // Fall through to raw.githubusercontent.com
      }

      // 2. Try raw.githubusercontent.com/<owner>/<repo>/<branch>/version.json
      const rawUrls = [
        `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/version.json?t=${cacheBuster}`,
        `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/public/version.json?t=${cacheBuster}`,
      ];
      for (const rawUrl of rawUrls) {
        try {
          const resp = await fetch(rawUrl, { cache: 'no-store' });
          if (resp.ok) {
            const data = await resp.json();
            if (isValidVersionManifest(data)) {
              return {
                manifest: data,
                sourceUrl: rawUrl.split('?')[0],
                isFromGithub: true,
              };
            }
          }
        } catch {
          // Continue trying next candidate
        }
      }
    }
  }

  // 3. Try same-origin /version.json when running over http/https
  if (
    typeof window !== 'undefined' &&
    typeof fetch === 'function' &&
    window.location.protocol !== 'file:'
  ) {
    try {
      const localResp = await fetch(`./version.json?t=${cacheBuster}`, { cache: 'no-store' });
      if (localResp.ok) {
        const data = await localResp.json();
        if (isValidVersionManifest(data)) {
          return {
            manifest: data,
            sourceUrl: `${window.location.origin}/version.json`,
            isFromGithub: Boolean(parsed),
          };
        }
      }
    } catch {
      // Fall through to built-in manifest
    }
  }

  return {
    manifest: fallback,
    sourceUrl: 'Built-in Release Manifest (v' + fallback.latestVersion + ')',
    isFromGithub: false,
    error: parsed
      ? `Could not find version.json in GitHub repo "${parsed.owner}/${parsed.repo}". Make sure version.json is pushed to your repository and the repo is public.`
      : undefined,
  };
}

/**
 * Fetches the newest pre-compiled single-file `.html` bundle directly from GitHub
 * so even a standalone `.html` file running from a local Desktop folder (`file://`)
 * can download the newest application code and inject all saved leagues into it!
 */
export async function fetchRemoteHtmlTemplateFromGithub(
  githubRepo?: string,
  githubBranch?: string,
  manifest?: VersionManifest | null
): Promise<{ html: string; sourceUrl: string } | null> {
  const parsed = parseGithubRepoSpec(githubRepo, githubBranch);
  if (!parsed || typeof fetch !== 'function') return null;

  const targetVer = manifest?.latestVersion || LATEST_AVAILABLE_VERSION;
  const candidatePaths = Array.from(
    new Set([
      manifest?.htmlBundlePath || 'Bowling_League_Helper_Latest.html',
      `Bowling_League_Helper_v${targetVer}.html`,
      ...(manifest?.fallbackHtmlPaths || []),
      'public/standalone_template.html',
      'Bowling_League_Helper_v1.0.06.html',
    ])
  );

  const branchesToTry = Array.from(new Set([parsed.branch, 'main', 'master']));
  const cacheBuster = Date.now();

  for (const branch of branchesToTry) {
    for (const filePath of candidatePaths) {
      const cleanPath = filePath.replace(/^\/+/, '');
      // 1. Try raw.githubusercontent.com first for large HTML bundles
      const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${cleanPath}?t=${cacheBuster}`;
      try {
        const resp = await fetch(rawUrl, { cache: 'no-store' });
        if (resp.ok) {
          const html = await resp.text();
          if (html.includes('id="root"') && html.includes('<script')) {
            return { html, sourceUrl: rawUrl.split('?')[0] };
          }
        }
      } catch {
        // Try GitHub REST API raw fallback
      }

      // 2. Try GitHub API raw media type
      const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${cleanPath}?ref=${encodeURIComponent(
        branch
      )}&_t=${cacheBuster}`;
      try {
        const apiResp = await fetch(apiUrl, {
          headers: { Accept: 'application/vnd.github.v3.raw' },
          cache: 'no-store',
        });
        if (apiResp.ok) {
          const html = await apiResp.text();
          if (html.includes('id="root"') && html.includes('<script')) {
            return {
              html,
              sourceUrl: `https://github.com/${parsed.owner}/${parsed.repo}/blob/${branch}/${cleanPath}`,
            };
          }
        }
      } catch {
        // Continue to next path
      }
    }
  }

  return null;
}

/**
 * Merges remote patch notes from GitHub's `version.json` with built-in patch notes
 * so no historical release entries are ever lost.
 */
export function mergePatchNotesHistory(
  remoteReleases?: PatchRelease[]
): PatchRelease[] {
  if (!Array.isArray(remoteReleases) || remoteReleases.length === 0) {
    return PATCH_NOTES_HISTORY;
  }
  const byVersion = new Map<string, PatchRelease>();
  for (const rel of remoteReleases) {
    if (rel && rel.version) {
      byVersion.set(rel.version, rel);
    }
  }
  for (const localRel of PATCH_NOTES_HISTORY) {
    if (!byVersion.has(localRel.version)) {
      byVersion.set(localRel.version, localRel);
    }
  }
  const merged = Array.from(byVersion.values()).sort((a, b) =>
    compareSemverVersions(b.version, a.version)
  );
  return merged.map((rel, idx) => ({
    ...rel,
    isLatest: idx === 0,
  }));
}
