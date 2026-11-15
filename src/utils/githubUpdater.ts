import { PatchRelease, VersionManifest } from '../types/bowling';
import { LATEST_AVAILABLE_VERSION, PATCH_NOTES_HISTORY } from './bowlingLogic';

export const OFFICIAL_GITHUB_OWNER = 'mkstewart88';
export const OFFICIAL_GITHUB_REPO = 'BowlingLeagueTracker';
export const OFFICIAL_GITHUB_BRANCH = 'main';
export const OFFICIAL_GITHUB_URL = 'https://github.com/mkstewart88/BowlingLeagueTracker';

export interface ParsedGithubRepo {
  owner: string;
  repo: string;
  branch: string;
}

/**
 * Compares two version strings numerically segment by segment (e.g. "1.0.09" > "1.0.08" > "1.0.07").
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

export function parseGithubRepoSpec(
  rawRepo?: string,
  rawBranch?: string
): ParsedGithubRepo {
  const branchDefault = (rawBranch || OFFICIAL_GITHUB_BRANCH).trim() || OFFICIAL_GITHUB_BRANCH;
  const trimmed = (rawRepo || '').trim();

  if (!trimmed) {
    return {
      owner: OFFICIAL_GITHUB_OWNER,
      repo: OFFICIAL_GITHUB_REPO,
      branch: branchDefault,
    };
  }

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

  const shortMatch = trimmed
    .replace(/^\/+|\/+$/g, '')
    .match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2].replace(/\.git$/i, ''),
      branch: branchDefault,
    };
  }

  return {
    owner: OFFICIAL_GITHUB_OWNER,
    repo: OFFICIAL_GITHUB_REPO,
    branch: branchDefault,
  };
}

export function getBuiltInFallbackManifest(): VersionManifest {
  const latestRel = PATCH_NOTES_HISTORY[0];
  return {
    appName: 'Bowling League Helper',
    latestVersion: LATEST_AVAILABLE_VERSION,
    releaseDate: latestRel?.date || 'November 14, 2026',
    title:
      latestRel?.title ||
      'Streamlined Workspace Organization, Instant Undo & Automatic Update Sync',
    htmlBundlePath: 'Bowling_League_Helper_Latest.html',
    fallbackHtmlPaths: ['public/standalone_template.html'],
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
 * Silently checks the official GitHub repository (`mkstewart88/BowlingLeagueTracker`)
 * and local `version.json` for the latest version and patch notes.
 * Always returns whichever manifest has the highest version number so a newly downloaded
 * build never downgrades to an older cached manifest.
 */
export async function fetchVersionManifest(): Promise<{
  manifest: VersionManifest;
}> {
  const fallback = getBuiltInFallbackManifest();
  let bestManifest: VersionManifest = fallback;
  const cacheBuster = Date.now();
  const branchesToTry = ['main', 'master'];

  if (typeof fetch === 'function') {
    for (const branch of branchesToTry) {
      // 1. Check GitHub API raw media type
      const apiUrl = `https://api.github.com/repos/${OFFICIAL_GITHUB_OWNER}/${OFFICIAL_GITHUB_REPO}/contents/version.json?ref=${branch}&_t=${cacheBuster}`;
      try {
        const apiResp = await fetch(apiUrl, {
          headers: { Accept: 'application/vnd.github.v3.raw' },
          cache: 'no-store',
        });
        if (apiResp.ok) {
          const data = await apiResp.json();
          if (
            isValidVersionManifest(data) &&
            compareSemverVersions(data.latestVersion, bestManifest.latestVersion) >= 0
          ) {
            bestManifest = data;
            break;
          }
        }
      } catch {
        // Silent fallback
      }

      // 2. Check raw.githubusercontent.com
      const rawUrl = `https://raw.githubusercontent.com/${OFFICIAL_GITHUB_OWNER}/${OFFICIAL_GITHUB_REPO}/${branch}/version.json?t=${cacheBuster}`;
      try {
        const resp = await fetch(rawUrl, { cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          if (
            isValidVersionManifest(data) &&
            compareSemverVersions(data.latestVersion, bestManifest.latestVersion) >= 0
          ) {
            bestManifest = data;
            break;
          }
        }
      } catch {
        // Silent fallback
      }
    }

    // 3. Also check same-origin /version.json when running over http/https
    if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
      try {
        const localResp = await fetch(`./version.json?t=${cacheBuster}`, { cache: 'no-store' });
        if (localResp.ok) {
          const data = await localResp.json();
          if (
            isValidVersionManifest(data) &&
            compareSemverVersions(data.latestVersion, bestManifest.latestVersion) >= 0
          ) {
            bestManifest = data;
          }
        }
      } catch {
        // Silent fallback
      }
    }
  }

  return {
    manifest: {
      ...bestManifest,
      releases: mergePatchNotesHistory(bestManifest.releases),
    },
  };
}

/**
 * Fetches the newest pre-compiled single-file `.html` bundle directly from the official
 * GitHub repository (`mkstewart88/BowlingLeagueTracker`) if its version is newer than or equal to the target.
 */
export async function fetchRemoteHtmlTemplateFromGithub(
  manifest?: VersionManifest | null
): Promise<string | null> {
  if (typeof fetch !== 'function') return null;

  const candidatePaths = Array.from(
    new Set([
      manifest?.htmlBundlePath || 'Bowling_League_Helper_Latest.html',
      ...(manifest?.fallbackHtmlPaths || []),
      'public/standalone_template.html',
    ])
  );

  const branchesToTry = ['main', 'master'];
  const cacheBuster = Date.now();

  for (const branch of branchesToTry) {
    for (const filePath of candidatePaths) {
      const cleanPath = filePath.replace(/^\/+/, '');
      const rawUrl = `https://raw.githubusercontent.com/${OFFICIAL_GITHUB_OWNER}/${OFFICIAL_GITHUB_REPO}/${branch}/${cleanPath}?t=${cacheBuster}`;
      try {
        const resp = await fetch(rawUrl, { cache: 'no-store' });
        if (resp.ok) {
          const html = await resp.text();
          // Only use the remote HTML template if it contains the latest version string
          const targetVer = manifest?.latestVersion || LATEST_AVAILABLE_VERSION;
          if (html.includes('id="root"') && html.includes('<script') && html.includes(targetVer)) {
            return html;
          }
        }
      } catch {
        // Silent fallback
      }
    }
  }

  return null;
}

/**
 * Merges remote patch notes from `version.json` with built-in patch notes
 * so no historical release entries are ever lost.
 */
export function mergePatchNotesHistory(remoteReleases?: PatchRelease[]): PatchRelease[] {
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
