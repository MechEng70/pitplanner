package io.github.mecheng70.pitplanner.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLog
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileNotFoundException
import java.io.InputStream
import java.nio.file.Files

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class OpenedPlanTest {
  private val context: Context = RuntimeEnvironment.getApplication()
  private val content: Uri = Uri.parse("content://com.example.mail/attachments/7")
  private val plan = """{"app":"pit-planner","version":1}"""

  /** A folder outside the app's own storage: where a file manager's or a download's file:// points. */
  @get:Rule
  val shared = TemporaryFolder()

  private fun outside(name: String): File {
    val file = File(shared.root, name)
    // The test means nothing if the folder happened to be inside the app's data.
    assertFalse(file.canonicalPath.startsWith(context.dataDir.canonicalPath + File.separator))
    return file
  }

  private fun view(uri: Uri?) = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/json")
  private fun send(uri: Uri?) =
    Intent(Intent.ACTION_SEND).setType("application/octet-stream").putExtra(Intent.EXTRA_STREAM, uri)

  /** A stream that never ends and counts what was asked of it. */
  private class Endless : InputStream() {
    var served = 0L
    override fun read(): Int {
      served++
      return 'a'.code
    }
    override fun read(b: ByteArray, off: Int, len: Int): Int {
      served += len
      b.fill('a'.code.toByte(), off, off + len)
      return len
    }
  }

  // ---- which intents carry a file ----

  @Test
  fun viewAndSendIntentsCarryTheFile() {
    assertEquals(content, OpenedPlan.uriOf(view(content)))
    assertEquals(content, OpenedPlan.uriOf(send(content)))
    val file = Uri.parse("file:///storage/emulated/0/Download/saturday.pitplan")
    assertEquals(file, OpenedPlan.uriOf(view(file)))
  }

  @Test
  fun otherIntentsCarryNothing() {
    assertNull(OpenedPlan.uriOf(null))
    assertNull(OpenedPlan.uriOf(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)))
    assertNull(OpenedPlan.uriOf(Intent(Intent.ACTION_VIEW)))
    assertNull(OpenedPlan.uriOf(Intent(Intent.ACTION_SEND).setType("application/json")))
    assertNull(OpenedPlan.uriOf(Intent(Intent.ACTION_EDIT).setData(content)))
  }

  @Test
  fun onlyContentAndFileUrisAreTaken() {
    assertNull(OpenedPlan.uriOf(view(Uri.parse("https://example.com/saturday.pitplan"))))
    assertNull(OpenedPlan.uriOf(view(Uri.parse("pitplanner://dev/db"))))
    assertNull(OpenedPlan.uriOf(send(Uri.parse("http://example.com/x"))))
  }

  @Test
  fun aSendExtraThatIsNotAUriIsIgnored() {
    val intent = Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM, "content://x/1")
    assertNull(OpenedPlan.uriOf(intent))
  }

  @Test
  fun regressionAHandledIntentIsNotOpenedAgain() {
    val intent = view(content)
    OpenedPlan.markHandled(intent)
    assertNull(OpenedPlan.uriOf(intent))
  }

  @Test
  fun reopeningFromRecentsDoesNotOpenTheFileAgain() {
    assertNull(OpenedPlan.uriOf(view(content).addFlags(Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY)))
  }

  // ---- the size cap ----

  @Test
  fun aStreamUpToTheCapIsReadWhole() {
    val bytes = ByteArray(OpenedPlan.MAX_BYTES) { 'a'.code.toByte() }
    assertArrayEquals(bytes, OpenedPlan.readCapped(ByteArrayInputStream(bytes)))
    assertArrayEquals(ByteArray(0), OpenedPlan.readCapped(ByteArrayInputStream(ByteArray(0))))
  }

  @Test
  fun oneByteOverTheCapIsRefused() {
    assertNull(OpenedPlan.readCapped(ByteArrayInputStream(ByteArray(OpenedPlan.MAX_BYTES + 1))))
    assertNull(OpenedPlan.readCapped(ByteArrayInputStream(ByteArray(11)), 10))
  }

  @Test
  fun anEndlessStreamIsReadOnlyOneByteOverTheCap() {
    val endless = Endless()
    assertNull(OpenedPlan.readCapped(endless, 1000))
    assertEquals(1001L, endless.served)
  }

  // ---- reading ----

  @Test
  fun readsAContentUriWithItsDisplayName() {
    shadowOf(context.contentResolver).registerInputStream(content, ByteArrayInputStream(plan.toByteArray()))
    val out = OpenedPlan.read(context, content)
    assertEquals(plan, out["text"])
    assertFalse(out.containsKey("error"))
  }

  @Test
  fun readsAFileUri() {
    val file = outside("saturday.pitplan").apply { writeText(plan) }
    val out = OpenedPlan.read(context, Uri.fromFile(file))
    assertEquals(plan, out["text"])
    assertEquals("saturday.pitplan", out["name"])
  }

  @Test
  fun anOversizedFileIsAnErrorAndNoTextIsReturned() {
    val file = outside("big.pitplan").apply { writeBytes(ByteArray(OpenedPlan.MAX_BYTES + 1)) }
    assertEquals(mapOf("error" to OpenedPlan.TOO_BIG), OpenedPlan.read(context, Uri.fromFile(file)))
  }

  @Test
  fun aFileThatCannotBeOpenedIsAnErrorNotACrash() {
    val gone = Uri.fromFile(outside("gone.pitplan"))
    assertEquals(mapOf("error" to OpenedPlan.UNREADABLE), OpenedPlan.read(context, gone))
  }

  // ---- the app's own storage is never opened (T-035, security pass finding 3) ----

  private val pkg = "io.github.mecheng70.pitplanner"
  private val ownDirs get() = listOf(context.dataDir, context.filesDir, context.cacheDir)
  private fun ownStorage(uri: String, ownAuthority: (String) -> Boolean = { false }) =
    OpenedPlan.ownStorage(Uri.parse(uri), pkg, ownDirs, ownAuthority)
  private fun fileUri(file: File) = Uri.fromFile(file).toString()

  @Test
  fun aFileInsideTheAppsDataFoldersIsRefused() {
    val db = File(context.filesDir, "SQLite/pitplanner.db").apply { parentFile!!.mkdirs(); writeText("x") }
    assertEquals(OpenedPlan.OWN_FILE, ownStorage(fileUri(db)))
    assertEquals(OpenedPlan.OWN_FILE, ownStorage(fileUri(File(context.cacheDir, "cook.pitplan"))))
    val prefs = File(context.dataDir, "shared_prefs/CapacitorStorage.xml")
    assertEquals(OpenedPlan.OWN_FILE, ownStorage(fileUri(prefs)))
    // The folder itself, and a file that does not exist (yet): still the app's storage.
    assertEquals(OpenedPlan.OWN_FILE, ownStorage(fileUri(context.filesDir)))
    assertEquals(OpenedPlan.OWN_FILE, ownStorage(fileUri(File(context.filesDir, "not-there.pitplan"))))
  }

  @Test
  fun dotDotAndSymlinksAreResolvedBeforeTheCheck() {
    val target = File(context.filesDir, "SQLite/pitplanner.db").apply { parentFile!!.mkdirs(); writeText("x") }
    // file:///<shared folder>/../../<...>/files/SQLite/pitplanner.db
    val up = "../".repeat(shared.root.canonicalPath.count { it == '/' })
    val dotted = "file://" + shared.root.canonicalPath + "/" + up + target.canonicalPath.drop(1)
    assertEquals(OpenedPlan.OWN_FILE, ownStorage(dotted))
    // A link in shared storage that leads into the app's files.
    val link = outside("saturday.pitplan").toPath()
    Files.createSymbolicLink(link, target.toPath())
    assertEquals(OpenedPlan.OWN_FILE, ownStorage(fileUri(link.toFile())))
    // The app's own process (/proc/self/fd/<n> also leads to its open files, and resolves to their paths).
    assertEquals(OpenedPlan.OWN_FILE, ownStorage("file:///proc/self/maps"))
  }

  @Test
  fun aFileUriWithoutAPathIsRefused() {
    assertEquals(OpenedPlan.NO_PATH, ownStorage("file://"))
    assertEquals(OpenedPlan.NO_PATH, ownStorage("file:"))
  }

  @Test
  fun theAppsOwnProvidersAreRefused() {
    val own = listOf(
      "content://$pkg.FileSystemFileProvider/cached_expo_files/cook.pitplan",
      "content://$pkg.SharingFileProvider/shared/cook.pitplan",
      "content://$pkg.androidx-startup/x",
      "content://$pkg/x",
      // A user id in front of the authority reaches the same provider.
      "content://0@$pkg.FileSystemFileProvider/files/SQLite/pitplanner.db",
      "content://IO.GITHUB.MECHENG70.PITPLANNER.FileSystemFileProvider/x",
      // The dev build's providers are refused by the release too (and by the dev build itself).
      "content://$pkg.debug.FileSystemFileProvider/x",
    )
    for (uri in own) assertEquals(uri, OpenedPlan.OWN_PROVIDER, ownStorage(uri))
    // A provider of the app's under another name, as Android's package manager reports it.
    assertEquals(OpenedPlan.OWN_PROVIDER, ownStorage("content://other.name/x") { it == "other.name" })
  }

  @Test
  fun filesFromOtherAppsAndSharedStorageAreStillOpened() {
    val others = listOf(
      "content://com.google.android.gm.sggsprovider/0/1/attachments/7/BEST/false", // Gmail
      "content://com.google.android.apps.docs.storage/document/acc%3D1%3Bdoc%3Dencoded%3Dabc", // Drive
      "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fsaturday.pitplan", // Files
      "content://com.android.providers.downloads.documents/document/msf%3A1000000123",
      "content://media/external/downloads/123",
      "content://${pkg}x.provider/x", // a name that only starts with the same letters
      "file:///storage/emulated/0/Download/saturday.pitplan",
      "file:///sdcard/Download/saturday%20plan.pitplan",
      fileUri(outside("saturday.pitplan")),
    )
    for (uri in others) assertNull(uri, ownStorage(uri))
  }

  // Regression (finding 3): another app hands over a file:// into Pit Planner's own files. Before T-035 the
  // app read it (up to 256 KB) with its own identity.
  @Test
  fun readRefusesTheAppsOwnFileWithoutOpeningItAndLogsWhyWithoutThePath() {
    ShadowLog.clear()
    val own = File(context.filesDir, "secret-name.pitplan").apply { writeText(plan) }
    assertEquals(mapOf("error" to OpenedPlan.UNREADABLE), OpenedPlan.read(context, Uri.fromFile(own)))
    val lines = ShadowLog.getLogsForTag(OpenedPlan.LOG_TAG).map { it.msg }
    assertEquals(listOf("open refused for file:///...: ${OpenedPlan.OWN_FILE}"), lines)
  }

  @Test
  fun readRefusesTheAppsOwnProviderWithoutOpeningIt() {
    ShadowLog.clear()
    val authority = "${context.packageName}.FileSystemFileProvider"
    val own = Uri.parse("content://$authority/files/secret-name.pitplan")
    // Were it opened, it would read: the refusal comes first.
    shadowOf(context.contentResolver).registerInputStream(own, ByteArrayInputStream(plan.toByteArray()))
    assertEquals(mapOf("error" to OpenedPlan.UNREADABLE), OpenedPlan.read(context, own))
    val lines = ShadowLog.getLogsForTag(OpenedPlan.LOG_TAG).map { it.msg }
    assertEquals(listOf("open refused for content://$authority/...: ${OpenedPlan.OWN_PROVIDER}"), lines)
  }

  // ---- the log line (finding 5): exception classes and fixed reasons, never the message text ----

  // Regression (2026-11-16, Jason's phone): a Gmail attachment opened cold through the dev launcher said
  // "Could not read that file." and nothing anywhere said why: the exception was swallowed.
  @Test
  fun aFailedReadLogsTheExceptionWithoutTheFilesPath() {
    ShadowLog.clear()
    val secret = Uri.parse("content://com.example.mail/someone@example.com/attachments/7")
    // What Android does when the permission for the URI is gone: the open itself throws.
    shadowOf(context.contentResolver).registerInputStreamSupplier(secret) {
      throw SecurityException("Permission Denial: reading $secret requires a grant")
    }
    assertEquals(mapOf("error" to OpenedPlan.UNREADABLE), OpenedPlan.read(context, secret))
    val lines = ShadowLog.getLogsForTag(OpenedPlan.LOG_TAG).map { it.msg }
    assertEquals(
      listOf("open failed for content://com.example.mail/...: java.lang.SecurityException (no permission for the URI)"),
      lines,
    )
  }

  @Test
  fun theLogLineNamesTheExceptionAndItsCauseWithFixedReasonsAndNoMessageText() {
    val e = SecurityException(
      "Permission Denial: opening provider com.example.Mail from ProcessRecord{1:app/u0a1} (pid=1, uid=2) " +
        "for content://com.example.mail/me@example.com/att/9 requires that you obtain access",
      IllegalStateException("inner file:///storage/emulated/0/Download/cook.pitplan for me@example.com"),
    )
    val line = OpenedPlan.describe(e, Uri.parse("content://com.example.mail/me@example.com/att/9"))
    assertEquals(
      "open failed for content://com.example.mail/...: java.lang.SecurityException (no permission for the URI); " +
        "cause java.lang.IllegalStateException",
      line,
    )
    assertFalse(line, line.contains("me@example.com"))
    assertFalse(line, line.contains("ProcessRecord"))
  }

  // Regression (finding 5): for a file:// URI Android's error message is the bare path, which the URI cut did
  // not catch: "/storage/emulated/0/Download/<name>: open failed: EACCES (Permission denied)".
  @Test
  fun aBarePathInTheMessageIsNotLogged() {
    val e = FileNotFoundException(
      "/storage/emulated/0/Download/Smith family cook.pitplan: open failed: EACCES (Permission denied)",
    )
    val line = OpenedPlan.describe(e, Uri.parse("file:///storage/emulated/0/Download/Smith%20family%20cook.pitplan"))
    assertEquals("open failed for file:///...: java.io.FileNotFoundException (not found or not readable, EACCES)", line)
    assertFalse(line, line.contains("Smith"))
    assertFalse(line, line.contains("/storage"))
    // The error name comes only from Android's own wording, and only when it is one Android uses.
    val plain = "open failed for file:///...: java.io.FileNotFoundException (not found or not readable)"
    assertEquals(plain, OpenedPlan.describe(FileNotFoundException("/x/EMAILS.pitplan"), Uri.parse("file:///x")))
    assertEquals(plain, OpenedPlan.describe(FileNotFoundException("x: open failed: ESECRET (y)"), Uri.parse("file:///x")))
  }

  @Test
  fun aRealFailedFileOpenIsLoggedWithoutItsPath() {
    ShadowLog.clear()
    val gone = outside("Smith family cook.pitplan")
    assertEquals(mapOf("error" to OpenedPlan.UNREADABLE), OpenedPlan.read(context, Uri.fromFile(gone)))
    val lines = ShadowLog.getLogsForTag(OpenedPlan.LOG_TAG).map { it.msg }
    assertEquals(1, lines.size)
    assertTrue(lines[0], lines[0].startsWith("open failed for file:///...: java.io.FileNotFoundException"))
    assertFalse(lines[0], lines[0].contains("Smith"))
    assertFalse(lines[0], lines[0].contains(shared.root.name))
  }

  // ---- the module's one-file inbox ----

  @Test
  fun aFileIsOfferedOnceAndTakenOnce() {
    val intent = view(content)
    assertTrue(PitShareModule.offer(intent))
    assertFalse(PitShareModule.offer(intent))
    assertEquals(content, PitShareModule.take())
    assertNull(PitShareModule.take())
  }

  @Test
  fun anIntentWithoutAFileIsNotOffered() {
    assertFalse(PitShareModule.offer(Intent(Intent.ACTION_MAIN)))
    assertNull(PitShareModule.take())
  }

  @Test
  fun registersUnderTheNameTheJsSideUses() {
    assertEquals("PitShare", PitShareModule.MODULE_NAME)
    assertEquals("planOpened", PitShareModule.EVENT_OPENED)
  }
}
