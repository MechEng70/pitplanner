package io.github.mecheng70.pitplanner.share

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileNotFoundException
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

  /** A content:// or file:// URI, cut down to its scheme and provider. */
  private val URI_IN_TEXT = Regex("""(content|file)://([^/\s]*)\S*""")
  private fun cut(text: String) = URI_IN_TEXT.replace(text) { "${it.groupValues[1]}://${it.groupValues[2]}/..." }

  /** The error names Android puts after "open failed: " in a file error. Only these words are ever logged. */
  private val ERRNO = setOf(
    "EACCES", "EPERM", "ENOENT", "EISDIR", "ENOTDIR", "ELOOP", "ENAMETOOLONG", "EROFS", "EIO", "ENXIO",
    "EINVAL", "EMFILE", "ENFILE", "EBUSY", "ENODEV",
  )
  private val OPEN_FAILED = Regex("""open failed: (E[A-Z]+)\b""")

  /** A short fixed reason for an exception's class; for a file error, with its error name (EACCES). */
  private fun reason(t: Throwable): String? = when (t) {
    is SecurityException -> "no permission for the URI"
    is FileNotFoundException -> {
      val errno = OPEN_FAILED.find(t.message ?: "")?.groupValues?.get(1)?.takeIf { it in ERRNO }
      if (errno != null) "not found or not readable, $errno" else "not found or not readable"
    }
    else -> null
  }

  /**
   * The log line for a read that failed, so the next "Could not read that file." can be explained
   * (2026-11-16: a Gmail attachment, nothing logged): the exception's class and a fixed short reason, the
   * same for its cause, and the URI cut to scheme and provider.
   *
   * The exception's message is never logged (T-035, security pass finding 5). It is free text from Android
   * or from the app that gave the file: a file error is the bare path ("/storage/emulated/0/Download/<name>:
   * open failed: EACCES ..."), and a provider may name an account or a file in its own words. No cutting rule
   * catches all of that, and the class with the reason is enough to tell no permission from a missing file
   * from a provider that failed. Nothing from inside the file is ever logged either.
   */
  fun describe(e: Throwable, uri: Uri): String {
    val one = { t: Throwable -> t.javaClass.name + (reason(t)?.let { " ($it)" } ?: "") }
    val cause = e.cause?.takeIf { it !== e }?.let { "; cause ${one(it)}" } ?: ""
    return "open failed for ${cut(uri.toString())}: ${one(e)}$cause"
  }

  const val OWN_FILE = "a file in the app's own storage"
  const val OWN_PROVIDER = "one of the app's own providers"
  const val NO_PATH = "a file URI without a path that can be resolved"

  /**
   * Why a URI must not be opened, or null when it may be (T-035, security pass finding 3). Another app can
   * hand over a URI that points back into Pit Planner's own private data, which the app could read and the
   * sender could not. Refused:
   *  - a file:// URI whose canonical path (`..` and symlinks resolved) is inside one of `privateDirs` (the
   *    app's data folders), or under /proc (the app's own process: /proc/self/fd/... leads to its open files);
   *  - a content:// URI of one of the app's own providers: an authority that is the package name or starts
   *    with it and a dot (expo-file-system's, expo-sharing's and androidx's providers all do), with or
   *    without a user id in front ("0@..."), or any authority `ownAuthority` says is the app's.
   * Everything else may be opened: Gmail's, Drive's, Files' or a file manager's content:// URI, and a file://
   * in shared storage.
   */
  fun ownStorage(
    uri: Uri,
    packageName: String,
    privateDirs: List<File>,
    ownAuthority: (String) -> Boolean = { false },
  ): String? = when (uri.scheme?.lowercase()) {
    "file" -> {
      val path = uri.path
      val file = try {
        if (path.isNullOrEmpty()) null else File(path).canonicalFile
      } catch (e: Exception) {
        null // a path that cannot be resolved
      }
      when {
        file == null -> NO_PATH
        file.path == "/proc" || file.path.startsWith("/proc/") -> OWN_FILE
        privateDirs.any { inside(file, it) } -> OWN_FILE
        else -> null
      }
    }
    "content" -> {
      val raw = (uri.authority ?: "").substringAfterLast('@').substringBefore(':')
      val authority = raw.lowercase()
      val pkg = packageName.lowercase()
      if (authority == pkg || authority.startsWith("$pkg.") || ownAuthority(raw)) OWN_PROVIDER else null
    }
    else -> null
  }

  private fun inside(file: File, dir: File): Boolean {
    val root = try {
      dir.canonicalFile.path
    } catch (e: Exception) {
      return false
    }
    return file.path == root || file.path.startsWith(root + File.separator)
  }

  /** The app's private data folders: normal and device-protected storage, and the folders inside them. */
  private fun privateDirs(context: Context): List<File> {
    val app = context.applicationContext ?: context
    val dirs = listOf<() -> File?>(
      { app.dataDir },
      { app.filesDir },
      { app.cacheDir },
      { app.codeCacheDir },
      { app.noBackupFilesDir },
      { app.createDeviceProtectedStorageContext().dataDir },
    )
    // A folder that cannot be found (a test environment, storage not ready) is simply not in the list.
    return dirs.mapNotNull { runCatching(it).getOrNull() }
  }

  /** True when the provider with this authority is one of this app's (whatever its name). */
  @Suppress("DEPRECATION") // the flags overload is API 33+; 0 means no flags either way
  private fun isOwnProvider(context: Context, authority: String): Boolean = try {
    context.packageManager.resolveContentProvider(authority, 0)?.packageName == context.packageName
  } catch (e: Exception) {
    false
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

  /**
   * What JS gets: `text` (and `name` when the provider gives one), or `error`. Never throws. A URI into the
   * app's own storage is not opened (ownStorage): the user sees the same "Could not read that file.", and the
   * log says why without the path.
   */
  fun read(context: Context, uri: Uri, max: Int = MAX_BYTES): Map<String, String> {
    ownStorage(uri, context.packageName, privateDirs(context)) { isOwnProvider(context, it) }?.let { why ->
      Log.w(LOG_TAG, "open refused for ${cut(uri.toString())}: $why")
      return mapOf("error" to UNREADABLE)
    }
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
