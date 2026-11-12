package io.github.mecheng70.pitplanner.share

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.lang.ref.WeakReference

/**
 * Opened .pitplan files (SPEC section 3, Share). MainActivity hands over VIEW / SEND intents; the JS side
 * (src/platform/sharedPlan.ts) takes the file text once, on start and on the "sharedPlan" event.
 * Reads at most MAX_BYTES; the JS side validates the content.
 */
@CapacitorPlugin(name = "PitSharedPlan")
class SharedPlanPlugin : Plugin() {

    override fun load() {
        instance = WeakReference(this)
    }

    @PluginMethod
    fun take(call: PluginCall) {
        val uri = pending
        pending = null
        val out = JSObject()
        if (uri == null) { call.resolve(out); return }
        try {
            val bytes = context.contentResolver.openInputStream(uri)?.use { s ->
                val buf = s.readNBytesCompat(MAX_BYTES + 1)
                if (buf.size > MAX_BYTES) null else buf
            }
            if (bytes == null) { out.put("error", "too big"); call.resolve(out); return }
            out.put("text", String(bytes, Charsets.UTF_8))
            displayName(uri)?.let { out.put("name", it) }
            call.resolve(out)
        } catch (e: Exception) {
            out.put("error", "unreadable")
            call.resolve(out)
        }
    }

    private fun displayName(uri: Uri): String? = try {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    } catch (e: Exception) { null }

    companion object {
        private const val MAX_BYTES = 256 * 1024
        @Volatile private var pending: Uri? = null
        private var instance: WeakReference<SharedPlanPlugin>? = null

        /** Called by MainActivity for every launch and new intent. Ignores anything that is not a file hand-off. */
        @JvmStatic
        fun offer(intent: Intent?) {
            if (intent == null) return
            val uri = when (intent.action) {
                Intent.ACTION_VIEW -> intent.data
                Intent.ACTION_SEND -> if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                    else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM)
                else -> null
            } ?: return
            if (uri.scheme != "content" && uri.scheme != "file") return
            pending = uri
            // Handled once: a recreated activity must not open the same file again.
            intent.action = Intent.ACTION_MAIN
            instance?.get()?.notifyListeners("sharedPlan", JSObject())
        }

        private fun java.io.InputStream.readNBytesCompat(n: Int): ByteArray {
            val out = java.io.ByteArrayOutputStream()
            val buf = ByteArray(8192)
            var total = 0
            while (total < n) {
                val r = read(buf, 0, minOf(buf.size, n - total))
                if (r < 0) break
                out.write(buf, 0, r); total += r
            }
            return out.toByteArray()
        }
    }
}
