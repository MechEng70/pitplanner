package io.github.mecheng70.pitplanner.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.InputStream

/**
 * A .pitplan file handed to the app by a VIEW or SEND intent (SPEC section 3, Share; the 0.2.0
 * SharedPlanPlugin on the Expo Modules API). The file is untrusted: at most MAX_BYTES are ever read, only
 * the URI the intent itself carries is opened (never a path or URI found inside the file), and the text
 * goes to the JS parser (src/lib/sharedPlan.ts), which checks every field.
 */
object OpenedPlan {
  const val MAX_BYTES = 256 * 1024
  const val TOO_BIG = "tooBig"
  const val UNREADABLE = "unreadable"

  const val LOG_TAG = "PitShare"

  /** A content:// or file:// URI anywhere in a message, cut down to its provider. */
  private val URI_IN_TEXT = Regex("""(content|file)://([^/\s]*)\S*""")
  private fun cut(text: String) = URI_IN_TEXT.replace(text) { "${it.groupValues[1]}://${it.groupValues[2]}/..." }

  /**
   * The log line for a read that failed: the exception's class and message and its cause's, so the next
   * "Could not read that file." can be explained (2026-11-16: a Gmail attachment, nothing logged). Every URI
   * is cut to scheme and provider: a mail app's URI can hold an account name and the file's name. Nothing
   * from inside the file is ever in it.
   */
  fun describe(e: Throwable, uri: Uri): String {
    val one = { t: Throwable -> "${t.javaClass.name}: ${cut(t.message ?: "")}" }
    val cause = e.cause?.takeIf { it !== e }?.let { "; cause ${one(it)}" } ?: ""
    return "open failed for ${cut(uri.toString())}: ${one(e)}$cause"
  }

  /** Set on an intent once its file has been offered, so a recreated activity does not open it again. */
  private const val HANDLED = "io.github.mecheng70.pitplanner.share.HANDLED"

  /**
   * The file URI of a hand-off intent, or null for every other intent: the launcher, a `pitplanner://` link,
   * an intent already handled, or the same intent coming back when the app is reopened from Recents.
   * Only content:// and file:// are taken.
   */
  fun uriOf(intent: Intent?): Uri? {
    if (intent == null || intent.getBooleanExtra(HANDLED, false)) return null
    if (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) return null
    val uri = when (intent.action) {
      Intent.ACTION_VIEW -> intent.data
      Intent.ACTION_SEND -> stream(intent)
      else -> null
    } ?: return null
    return if (uri.scheme == "content" || uri.scheme == "file") uri else null
  }

  fun markHandled(intent: Intent) {
    intent.putExtra(HANDLED, true)
  }

  private fun stream(intent: Intent): Uri? = try {
    if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }
  } catch (e: RuntimeException) {
    null // an extra that is not a Uri, or one that cannot be unparcelled
  }

  /**
   * At most `max` bytes of the stream, or null when it holds more. Reads one byte past the cap at most, so
   * a huge or endless stream costs no more than a small one.
   */
  fun readCapped(input: InputStream, max: Int = MAX_BYTES): ByteArray? {
    val out = ByteArrayOutputStream()
    val buf = ByteArray(8192)
    var total = 0
    while (total <= max) {
      val r = input.read(buf, 0, minOf(buf.size, max + 1 - total))
      if (r < 0) break
      out.write(buf, 0, r)
      total += r
    }
    return if (total > max) null else out.toByteArray()
  }

  /** What JS gets: `text` (and `name` when the provider gives one), or `error`. Never throws. */
  fun read(context: Context, uri: Uri, max: Int = MAX_BYTES): Map<String, String> {
    val bytes = try {
      val input = context.contentResolver.openInputStream(uri)
      if (input == null) {
        Log.w(LOG_TAG, "open failed for ${cut(uri.toString())}: the provider gave no stream")
        return mapOf("error" to UNREADABLE)
      }
      input.use { readCapped(it, max) }
    } catch (e: Exception) {
      // No such file, no permission for the URI, a provider that failed: all the same to the user. The log
      // says which.
      Log.w(LOG_TAG, describe(e, uri))
      return mapOf("error" to UNREADABLE)
    } ?: return mapOf("error" to TOO_BIG)
    val out = mutableMapOf("text" to String(bytes, Charsets.UTF_8))
    displayName(context, uri)?.let { out["name"] = it }
    return out
  }

  private fun displayName(context: Context, uri: Uri): String? = try {
    if (uri.scheme == "file") {
      uri.lastPathSegment
    } else {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) c.getString(0) else null
      }
    }
  } catch (e: Exception) {
    null
  }
}
