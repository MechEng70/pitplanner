// The Gradle edit behind plugins/withReleaseSigning.ts (TECH-DESIGN section 10, T-007). Pure, so node:test
// checks it against the generated build.gradle (plugins/fixtures/app-build.gradle).
//
// Release builds sign with the key named in the git-ignored keystore.properties at the repo root (path to
// ~/keys/pitplanner.jks, alias, passwords). Gradle reads the file at build time; nothing secret is written
// into android/. Without the file a release build fails rather than falling back to the debug key.

export const MARKER = '// pitplanner: release signing (plugins/withReleaseSigning)';

const HEADER = `${MARKER}
def pitKeystoreFile = rootProject.file('../keystore.properties')
def pitKeystore = new Properties()
if (pitKeystoreFile.exists()) {
    pitKeystoreFile.withInputStream { pitKeystore.load(it) }
}

`;

const RELEASE_CONFIG = `        release {
            if (pitKeystoreFile.exists()) {
                storeFile file(pitKeystore['storeFile'])
                storePassword pitKeystore['storePassword']
                keyAlias pitKeystore['keyAlias']
                keyPassword pitKeystore['keyPassword']
            }
        }
`;

const GUARD = `
${MARKER}: no fallback to the debug key.
tasks.matching { it.name ==~ /(assemble|bundle|package)[A-Za-z]*Release/ }.configureEach {
    doFirst {
        if (!pitKeystoreFile.exists()) {
            throw new GradleException("keystore.properties is missing at the repo root: release builds must be signed with the release key (see keystore.properties.example).")
        }
    }
}
`;

function fail(what: string): never {
  throw new Error(
    `withReleaseSigning: ${what} not found in android/app/build.gradle; update plugins/releaseSigning.ts`,
  );
}

export function applyReleaseSigning(gradle: string): string {
  if (gradle.includes(MARKER)) return gradle;
  let out = gradle;

  const android = out.indexOf('\nandroid {');
  if (android < 0) fail('the android block');
  out = `${out.slice(0, android + 1)}${HEADER}${out.slice(android + 1)}`;

  const configs = out.indexOf('    signingConfigs {\n');
  if (configs < 0) fail('signingConfigs');
  const at = configs + '    signingConfigs {\n'.length;
  out = `${out.slice(0, at)}${RELEASE_CONFIG}${out.slice(at)}`;

  const types = out.indexOf('    buildTypes {');
  const release = types < 0 ? -1 : out.indexOf('        release {', types);
  if (release < 0) fail('buildTypes.release');
  const debugKey = out.indexOf('signingConfig signingConfigs.debug', release);
  const blockEnd = out.indexOf('\n        }', release);
  if (debugKey < 0 || debugKey > blockEnd) fail('the release signingConfig');
  out = `${out.slice(0, debugKey)}signingConfig signingConfigs.release${out.slice(debugKey + 'signingConfig signingConfigs.debug'.length)}`;

  return `${out}${GUARD}`;
}
