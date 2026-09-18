import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Firebase (Analytics + Crashlytics + Cloud Messaging).
// google-services.json is developer-supplied and NOT committed — drop it into
// android/app/ (see docs/FIREBASE_SETUP.md). The plugins are applied only when
// the file exists so `flutter build` keeps working without Firebase configured;
// in that case the Dart side degrades to a no-op (see lib/core/firebase_bootstrap.dart).
val hasGoogleServices = file("google-services.json").exists()
if (hasGoogleServices) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
} else {
    logger.lifecycle(
        "google-services.json not found in android/app — building WITHOUT Firebase. " +
        "See docs/FIREBASE_SETUP.md to enable Analytics/Crashlytics/FCM."
    )
}

// Release signing: create android/key.properties from android/key.properties.example.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "cn.haohaoxuexi.chinese"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // flutter_local_notifications uses java.time — backport it via core
        // library desugaring for devices below API 26.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    buildFeatures { buildConfig = true }

    defaultConfig {
        // Play Store application id. Renamed from com.haohaoxuexi.app — a new
        // Firebase Android app and a new Play Console listing are required for
        // it (see docs/FIREBASE_SETUP.md and docs/RELEASE_CHECKLIST.md).
        applicationId = "cn.haohaoxuexi.chinese"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Falls back to debug signing when key.properties is absent so
            // `flutter build apk --release` still works locally.
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    // Java 8+ API backport required by flutter_local_notifications
    // (needs 2.1.4+, see the plugin's Android setup notes).
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}
