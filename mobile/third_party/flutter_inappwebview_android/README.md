# flutter_inappwebview_android — vendored patched copy

This is `flutter_inappwebview_android` **1.1.2** from pub.dev, vendored into the
repo and wired up via `dependency_overrides` in `mobile/pubspec.yaml`.

## Why

Production crash on some OEM ROMs (Huawei/Honor and others, mostly Android
10–12):

```
PlatformException(error, android.webkit.WebSettingsWrapper cannot be cast to
com.android.webview.chromium.ContentSettingsAdapter, null,
java.lang.ClassCastException ...)
  at InAppWebView.prepare(...)
  at FlutterWebView.<init>(...)
```

Those ROMs wrap `android.webkit.WebSettings` in a system class
(`WebSettingsWrapper`) that the androidx.webkit boundary-interface glue cannot
cast, so **any** `WebSettingsCompat.*` call that goes through the glue throws a
`ClassCastException`. The stock plugin performs several such calls
unconditionally while creating a WebView (`setAlgorithmicDarkeningAllowed`,
`setEnterpriseAuthenticationAppLinkPolicyEnabled`, …), so WebView creation —
and with it the whole screen — crashed. Upstream tracks this as
[issue #2397](https://github.com/pichillilorenzo/flutter_inappwebview/issues/2397),
but as of 1.2.0-beta.3 only `setForceDarkStrategy` is guarded, which does not
cover the call our crash reports point at.

## The patch

All changes are marked with `HAOHAO PATCH` comments. Two files are touched:

- `.../webview/in_app_webview/InAppWebView.java` — every `WebSettingsCompat.*`
  setter in `prepare()` and `setSettings()` is wrapped in `try/catch`
  (log + skip; where a framework API exists it is used as a fallback).
- `.../webview/in_app_webview/InAppWebViewSettings.java` — same treatment for
  the `WebSettingsCompat.*` getters in `getRealSettings()`.

No behavior changes on healthy devices: the try blocks execute exactly the same
calls as before. On broken ROMs an optional setting is skipped instead of
crashing the app.

## Updating

When upstream ships a release whose `InAppWebView.prepare()` /
`setSettings()` guard **all** boundary-interface `WebSettingsCompat` calls,
delete this directory and the `dependency_overrides` entry in
`mobile/pubspec.yaml`, then run `flutter pub get`.

Everything else in this directory is the unmodified pub.dev package
(Apache License 2.0, see `LICENSE`).
