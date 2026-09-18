package cn.haohaoxuexi.chinese

import java.io.File
import java.util.zip.ZipFile

internal object EngineLibraries {
    fun available(
        nativeDirectory: String?, apkPaths: List<String>, abis: List<String>, requireAot: Boolean = true
    ): Boolean {
        val libraries = if (requireAot) listOf("libflutter.so", "libapp.so") else listOf("libflutter.so")
        val extracted = libraries.filter { name ->
            nativeDirectory != null && File(nativeDirectory, name).let { it.isFile && it.length() > 0 }
        }.toSet()
        if (extracted.size == libraries.size) return true
        val packaged = mutableSetOf<String>()
        apkPaths.forEach { path ->
            try {
                ZipFile(path).use { apk ->
                    abis.forEach { abi ->
                        libraries.forEach { name ->
                            val entry = apk.getEntry("lib/$abi/$name")
                            if (entry != null && entry.size > 0) packaged.add("$abi/$name")
                        }
                    }
                }
            } catch (_: java.io.IOException) {
                // A broken split must not prevent checking other installed splits.
            }
        }
        return abis.any { abi -> libraries.all { it in extracted || "$abi/$it" in packaged } }
    }
}
