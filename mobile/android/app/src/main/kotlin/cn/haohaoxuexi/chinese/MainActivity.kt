package cn.haohaoxuexi.chinese

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Process
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val info = applicationInfo
        val apks = listOf(info.sourceDir) + (info.splitSourceDirs?.toList() ?: emptyList())
        val abis = if (Process.is64Bit()) Build.SUPPORTED_64_BIT_ABIS else Build.SUPPORTED_32_BIT_ABIS
        if (EngineLibraries.available(info.nativeLibraryDir, apks, abis.toList(), !BuildConfig.DEBUG)) {
            startActivity(Intent(this, FlutterHostActivity::class.java).apply {
                intent.extras?.let { putExtras(it) }
                data = intent.data
                action = intent.action
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            })
            finish()
            return
        }
        // Flutter cannot render recovery UI when its engine is absent.
        val padding = (24 * resources.displayMetrics.density).toInt()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(padding, padding, padding, padding)
            addView(TextView(context).apply {
                setText(R.string.incomplete_install_title)
                textSize = 24f
            })
            addView(TextView(context).apply {
                setText(R.string.incomplete_install_message)
                textSize = 18f
                setPadding(0, padding, 0, padding)
            })
            addView(Button(context).apply {
                setText(R.string.incomplete_install_store)
                setOnClickListener {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW,
                            Uri.parse("https://play.google.com/store/apps/details?id=$packageName")))
                    } catch (_: ActivityNotFoundException) {
                        // The recovery instructions remain visible without a browser.
                    }
                }
            })
        }
        setContentView(ScrollView(this).apply { isFillViewport = true; addView(content) })
    }
}
