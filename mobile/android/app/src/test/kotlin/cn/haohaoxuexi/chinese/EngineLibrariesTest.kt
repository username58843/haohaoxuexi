package cn.haohaoxuexi.chinese

import java.io.File
import java.nio.file.Files
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EngineLibrariesTest {
    private fun apk(vararg entries: String): File {
        val file = File.createTempFile("engine-test", ".apk").apply { deleteOnExit() }
        ZipOutputStream(file.outputStream()).use { zip ->
            entries.forEach {
                zip.putNextEntry(ZipEntry(it))
                zip.write(byteArrayOf(1))
                zip.closeEntry()
            }
        }
        return file
    }

    @Test fun rejectsBaseWithoutNativeSplit() {
        assertFalse(EngineLibraries.available(null, listOf(apk("AndroidManifest.xml").path), listOf("arm64-v8a")))
    }

    @Test fun acceptsCompleteInstalledSplits() {
        val base = apk("AndroidManifest.xml")
        val split = apk("lib/arm64-v8a/libflutter.so", "lib/arm64-v8a/libapp.so")
        assertTrue(EngineLibraries.available(null, listOf(base.path, split.path), listOf("arm64-v8a")))
    }

    @Test fun rejectsWrongAbiAndMissingAot() {
        val wrong = apk("lib/armeabi-v7a/libflutter.so", "lib/armeabi-v7a/libapp.so")
        assertFalse(EngineLibraries.available(null, listOf(wrong.path), listOf("arm64-v8a")))
        val engineOnly = apk("lib/arm64-v8a/libflutter.so")
        assertFalse(EngineLibraries.available(null, listOf(engineOnly.path), listOf("arm64-v8a")))
        assertTrue(EngineLibraries.available(null, listOf(engineOnly.path), listOf("arm64-v8a"), false))
    }

    @Test fun acceptsExtractedLibrariesButNotEmptyFiles() {
        val dir = Files.createTempDirectory("engine-native").toFile()
        try {
            File(dir, "libflutter.so").writeBytes(byteArrayOf(1))
            File(dir, "libapp.so").writeBytes(byteArrayOf())
            assertFalse(EngineLibraries.available(dir.path, emptyList(), listOf("arm64-v8a")))
            File(dir, "libapp.so").writeBytes(byteArrayOf(1))
            assertTrue(EngineLibraries.available(dir.path, emptyList(), listOf("arm64-v8a")))
        } finally { dir.deleteRecursively() }
    }

    @Test fun corruptArchiveDoesNotCrashRecovery() {
        val broken = File.createTempFile("engine-broken", ".apk").apply { deleteOnExit(); writeText("broken") }
        assertFalse(EngineLibraries.available(null, listOf(broken.path), listOf("arm64-v8a")))
    }
}
