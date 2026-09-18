import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/i18n.dart';
import '../../core/providers.dart';
import '../../core/speech.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../browse/word_sheet.dart';
import 'reading_document.dart';

class MemorizeScreen extends ConsumerStatefulWidget {
  const MemorizeScreen({super.key});
  @override
  ConsumerState<MemorizeScreen> createState() => _MemorizeScreenState();
}

class _MemorizeScreenState extends ConsumerState<MemorizeScreen>
    with WidgetsBindingObserver {
  static const _preferencesKey = 'memorize.preferences.v1';
  static const _positionKey = 'memorize.position.v1:';
  late final SharedPreferences _storage;
  late ReadingPreferences _preferences;
  ReadingDocument? _document;
  int _page = 0;
  int _request = 0;
  bool _failed = false;
  bool _audioError = false;
  SpeechNarration? _narration;
  final _scroll = ScrollController();
  final _articleKey = GlobalKey();

  Object? _read(String key) {
    try {
      return jsonDecode(_storage.getString(key) ?? 'null');
    } catch (_) {
      return null;
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _storage = ref.read(sharedPreferencesProvider);
    _preferences = ReadingPreferences.fromJson(_read(_preferencesKey));
    unawaited(_load());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _narration?.stop();
    _scroll.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _stop();
    }
  }

  Future<void> _load() async {
    final request = ++_request;
    final range = _preferences.range;
    try {
      final raw = await rootBundle.loadString('assets/learning/$range.json');
      final document = await compute(decodeReadingDocument, raw);
      if (!mounted || request != _request) return;
      if (document.id != range) {
        throw const FormatException('Wrong reading range');
      }
      setState(() {
        _document = document;
        _page = document.pageFrom(_read(_positionKey + range));
        _failed = false;
      });
    } catch (_) {
      if (mounted && request == _request) setState(() => _failed = true);
    }
  }

  void _update(ReadingPreferences preferences) {
    final changed = preferences.range != _preferences.range;
    if (changed) _stop();
    setState(() {
      _preferences = preferences;
      if (changed) {
        _document = null;
        _failed = false;
        _audioError = false;
      }
    });
    unawaited(
      _storage.setString(_preferencesKey, jsonEncode(preferences.toJson())),
    );
    if (changed) unawaited(_load());
  }

  void _stop() {
    final narration = _narration;
    if (narration == null) return;
    _narration = null;
    narration.stop();
    if (mounted) setState(() {});
  }

  Future<void> _listen() async {
    if (_narration != null) {
      _stop();
      return;
    }
    final narration = Speech.narrate(_document!.spokenText);
    setState(() {
      _narration = narration;
      _audioError = false;
    });
    final success = await narration.done;
    if (mounted && identical(_narration, narration)) {
      setState(() {
        _narration = null;
        _audioError = !success;
      });
    }
  }

  void _go(int page) {
    final document = _document!;
    setState(() => _page = page.clamp(0, document.passages.length - 1));
    unawaited(
      _storage.setString(
        _positionKey + document.id,
        jsonEncode({'revision': document.revision, 'page': _page}),
      ),
    );
    final context = _articleKey.currentContext;
    if (context != null) {
      unawaited(
        Scrollable.ensureVisible(
          context,
          duration: const Duration(milliseconds: 200),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final language = ref.watch(
      settingsProvider.select((settings) => settings.language),
    );
    final translationLanguage = _preferences.language.isNotEmpty
        ? _preferences.language
        : readingLanguages.containsKey(language)
        ? language
        : 'en';
    final document = _document;
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'memorize.title', 'Memorize'))),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          controller: _scroll,
          padding: const EdgeInsets.all(16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 850),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionLabel('HSK 3.0 · 2026'),
                  const SizedBox(height: 12),
                  Text(
                    tr(
                      context,
                      'memorize.subtitle',
                      'One story, words in context',
                    ),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    tr(
                      context,
                      'memorize.method',
                      'Why read a connected story?',
                    ),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    tr(context, 'memorize.explanation', 'Read in context.'),
                    style: const TextStyle(height: 1.7),
                  ),
                  const SizedBox(height: 20),
                  InkCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        DropdownButtonFormField<String>(
                          key: ValueKey('range:${_preferences.range}'),
                          initialValue: _preferences.range,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: tr(
                              context,
                              'memorize.level',
                              'Vocabulary range',
                            ),
                          ),
                          items: [
                            for (final range in readingRanges)
                              DropdownMenuItem(
                                value: range,
                                child: Text(
                                  'HSK 3.0 · ${range == '1-7-9' ? '1–(7–9)' : range.replaceAll('-', '–')}',
                                ),
                              ),
                          ],
                          onChanged: (value) {
                            if (value != null) {
                              _update(_preferences.copyWith(range: value));
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String>(
                          key: ValueKey('translation:$translationLanguage'),
                          initialValue: translationLanguage,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: tr(
                              context,
                              'memorize.language',
                              'Translation language',
                            ),
                          ),
                          items: [
                            for (final entry in readingLanguages.entries)
                              DropdownMenuItem(
                                value: entry.key,
                                child: Text(entry.value),
                              ),
                          ],
                          onChanged: (value) {
                            if (value != null) {
                              _update(_preferences.copyWith(language: value));
                            }
                          },
                        ),
                        const SizedBox(height: 8),
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            tr(
                              context,
                              'memorize.pinyin',
                              'Pinyin above characters',
                            ),
                          ),
                          value: _preferences.pinyin,
                          onChanged: (value) =>
                              _update(_preferences.copyWith(pinyin: value)),
                        ),
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            tr(
                              context,
                              'memorize.translation',
                              'Show translation',
                            ),
                          ),
                          value: _preferences.translation,
                          onChanged: (value) => _update(
                            _preferences.copyWith(translation: value),
                          ),
                        ),
                        Text(
                          '${tr(context, 'memorize.size', 'Character size')} · ${_preferences.fontSize.round()}',
                        ),
                        Slider(
                          min: 18,
                          max: 42,
                          divisions: 24,
                          value: _preferences.fontSize,
                          label: '${_preferences.fontSize.round()}',
                          semanticFormatterCallback: (value) =>
                              '${tr(context, 'memorize.size', 'Character size')} ${value.round()}',
                          onChanged: (value) =>
                              _update(_preferences.copyWith(fontSize: value)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    tr(context, 'memorize.lookup', 'Tap a word to look it up.'),
                    style: TextStyle(color: text2Of(context), height: 1.6),
                  ),
                  const SizedBox(height: 20),
                  if (_failed) ...[
                    Text(
                      tr(
                        context,
                        'memorize.error',
                        'Could not load this text.',
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() => _failed = false);
                        unawaited(_load());
                      },
                      child: Text(tr(context, 'common.retry', 'Retry')),
                    ),
                  ] else if (document == null)
                    const Center(child: CircularProgressIndicator())
                  else ...[
                    Text(
                      '${tr(context, 'memorize.coverage', 'Vocabulary coverage')} · ${document.covered} / ${document.total} · ${(100 * document.covered / document.total).toStringAsFixed(1)}%',
                    ),
                    const SizedBox(height: 10),
                    LinearProgressIndicator(
                      value: document.covered / document.total,
                      semanticsLabel: tr(
                        context,
                        'memorize.coverage',
                        'Vocabulary coverage',
                      ),
                    ),
                    if (!document.complete)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: Text(
                          tr(
                            context,
                            'memorize.draft',
                            'Pilot text; coverage is incomplete.',
                          ),
                          style: TextStyle(
                            color: text2Of(context),
                            height: 1.6,
                          ),
                        ),
                      ),
                    if (document.outside > 0)
                      Text(
                        '${tr(context, 'memorize.outside', 'Words outside the selected vocabulary')}: ${document.outside}',
                      ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        FilledButton.icon(
                          onPressed: _listen,
                          icon: Icon(
                            _narration == null ? Icons.volume_up : Icons.stop,
                          ),
                          label: Text(
                            _narration == null
                                ? tr(
                                    context,
                                    'memorize.listen',
                                    'Read the whole story',
                                  )
                                : tr(context, 'memorize.stop', 'Stop audio'),
                          ),
                        ),
                        TextButton(
                          onPressed: _page == 0 ? null : () => _go(0),
                          child: Text(
                            tr(context, 'memorize.reset', 'Start again'),
                          ),
                        ),
                      ],
                    ),
                    if (_audioError)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          tr(
                            context,
                            'memorize.audioError',
                            'Chinese speech is unavailable.',
                          ),
                          semanticsLabel: tr(
                            context,
                            'memorize.audioError',
                            'Chinese speech is unavailable.',
                          ),
                        ),
                      ),
                    const SizedBox(height: 20),
                    InkCard(
                      key: _articleKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            document.title[language] ?? document.title['en']!,
                            style: TextStyle(color: accentOf(context)),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            document.passages[_page].title[language] ??
                                document.passages[_page].title['en']!,
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${tr(context, 'memorize.chapter', 'Passage')} ${_page + 1} / ${document.passages.length}',
                          ),
                          for (final sentence
                              in document.passages[_page].sentences) ...[
                            const SizedBox(height: 22),
                            _sentence(sentence, document),
                            if (_preferences.translation)
                              Padding(
                                padding: const EdgeInsets.only(top: 12),
                                child: Text(
                                  sentence.translations[translationLanguage]!,
                                  style: TextStyle(
                                    color: text2Of(context),
                                    height: 1.75,
                                  ),
                                ),
                              ),
                          ],
                          const SizedBox(height: 24),
                          Wrap(
                            alignment: WrapAlignment.spaceBetween,
                            spacing: 12,
                            runSpacing: 10,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              OutlinedButton(
                                onPressed: _page == 0
                                    ? null
                                    : () => _go(_page - 1),
                                child: Text(
                                  tr(context, 'memorize.previous', 'Previous'),
                                ),
                              ),
                              Text(
                                '${_page + 1} / ${document.passages.length}',
                              ),
                              OutlinedButton(
                                onPressed: _page + 1 == document.passages.length
                                    ? null
                                    : () => _go(_page + 1),
                                child: Text(
                                  tr(context, 'memorize.next', 'Next'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _sentence(ReadingSentence sentence, ReadingDocument document) {
    final style = hanziStyle(
      context,
      size: _preferences.fontSize,
      weight: FontWeight.w400,
      height: 1.7,
    );
    return Text.rich(
      TextSpan(
        style: style,
        children: [
          for (final token in sentence.tokens)
            if (token.wordId == null)
              TextSpan(text: token.text)
            else
              WidgetSpan(
                alignment: PlaceholderAlignment.bottom,
                child: Semantics(
                  label: '${token.text} · ${token.pinyin}',
                  button: true,
                  excludeSemantics: true,
                  onTap: () {
                    _stop();
                    showWordSheet(context, ref, document.words[token.wordId]!);
                  },
                  child: InkWell(
                    borderRadius: BorderRadius.circular(4),
                    onTap: () {
                      _stop();
                      showWordSheet(
                        context,
                        ref,
                        document.words[token.wordId]!,
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 2,
                        vertical: 2,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (_preferences.pinyin)
                            Text(
                              token.pinyin,
                              style: TextStyle(
                                fontSize: 12,
                                color: text2Of(context),
                                height: 1.5,
                              ),
                            ),
                          Text(token.text, style: style),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
