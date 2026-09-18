import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/speech.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../decks/decks_screen.dart';
import 'stroke_order.dart';

/// Word detail bottom sheet: big hanzi, pinyin, traditional (when it differs),
/// HSK badge, listen (TTS) + stroke-order buttons, definitions, EN/RU
/// translation blocks and a caller-provided actions row.
Future<void> showWordSheet(
  BuildContext context,
  WidgetRef ref,
  Word word, {
  List<Widget> actions = const [],
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    // Open on the ROOT navigator: inside the HomeShell tabs the nearest
    // navigator lives in the Scaffold body (extendBody: true), so a sheet
    // opened there is painted BEHIND the floating dock and its bottom
    // actions ("Add to deck") end up hidden under the nav buttons.
    useRootNavigator: true,
    builder: (context) => _WordSheet(word: word, actions: actions),
  );
}

class _WordSheet extends StatefulWidget {
  const _WordSheet({required this.word, required this.actions});

  final Word word;
  final List<Widget> actions;

  @override
  State<_WordSheet> createState() => _WordSheetState();
}

class _WordSheetState extends State<_WordSheet> {
  static final RegExp _han = RegExp(r'\p{Script=Han}', unicode: true);

  bool _showStrokes = false;

  Word get word => widget.word;

  @override
  Widget build(BuildContext context) {
    final accent = accentOf(context);
    final differs =
        word.traditional.isNotEmpty && word.traditional != word.simplified;
    final showEn = word.en.isNotEmpty && !listEquals(word.en, word.definitions);
    final showRu = word.ru.isNotEmpty && !listEquals(word.ru, word.definitions);
    final showTk = word.tk.isNotEmpty && !listEquals(word.tk, word.definitions);
    // Same as the web sheet: stroke-order tiles for the Han characters only.
    final hanzi = [
      for (final ch in word.simplified.characters)
        if (_han.hasMatch(ch)) ch,
    ];

    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.85,
      ),
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24, 4, 24, 24 + MediaQuery.viewPaddingOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            HanziText(word.simplified, size: 52, textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(
              word.pinyin,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: accent,
              ),
            ),
            if (word.hsk != null || differs) ...[
              const SizedBox(height: 14),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (word.hsk != null)
                    _badge(
                      context,
                      accented: true,
                      child: Text(
                        'HSK ${word.hsk}',
                        style: monoStyle(context, size: 11, color: accent),
                      ),
                    ),
                  if (differs)
                    _badge(
                      context,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            tr(context, 'word.traditional', 'Traditional')
                                .toUpperCase(),
                            style: monoStyle(context,
                                size: 9.5, color: text3Of(context)),
                          ),
                          const SizedBox(width: 6),
                          HanziText(word.traditional, size: 15),
                        ],
                      ),
                    ),
                ],
              ),
            ],
            // Listen (TTS) + stroke-order toggle — same actions row as the
            // web word sheet (components/WordSheet.js).
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                PillButton(
                  label: tr(context, 'word.listen', 'Listen'),
                  icon: Icons.volume_up_rounded,
                  size: PillSize.sm,
                  variant: PillVariant.soft,
                  onPressed: () {
                    Speech.speakChinese(word.simplified);
                  },
                ),
                if (hanzi.isNotEmpty)
                  PillButton(
                    label: tr(context, 'word.strokes', 'Stroke order'),
                    icon: Icons.gesture,
                    size: PillSize.sm,
                    variant:
                        _showStrokes ? PillVariant.primary : PillVariant.soft,
                    onPressed: () =>
                        setState(() => _showStrokes = !_showStrokes),
                  ),
              ],
            ),
            if (_showStrokes && hanzi.isNotEmpty) ...[
              const SizedBox(height: 14),
              StrokeOrderPanel(characters: hanzi),
            ],
            if (word.example != null) ...[
              const SizedBox(height: 20),
              SectionLabel(tr(context, 'word.example', 'Example')),
              const SizedBox(height: 8),
              ExampleSentenceCard(example: word.example!),
            ],
            if (word.definitions.isNotEmpty)
              ..._block(context, tr(context, 'word.definitions', 'Definitions'),
                  word.definitions),
            if (showTk)
              ..._block(
                  context, tr(context, 'word.turkmen', 'Turkmen'), word.tk),
            if (showEn)
              ..._block(
                  context, tr(context, 'word.english', 'English'), word.en),
            if (showRu)
              ..._block(
                  context, tr(context, 'word.russian', 'Russian'), word.ru),
            if (widget.actions.isNotEmpty) ...[
              const SizedBox(height: 22),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 10,
                runSpacing: 10,
                children: widget.actions,
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _block(BuildContext context, String label, List<String> lines) {
    return [
      const SizedBox(height: 20),
      SectionLabel(label),
      const SizedBox(height: 8),
      for (final line in lines)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 7),
                child: Container(
                  width: 5,
                  height: 5,
                  decoration: BoxDecoration(
                    color: text3Of(context),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  line,
                  style: TextStyle(
                    fontSize: 14.5,
                    height: 1.4,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
              ),
            ],
          ),
        ),
    ];
  }

  Widget _badge(BuildContext context,
      {required Widget child, bool accented = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: accented ? accentSoftOf(context) : surfaceOf(context),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: accented ? Colors.transparent : hairlineOf(context),
        ),
      ),
      child: child,
    );
  }
}

/// Shared word list row: hanzi (serif 22) + pinyin (accent) + first
/// definition + HSK badge. Used by the HSK browser and deck screens.
class WordRow extends StatelessWidget {
  const WordRow({super.key, required this.word, this.onTap, this.trailing});

  final Word word;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final firstDef = word.definitions.isNotEmpty
        ? word.definitions.first
        : (word.en.isNotEmpty ? word.en.first : '');
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Flexible(
                        child: HanziText(
                          word.simplified,
                          size: 22,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Flexible(
                        child: Text(
                          word.pinyin,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: accentOf(context),
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (firstDef.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      firstDef,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        color: text2Of(context),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (word.hsk != null)
              Padding(
                padding: const EdgeInsets.only(left: 10),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: hairlineOf(context)),
                  ),
                  child: Text(
                    'HSK ${word.hsk}',
                    style: monoStyle(context,
                        size: 10, color: text2Of(context), letterSpacing: 0.8),
                  ),
                ),
              ),
            if (trailing != null)
              Padding(
                padding: const EdgeInsets.only(left: 6),
                child: trailing!,
              ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet that lists the user's decks (`GET /decks`) and appends the
/// word to the chosen one (wordId dedupe), or creates a new deck inline with
/// the word already inside.
Future<void> showAddToDeckSheet(
  BuildContext context,
  WidgetRef ref,
  Word word,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    // Root navigator, like showWordSheet: keeps the sheet above the
    // floating dock inside the HomeShell tabs.
    useRootNavigator: true,
    builder: (context) => _AddToDeckSheet(word: word),
  );
}

class _AddToDeckSheet extends ConsumerStatefulWidget {
  const _AddToDeckSheet({required this.word});

  final Word word;

  @override
  ConsumerState<_AddToDeckSheet> createState() => _AddToDeckSheetState();
}

class _AddToDeckSheetState extends ConsumerState<_AddToDeckSheet> {
  final TextEditingController _nameController = TextEditingController();
  bool _creating = false;
  bool _busy = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _snack(ScaffoldMessengerState messenger, String message) {
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _addTo(Deck deck) async {
    if (_busy) return;
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    final addedMsg =
        '${tr(context, 'deck.snack.added', 'Added to')} “${deck.name}”';
    final existsMsg =
        '${tr(context, 'deck.snack.exists', 'Already in')} “${deck.name}”';
    try {
      final added = await ref
          .read(decksProvider.notifier)
          .addWordToDeck(deck.id, widget.word);
      if (!mounted) return;
      Navigator.of(context).pop();
      _snack(messenger, added ? addedMsg : existsMsg);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _snack(messenger, apiErrorText(context, e));
    }
  }

  Future<void> _createAndAdd() async {
    final name = _nameController.text.trim();
    if (name.isEmpty || _busy) return;
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    final addedMsg = '${tr(context, 'deck.snack.added', 'Added to')} “$name”';
    try {
      await ref
          .read(decksProvider.notifier)
          .createDeck(name, words: [widget.word]);
      if (!mounted) return;
      Navigator.of(context).pop();
      _snack(messenger, addedMsg);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _snack(messenger, apiErrorText(context, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final decksAsync = ref.watch(decksProvider);
    final insets = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: insets),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.7,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
              child: Row(
                children: [
                  SectionLabel(tr(context, 'word.addToDeck', 'Add to deck')),
                  const Spacer(),
                  HanziText(
                    widget.word.simplified,
                    size: 16,
                    color: text2Of(context),
                  ),
                ],
              ),
            ),
            Flexible(
              child: decksAsync.when(
                loading: () =>
                    const SizedBox(height: 120, child: LoadingView()),
                error: (error, _) => Padding(
                  padding: const EdgeInsets.all(8),
                  child: ErrorView(
                    message: apiErrorText(context, error),
                    onRetry: () => ref.invalidate(decksProvider),
                  ),
                ),
                data: (decks) => decks.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                        child: Text(
                          tr(context, 'decks.none',
                              'No decks yet — create one below.'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            color: text2Of(context),
                          ),
                        ),
                      )
                    : ListView.builder(
                        shrinkWrap: true,
                        itemCount: decks.length,
                        itemBuilder: (context, i) {
                          final deck = decks[i];
                          final contains =
                              deck.words.any((w) => w.id == widget.word.id);
                          return ListTile(
                            enabled: !_busy,
                            leading: Icon(Icons.style_outlined,
                                color: text2Of(context)),
                            title: Text(
                              deck.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600),
                            ),
                            trailing: contains
                                ? const Icon(Icons.check_circle,
                                    size: 20, color: okColor)
                                : Text(
                                    '${deck.count}',
                                    style: monoStyle(context,
                                        size: 11, color: text3Of(context)),
                                  ),
                            onTap: () => _addTo(deck),
                          );
                        },
                      ),
              ),
            ),
            const Divider(),
            Padding(
              padding: EdgeInsets.fromLTRB(
                  16, 8, 16, 12 + MediaQuery.viewPaddingOf(context).bottom),
              child: _creating
                  ? Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _nameController,
                            autofocus: true,
                            maxLength: 80,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => _createAndAdd(),
                            decoration: InputDecoration(
                              hintText:
                                  tr(context, 'decks.name', 'Deck name'),
                              counterText: '',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        PillButton(
                          label: tr(context, 'common.create', 'Create'),
                          size: PillSize.sm,
                          loading: _busy,
                          onPressed: _createAndAdd,
                        ),
                      ],
                    )
                  : ListTile(
                      leading: Icon(Icons.add, color: accentOf(context)),
                      title: Text(
                        tr(context, 'decks.new', 'New deck'),
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: accentOf(context),
                        ),
                      ),
                      onTap: () => setState(() => _creating = true),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
