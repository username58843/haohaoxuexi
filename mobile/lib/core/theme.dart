import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Design tokens — Flutter port of docs/DESIGN.md ("Ink & Cinnabar").

/// The 8 runtime-switchable accent colors. Default: jade.
const Map<String, Color> accentColors = {
  'cinnabar': Color(0xFFE0533D),
  'orange': Color(0xFFFF9500),
  'gold': Color(0xFFEAB308),
  'jade': Color(0xFF34C759),
  'blue': Color(0xFF0A84FF),
  'violet': Color(0xFFAF52DE),
  'pink': Color(0xFFFF2D55),
  'cyan': Color(0xFF5AC8FA),
};

const String defaultAccentKey = 'jade';

// Canvas
const Color inkCanvas = Color(0xFF0E1113); // dark "ink" background
const Color paperCanvas = Color(0xFFF7F5F0); // light "rice paper" background

// Semantic
const Color okColor = Color(0xFF4ADE80);
const Color warnColor = Color(0xFFFBBF24);
const Color dangerColor = Color(0xFFF87171);

// Dark text scale
const Color _darkText = Color(0xFFECEFF1);
const Color _darkText2 = Color(0xFF9AA3A9);
const Color _darkText3 = Color(0xFF5F676D);

// Light text scale
const Color _lightText = Color(0xFF1C1917);
const Color _lightText2 = Color(0xFF57534E);
const Color _lightText3 = Color(0xFFA8A29E);

bool _isDark(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark;

/// Card surface (`--surface`).
Color surfaceOf(BuildContext context) => _isDark(context)
    ? Colors.white.withValues(alpha: 0.045)
    : const Color(0x9CFFFFFF);

/// Elevated / hover surface (`--surface-2`).
Color surface2Of(BuildContext context) =>
    _isDark(context) ? Colors.white.withValues(alpha: 0.08) : Colors.white;

/// Pressed / active surface (`--surface-3`).
Color surface3Of(BuildContext context) => _isDark(context)
    ? Colors.white.withValues(alpha: 0.12)
    : const Color(0xFFEDE9DF);

/// Hairline border (`--hairline`).
Color hairlineOf(BuildContext context) => _isDark(context)
    ? Colors.white.withValues(alpha: 0.09)
    : const Color(0xFF1C1914).withValues(alpha: 0.10);

/// Stronger hairline (`--hairline-2`).
Color hairline2Of(BuildContext context) => _isDark(context)
    ? Colors.white.withValues(alpha: 0.16)
    : const Color(0xFF1C1914).withValues(alpha: 0.18);

/// Secondary text (`--text-2`).
Color text2Of(BuildContext context) => _isDark(context) ? _darkText2 : _lightText2;

/// Muted text (`--text-3`).
Color text3Of(BuildContext context) => _isDark(context) ? _darkText3 : _lightText3;

/// Current accent color from the active theme.
Color accentOf(BuildContext context) => Theme.of(context).colorScheme.primary;

/// Accent wash (`--accent-soft`).
Color accentSoftOf(BuildContext context) =>
    accentOf(context).withValues(alpha: 0.14);

/// Contrast-aware "on accent" color (mirrors the web luminance logic).
Color onAccent(Color accent) =>
    accent.computeLuminance() > 0.55 ? _lightText : Colors.white;

/// Serif style for hanzi — Noto Serif SC (`--font-hanzi`).
/// Every Chinese string in the UI should use this (or [GoogleFonts.notoSerifSc]).
///
/// NOTE: fonts are bundled as assets and runtime fetching is disabled
/// (fonts.gstatic.com is unreachable in China). NotoSerifSC ships **only in
/// its SemiBold (w600) cut** to keep the APK small — do not pass other
/// [weight] values here without adding the matching file to `google_fonts/`
/// (see `tool/fetch_fonts.py`), otherwise the text silently falls back to
/// the system font. Manrope ships in w400–w800, JetBrainsMono in w600/w700.
TextStyle hanziStyle(
  BuildContext context, {
  double size = 24,
  FontWeight? weight,
  Color? color,
  double? height,
}) {
  return GoogleFonts.notoSerifSc(
    fontSize: size,
    fontWeight: weight ?? FontWeight.w600,
    color: color ?? Theme.of(context).colorScheme.onSurface,
    height: height ?? 1.25,
  );
}

/// Mono style for eyebrows / numbers (`--font-mono`).
TextStyle monoStyle(
  BuildContext context, {
  double size = 11,
  FontWeight? weight,
  Color? color,
  double letterSpacing = 1.6,
}) {
  return GoogleFonts.jetBrainsMono(
    fontSize: size,
    fontWeight: weight ?? FontWeight.w600,
    letterSpacing: letterSpacing,
    color: color ?? text2Of(context),
  );
}

/// Builds the Material 3 theme for the given brightness + accent.
ThemeData buildTheme(Brightness brightness, Color accent) {
  final isDark = brightness == Brightness.dark;
  final bg = isDark ? inkCanvas : paperCanvas;
  final text = isDark ? _darkText : _lightText;
  final text2 = isDark ? _darkText2 : _lightText2;
  final text3 = isDark ? _darkText3 : _lightText3;
  final hairline = isDark
      ? Colors.white.withValues(alpha: 0.09)
      : const Color(0xFF1C1914).withValues(alpha: 0.10);
  final surface = isDark
      ? Colors.white.withValues(alpha: 0.045)
      : const Color(0x9CFFFFFF);
  final surface2 = isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white;
  final onAccentColor = onAccent(accent);

  final scheme = ColorScheme.fromSeed(seedColor: accent, brightness: brightness)
      .copyWith(
    primary: accent,
    onPrimary: onAccentColor,
    secondary: accent,
    onSecondary: onAccentColor,
    surface: bg,
    onSurface: text,
    onSurfaceVariant: text2,
    outline: hairline,
    outlineVariant: hairline,
    error: dangerColor,
    surfaceTint: Colors.transparent,
  );

  final baseTextTheme = ThemeData(brightness: brightness).textTheme;
  final textTheme = GoogleFonts.manropeTextTheme(baseTextTheme)
      .apply(bodyColor: text, displayColor: text);

  // Opaque blend of the card surface over the canvas (for bars/sheets).
  final solidSurface = Color.alphaBlend(surface2, bg);

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    canvasColor: bg,
    textTheme: textTheme,
    splashFactory: InkRipple.splashFactory,
    dividerTheme: DividerThemeData(color: hairline, thickness: 1, space: 1),
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      surfaceTintColor: Colors.transparent,
      foregroundColor: text,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.manrope(
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: text,
      ),
    ),
    cardTheme: CardThemeData(
      color: surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: hairline),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: isDark
          ? Color.alphaBlend(Colors.white.withValues(alpha: 0.05), bg)
          : Colors.white,
      surfaceTintColor: Colors.transparent,
      indicatorColor: accent.withValues(alpha: 0.14),
      height: 68,
      elevation: 0,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 24,
          color: states.contains(WidgetState.selected) ? accent : text2,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => GoogleFonts.manrope(
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? text : text2,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationThemeData(
      filled: true,
      fillColor: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.white,
      hintStyle: TextStyle(color: text3),
      labelStyle: TextStyle(color: text2),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: hairline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: hairline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: accent, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: dangerColor),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: dangerColor, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: accent,
        foregroundColor: onAccentColor,
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        textStyle: GoogleFonts.manrope(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: accent,
        shape: const StadiumBorder(),
        textStyle: GoogleFonts.manrope(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: text,
        side: BorderSide(color: isDark
            ? Colors.white.withValues(alpha: 0.16)
            : const Color(0xFF1C1914).withValues(alpha: 0.18)),
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
        textStyle: GoogleFonts.manrope(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: accent,
      linearTrackColor: isDark
          ? Colors.white.withValues(alpha: 0.08)
          : const Color(0xFFEDE9DF),
      circularTrackColor: isDark
          ? Colors.white.withValues(alpha: 0.08)
          : const Color(0xFFEDE9DF),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: isDark ? const Color(0xFF23282C) : _lightText,
      contentTextStyle: GoogleFonts.manrope(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: isDark ? _darkText : paperCanvas,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: isDark ? Color.alphaBlend(surface, bg) : paperCanvas,
      modalBackgroundColor:
          isDark ? Color.alphaBlend(surface, bg) : paperCanvas,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: isDark
          ? Colors.white.withValues(alpha: 0.16)
          : const Color(0xFF1C1914).withValues(alpha: 0.18),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: solidSurface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      titleTextStyle: GoogleFonts.manrope(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: text,
      ),
      contentTextStyle: GoogleFonts.manrope(fontSize: 14.5, color: text2),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: text2,
      textColor: text,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: surface,
      selectedColor: accent.withValues(alpha: 0.14),
      side: BorderSide(color: hairline),
      labelStyle: GoogleFonts.manrope(
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
        color: text,
      ),
      shape: const StadiumBorder(),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? onAccentColor
            : text3,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) =>
            states.contains(WidgetState.selected) ? accent : surface2,
      ),
      trackOutlineColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? Colors.transparent
            : hairline,
      ),
    ),
  );
}
