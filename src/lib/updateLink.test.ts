// T-035 (security pass finding 8): the update check opens only Pit Planner's own GitHub release links.
import { fetchLatest, fromRelease, RELEASES_PAGE, releaseLink } from './update';

const DOWNLOAD = 'https://github.com/MechEng70/pitplanner/releases/download/v0.3.0-beta.2/pitplanner-0.3.0-beta.2.apk';
const TAG_PAGE = 'https://github.com/MechEng70/pitplanner/releases/tag/v0.3.0-beta.2';

describe('releaseLink', () => {
  test('the three shapes GitHub and the app use are kept as they are', () => {
    expect(releaseLink(DOWNLOAD)).toBe(DOWNLOAD);
    expect(releaseLink(TAG_PAGE)).toBe(TAG_PAGE);
    expect(releaseLink(RELEASES_PAGE)).toBe(RELEASES_PAGE);
    expect(releaseLink('https://github.com/MechEng70/pitplanner/releases/download/v0.3.0/pitplanner-0.3.0.apk')).toBe(
      'https://github.com/MechEng70/pitplanner/releases/download/v0.3.0/pitplanner-0.3.0.apk',
    );
  });

  test('anything else is no link', () => {
    for (const url of [
      'http://github.com/MechEng70/pitplanner/releases/latest', // not https
      'https://evil.example/pitplanner.apk',
      'https://github.com.evil.example/MechEng70/pitplanner/releases/latest',
      'https://github.com@evil.example/MechEng70/pitplanner/releases/latest',
      'https://user:pw@github.com/MechEng70/pitplanner/releases/latest',
      'https://github.com:8443/MechEng70/pitplanner/releases/latest',
      'https://objects.githubusercontent.com/github-production-release-asset/1/2', // where a download redirects
      'https://github.com/MechEng70/other/releases/latest',
      'https://github.com/someone/pitplanner/releases/download/v1/pitplanner-1.apk',
      'https://github.com/MechEng70/pitplanner/archive/refs/heads/main.zip',
      'https://github.com/MechEng70/pitplanner/releases/download/../../../evil/x.apk',
      'https://github.com/MechEng70/pitplanner/releases/download/%2e%2e/x.apk',
      'https://github.com/MechEng70/pitplanner/releases/download/v1/x.exe',
      'https://github.com/MechEng70/pitplanner/releases/download/v1/sub/x.apk',
      'https://github.com/MechEng70/pitplanner/releases/latest?go=https://evil.example',
      'https://github.com/MechEng70/pitplanner/releases/latest#x',
      `${RELEASES_PAGE} `,
      `${RELEASES_PAGE}\n`,
      'javascript:alert(1)',
      'intent://scan/#Intent;scheme=zxing;end',
      'file:///sdcard/Download/pitplanner.apk',
      '',
    ])
      expect([url, releaseLink(url)]).toEqual([url, null]);
    for (const v of [undefined, null, 7, {}, ['https://github.com/MechEng70/pitplanner/releases/latest']])
      expect(releaseLink(v)).toBeNull();
  });
});

describe('the update check keeps only those links', () => {
  const release = (apkUrl: unknown, htmlUrl: unknown = TAG_PAGE) => ({
    tag_name: 'v0.3.0-beta.2',
    html_url: htmlUrl as string,
    assets: [{ name: 'pitplanner-0.3.0-beta.2.apk', browser_download_url: apkUrl as string }],
  });

  test('the APK link from GitHub is offered', () => {
    expect(fromRelease(release(DOWNLOAD), 5)).toEqual({ checkedAt: 5, latest: 'v0.3.0-beta.2', url: DOWNLOAD });
  });

  test('regression (finding 8): an APK link elsewhere is dropped for the release page', () => {
    expect(fromRelease(release('https://evil.example/pitplanner.apk'), 5).url).toBe(TAG_PAGE);
    expect(fromRelease(release('http://github.com/MechEng70/pitplanner/releases/download/v1/p.apk'), 5).url).toBe(
      TAG_PAGE,
    );
  });

  test('regression (finding 8): with neither link on GitHub, the fixed releases page', () => {
    expect(fromRelease(release('https://evil.example/a.apk', 'https://evil.example/tag'), 5).url).toBe(RELEASES_PAGE);
    expect(fromRelease(release(undefined, 'javascript:alert(1)'), 5).url).toBe(RELEASES_PAGE);
  });

  test('end to end: a list with a link elsewhere still finds the version, never the link', async () => {
    const get = async () => ({
      ok: true,
      json: [release('https://evil.example/pitplanner.apk', 'https://evil.example')],
    });
    expect(await fetchLatest(50, '0.3.0-beta.1', get)).toEqual({
      checkedAt: 50,
      latest: 'v0.3.0-beta.2',
      url: RELEASES_PAGE,
    });
  });
});
