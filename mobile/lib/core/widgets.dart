import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'i18n.dart';
import 'models.dart' show WordExample;
import 'speech.dart';
import 'theme.dart';

/// Shared design-system widgets (docs/DESIGN.md §2), Flutter edition.

/// Surface card: translucent surface tint + hairline border + 18px radius.
class InkCard extends StatelessWidget {
  const InkCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin,
    this.onTap,
    this.onLongPress,
    this.color,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(color: borderColor ?? hairlineOf(context)),
    );
    Widget card = Material(
      color: color ?? surfaceOf(context),
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: onTap != null || onLongPress != null
          ? InkWell(
              onTap: onTap,
              onLongPress: onLongPress,
              child: Padding(padding: padding, child: child),
            )
          : Padding(padding: padding, child: child),
    );
    if (margin != null) card = Padding(padding: margin!, child: card);
    return card;
  }
}

enum PillVariant { primary, soft, danger }

/// Pill-shaped button. `primary` = filled accent with glow shadow,
/// `soft` = accent wash, `danger` = red wash.
class PillButton extends StatelessWidget {
  const PillButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = PillVariant.primary,
    this.icon,
    this.loading = false,
    this.expanded = false,
    this.size = PillSize.md,
  });

  final String label;
  final VoidCallback? onPressed;
  final PillVariant variant;
  final IconData? icon;
  final bool loading;

  /// Stretch to the available width.
  final bool expanded;
  final PillSize size;

  @override
  Widget build(BuildContext context) {
    final accent = accentOf(context);
    final enabled = onPressed != null && !loading;

    final Color background;
    final Color foreground;
    List<BoxShadow>? shadow;
    switch (variant) {
      case PillVariant.primary:
        background = accent;
        foreground = onAccent(accent);
        if (enabled) {
          shadow = [
            BoxShadow(
              color: accent.withValues(alpha: 0.45),
              offset: const Offset(0, 8),
              blurRadius: 30,
              spreadRadius: -6,
            ),
          ];
        }
      case PillVariant.soft:
        background = accent.withValues(alpha: 0.14);
        foreground = accent;
      case PillVariant.danger:
        background = dangerColor.withValues(alpha: 0.14);
        foreground = dangerColor;
    }

    final (double hPad, double vPad, double fontSize) = switch (size) {
      PillSize.sm => (16, 9, 13.5),
      PillSize.md => (22, 13, 15),
      PillSize.lg => (28, 16, 16),
    };

    final content = Row(
      mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          SizedBox(
            width: fontSize + 2,
            height: fontSize + 2,
            child: CircularProgressIndicator(strokeWidth: 2.4, color: foreground),
          )
        else if (icon != null)
          Icon(icon, size: fontSize + 4, color: foreground),
        if (loading || icon != null) const SizedBox(width: 8),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: foreground,
            ),
          ),
        ),
      ],
    );

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 150),
      opacity: enabled || loading ? 1 : 0.45,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          boxShadow: shadow,
        ),
        child: Material(
          color: background,
          shape: const StadiumBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: enabled ? onPressed : null,
            customBorder: const StadiumBorder(),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}

enum PillSize { sm, md, lg }

/// Mono uppercase eyebrow label ("SECTION").
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.padding});

  final String text;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final label = Text(
      text.toUpperCase(),
      style: monoStyle(context),
    );
    if (padding != null) return Padding(padding: padding!, child: label);
    return label;
  }
}

/// Labelled on/off row: title, optional hint line, trailing [Switch] — the
/// settings-screen preference row, shared so a preference can also be offered
/// in context (e.g. the quiz audio option on the Learn tab).
class SwitchRow extends StatelessWidget {
  const SwitchRow({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.hint,
  });

  final String label;
  final String? hint;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              if (hint != null) ...[
                const SizedBox(height: 2),
                Text(
                  hint!,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.35,
                    color: text2Of(context),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 12),
        Switch(value: value, onChanged: onChanged),
      ],
    );
  }
}

/// Chinese text rendered in Noto Serif SC.
class HanziText extends StatelessWidget {
  const HanziText(
    this.text, {
    super.key,
    this.size = 24,
    this.color,
    this.weight,
    this.textAlign,
    this.maxLines,
    this.overflow,
  });

  final String text;
  final double size;
  final Color? color;
  final FontWeight? weight;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow? overflow;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: textAlign,
      maxLines: maxLines,
      overflow: overflow,
      locale: const Locale('zh'),
      style: hanziStyle(context, size: size, color: color, weight: weight),
    );
  }
}

/// Empty state: big hanzi glyph + title + text + optional action.
class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.glyph,
    required this.title,
    required this.text,
    this.action,
  });

  final String glyph;
  final String title;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HanziText(glyph, size: 56, color: text3Of(context)),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.45,
                color: text2Of(context),
              ),
            ),
            if (action != null) ...[
              const SizedBox(height: 20),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Error state with optional retry.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HanziText('哎', size: 48, color: text3Of(context)),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14.5,
                height: 1.45,
                color: text2Of(context),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 20),
              PillButton(
                label: tr(context, 'common.retry', 'Retry'),
                variant: PillVariant.soft,
                icon: Icons.refresh,
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Centered accent spinner for full-area loading states.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: SizedBox(
        width: 32,
        height: 32,
        child: CircularProgressIndicator(strokeWidth: 3),
      ),
    );
  }
}


/// One simple example sentence for a word: hanzi line with a speaker button
/// (platform TTS), pinyin underneath, then the translation matching the UI
/// language (tk → ru → en fallback, mirroring the web ExampleSentence).
class ExampleSentenceCard extends ConsumerWidget {
  const ExampleSentenceCard({super.key, required this.example});

  final WordExample example;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    final translation = example.translationFor(lang);
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: surface2Of(context),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: hairlineOf(context)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HanziText(example.zh, size: 17),
                if (example.py.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    example.py,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: text2Of(context),
                    ),
                  ),
                ],
                if (translation.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    translation,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: text2Of(context),
                    ),
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            onPressed: () {
              Speech.speakChinese(example.zh);
            },
            icon: Icon(Icons.volume_up_rounded, color: accentOf(context)),
            iconSize: 20,
            tooltip: tr(context, 'word.exampleListen', 'Listen to the example'),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}
