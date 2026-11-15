package io.github.mecheng70.pitplanner.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File
import java.nio.file.Files

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class SendFileTest {
  private val context: Context = RuntimeEnvironment.getApplication()
  private val roots = listOf(context.cacheDir, context.filesDir)
  private val uri: Uri =
    Uri.parse("content://io.github.mecheng70.pitplanner.FileSystemFileProvider/cached_expo_files/debug.json")

  private fun url(file: File) = "file://" + file.absolutePath
  private fun cached(name: String) = File(context.cacheDir, name).apply { writeText("{}") }

  @Suppress("DEPRECATION")
  private fun stream(intent: Intent): Uri? = intent.getParcelableExtra(Intent.EXTRA_STREAM)

  @Suppress("DEPRECATION")
  private fun inner(chooser: Intent): Intent? = chooser.getParcelableExtra(Intent.EXTRA_INTENT)

  // ---- which file may be sent ----

  @Test
  fun aFileInTheCacheOrFilesFolderIsTaken() {
    val inCache = cached("pitplanner-debug.json")
    assertEquals(inCache.canonicalFile, SendFile.ownFile(url(inCache), roots))
    val inFiles = File(context.filesDir, "kept.json").apply { writeText("{}") }
    assertEquals(inFiles.canonicalFile, SendFile.ownFile(url(inFiles), roots))
    val nested = File(context.cacheDir, "reports").apply { mkdirs() }
    val deep = File(nested, "a b.json").apply { writeText("{}") }
    assertEquals(deep.canonicalFile, SendFile.ownFile(deep.toURI().toString(), roots))
  }

  @Test
  fun aFileOutsideTheAppsFoldersIsRefused() {
    val outside = File.createTempFile("outside", ".json")
    try {
      assertNull(SendFile.ownFile(url(outside), roots))
    } finally {
      outside.delete()
    }
    assertNull(SendFile.ownFile("file:///etc/hosts", roots))
    assertNull(SendFile.ownFile("file:///data/data/com.example.other/files/x.json", roots))
  }

  @Test
  fun dotDotOutOfTheFolderIsRefused() {
    val outside = File(context.cacheDir.parentFile, "outside-by-dots.json").apply { writeText("{}") }
    try {
      assertNull(SendFile.ownFile("file://" + context.cacheDir.absolutePath + "/../" + outside.name, roots))
    } finally {
      outside.delete()
    }
  }

  @Test
  fun aSymlinkOutOfTheFolderIsRefused() {
    val outside = File.createTempFile("target", ".json")
    val link = File(context.cacheDir, "link.json")
    try {
      link.delete()
      Files.createSymbolicLink(link.toPath(), outside.toPath())
      assertNull(SendFile.ownFile(url(link), roots))
    } finally {
      link.delete()
      outside.delete()
    }
  }

  @Test
  fun aSiblingFolderWithTheSamePrefixIsRefused() {
    val sibling = File(context.cacheDir.parentFile, context.cacheDir.name + "-other").apply { mkdirs() }
    val file = File(sibling, "x.json").apply { writeText("{}") }
    try {
      assertNull(SendFile.ownFile(url(file), roots))
    } finally {
      file.delete()
      sibling.delete()
    }
  }

  @Test
  fun onlyAPlainExistingFileUrlIsTaken() {
    val file = cached("plain.json")
    assertNull(SendFile.ownFile(null, roots))
    assertNull(SendFile.ownFile("", roots))
    assertNull(SendFile.ownFile(file.absolutePath, roots)) // a bare path, no scheme
    assertNull(SendFile.ownFile("content://" + file.absolutePath, roots))
    assertNull(SendFile.ownFile("https://example.com" + file.absolutePath, roots))
    assertNull(SendFile.ownFile("file://example.com" + file.absolutePath, roots))
    assertNull(SendFile.ownFile(url(file) + "?x=1", roots))
    assertNull(SendFile.ownFile("file://" + context.cacheDir.absolutePath + "/has space.json", roots)) // not a URL
    assertNull(SendFile.ownFile(url(File(context.cacheDir, "gone.json")), roots))
    assertNull(SendFile.ownFile(url(context.cacheDir), roots)) // the folder itself
  }

  // ---- the fields ----

  @Test
  fun oneAddressIsARecipientAnythingElseIsNot() {
    assertEquals("dev@example.com", SendFile.recipient("dev@example.com"))
    assertEquals("dev@example.com", SendFile.recipient("  dev@example.com "))
    assertNull(SendFile.recipient(null))
    assertNull(SendFile.recipient(""))
    assertNull(SendFile.recipient("dev"))
    assertNull(SendFile.recipient("a@example.com, b@example.com"))
    assertNull(SendFile.recipient("a@example.com;b@example.com"))
    assertNull(SendFile.recipient("a@example.com\nBcc: b@example.com"))
    assertNull(SendFile.recipient("Dev <dev@example.com>"))
  }

  @Test
  fun theSubjectIsOneShortLine() {
    assertEquals("Pit Planner debug file", SendFile.subject("Pit Planner debug file"))
    assertEquals("a b", SendFile.subject(" a\r\nb "))
    assertEquals("", SendFile.subject(null))
    assertEquals(SendFile.MAX_SUBJECT, SendFile.subject("x".repeat(500)).length)
  }

  @Test
  fun aMimeTypeThatIsNotOneBecomesAnyType() {
    assertEquals("application/json", SendFile.mimeType("application/json"))
    assertEquals("application/x-tar", SendFile.mimeType(" application/x-tar "))
    assertEquals("*/*", SendFile.mimeType(null))
    assertEquals("*/*", SendFile.mimeType(""))
    assertEquals("*/*", SendFile.mimeType("json"))
    assertEquals("*/*", SendFile.mimeType("application/json; charset=utf-8"))
  }

  @Test
  fun theProviderIsTheAppsOwnFileSystemProvider() {
    assertEquals(
      "io.github.mecheng70.pitplanner.FileSystemFileProvider",
      SendFile.authority("io.github.mecheng70.pitplanner"),
    )
  }

  // ---- the intent ----

  @Test
  fun theIntentSendsOneFileWithTheRecipientSubjectTypeAndAReadGrant() {
    val intent = SendFile.intent(uri, "application/json", "dev@example.com", "Pit Planner debug file")
    assertEquals(Intent.ACTION_SEND, intent.action)
    assertEquals("application/json", intent.type)
    assertEquals(uri, stream(intent))
    assertArrayEquals(arrayOf("dev@example.com"), intent.getStringArrayExtra(Intent.EXTRA_EMAIL))
    assertEquals("Pit Planner debug file", intent.getStringExtra(Intent.EXTRA_SUBJECT))
    assertTrue(intent.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
    assertEquals(0, intent.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    assertEquals(0, intent.flags and Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    assertNull(intent.data)
    assertNull(intent.component)
    assertNull(intent.`package`)
    val clip = intent.clipData
    assertNotNull(clip)
    assertEquals(1, clip!!.itemCount)
    assertEquals(uri, clip.getItemAt(0).uri)
  }

  @Test
  fun aBadRecipientOrAnEmptySubjectIsLeftOutAndTheFileStillGoes() {
    val intent = SendFile.intent(uri, "application/json", "a@example.com, b@example.com", "  ")
    assertFalse(intent.hasExtra(Intent.EXTRA_EMAIL))
    assertFalse(intent.hasExtra(Intent.EXTRA_SUBJECT))
    assertFalse(intent.hasExtra(Intent.EXTRA_CC))
    assertFalse(intent.hasExtra(Intent.EXTRA_BCC))
    assertEquals(uri, stream(intent))
  }

  @Test
  fun theChooserWrapsTheIntentAndCarriesTheReadGrant() {
    val intent = SendFile.intent(uri, "application/json", "dev@example.com", "Pit Planner debug file")
    val chooser = SendFile.chooser(intent, "Send to dev@example.com")
    assertEquals(Intent.ACTION_CHOOSER, chooser.action)
    assertEquals("Send to dev@example.com", chooser.getStringExtra(Intent.EXTRA_TITLE))
    assertTrue(chooser.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
    val wrapped = inner(chooser)
    assertNotNull(wrapped)
    assertEquals(Intent.ACTION_SEND, wrapped!!.action)
    assertEquals(uri, stream(wrapped))
  }
}
