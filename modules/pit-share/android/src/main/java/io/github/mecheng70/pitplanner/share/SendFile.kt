package io.github.mecheng70.pitplanner.share

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import java.io.File
import java.net.URI

/**
 * "Send to developer" (T-065, SPEC section 6): the share sheet for ONE file the app itself wrote, with a
 * recipient and a subject offered to the email app the tester picks. Nothing is sent here: the tester picks
 * an app and taps send there.
 *
 * Only a file inside the app's own cache or files folder is ever shared (ownFile), and only that one file is
 * opened to the app the tester picks: a read grant for its content:// URI, nothing else.
 */
object SendFile {
  /**
   * expo-file-system's FileProvider, already in the app's manifest (not exported, grants per URI). It serves
   * the app's files and cache folders only, which are the folders ownFile allows. No provider of our own.
   */
  const val PROVIDER_SUFFIX = ".FileSystemFileProvider"

  const val MAX_SUBJECT = 200
  private const val ANY_TYPE = "*/*"
  private val MIME = Regex("^[A-Za-z0-9][A-Za-z0-9.+_-]*/[A-Za-z0-9][A-Za-z0-9.+_-]*$")
  private val ADDRESS = Regex("^[^@\\s,;<>\"]+@[^@\\s,;<>\"]+$")

  fun authority(packageName: String): String = packageName + PROVIDER_SUFFIX

  /**
   * The file a `file://` URL names, only when it is a plain file that really sits inside one of `roots`
   * (the app's cache and files folders). Null for anything else: another scheme, a path outside the roots,
   * `..` or a symlink that leads out of them, a folder, a file that does not exist.
   */
  fun ownFile(url: String?, roots: List<File>): File? {
    if (url == null) return null
    return try {
      val uri = URI(url)
      if (!"file".equals(uri.scheme, ignoreCase = true)) return null
      if (!uri.host.isNullOrEmpty() || uri.rawQuery != null || uri.rawFragment != null) return null
      val path = uri.path
      if (path.isNullOrEmpty()) return null
      val file = File(path).canonicalFile
      if (!file.isFile) return null
      val inside = roots.any { root ->
        file.path.startsWith(root.canonicalFile.path + File.separator)
      }
      if (inside) file else null
    } catch (e: Exception) {
      null // not a URL, or a path that cannot be resolved
    }
  }

  /** One address, or null: no spaces, no list of addresses, nothing an email app would read as a header. */
  fun recipient(raw: String?): String? {
    val address = raw?.trim() ?: return null
    return if (ADDRESS.matches(address)) address else null
  }

  /** One line, at most MAX_SUBJECT characters. */
  fun subject(raw: String?): String =
    (raw ?: "").replace(Regex("[\\r\\n\\t]+"), " ").trim().take(MAX_SUBJECT)

  /** `type/subtype`, or any type when it is not one. */
  fun mimeType(raw: String?): String {
    val type = raw?.trim() ?: return ANY_TYPE
    return if (MIME.matches(type)) type else ANY_TYPE
  }

  /**
   * The SEND intent for one file: the stream, its type, the recipient and subject, and a read grant for that
   * one URI. A recipient that is not one address is left out (the sheet still opens; the tester types it).
   */
  fun intent(uri: Uri, mimeType: String?, recipient: String?, subject: String?): Intent {
    val intent = Intent(Intent.ACTION_SEND)
    intent.type = mimeType(mimeType)
    intent.putExtra(Intent.EXTRA_STREAM, uri)
    recipient(recipient)?.let { intent.putExtra(Intent.EXTRA_EMAIL, arrayOf(it)) }
    val line = subject(subject)
    if (line.isNotEmpty()) intent.putExtra(Intent.EXTRA_SUBJECT, line)
    // The grant travels with the URI in the clip data, to the one app the tester picks.
    intent.clipData = ClipData.newRawUri(null, uri)
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    return intent
  }

  /** The system share sheet around `intent`, carrying the same read grant. */
  fun chooser(intent: Intent, title: String?): Intent {
    val chooser = Intent.createChooser(intent, title?.trim()?.takeIf { it.isNotEmpty() })
    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    return chooser
  }
}
