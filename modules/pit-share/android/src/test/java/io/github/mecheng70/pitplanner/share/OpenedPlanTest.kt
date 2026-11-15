package io.github.mecheng70.pitplanner.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class OpenedPlanTest {
  private val context: Context = RuntimeEnvironment.getApplication()
  private val content: Uri = Uri.parse("content://com.example.mail/attachments/7")
  private val plan = """{"app":"pit-planner","version":1}"""

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
    val file = File(context.cacheDir, "saturday.pitplan").apply { writeText(plan) }
    val out = OpenedPlan.read(context, Uri.fromFile(file))
    assertEquals(plan, out["text"])
    assertEquals("saturday.pitplan", out["name"])
  }

  @Test
  fun anOversizedFileIsAnErrorAndNoTextIsReturned() {
    val file = File(context.cacheDir, "big.pitplan").apply { writeBytes(ByteArray(OpenedPlan.MAX_BYTES + 1)) }
    assertEquals(mapOf("error" to OpenedPlan.TOO_BIG), OpenedPlan.read(context, Uri.fromFile(file)))
  }

  @Test
  fun aFileThatCannotBeOpenedIsAnErrorNotACrash() {
    val gone = Uri.fromFile(File(context.cacheDir, "gone.pitplan"))
    assertEquals(mapOf("error" to OpenedPlan.UNREADABLE), OpenedPlan.read(context, gone))
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
