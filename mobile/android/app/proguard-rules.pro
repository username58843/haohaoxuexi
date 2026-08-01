# Flutter's default rules are injected by the Flutter Gradle plugin.
# flutter_secure_storage / AndroidX Security
-keep class androidx.security.crypto.** { *; }

# flutter_local_notifications: scheduled notifications are serialized with
# Gson (reflection) — keep generic signatures and TypeToken subtypes so the
# minified release build can restore them (plugin README, ProGuard section).
-keepattributes Signature
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keep public class * implements java.lang.reflect.Type
-keep class com.dexterous.flutterlocalnotifications.** { *; }
