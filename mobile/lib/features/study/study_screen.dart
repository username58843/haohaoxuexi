import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api.dart';
import '../../core/firebase_bootstrap.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../browse/word_sheet.dart';
import 'study_logic.dart';

String _trN(BuildContext context, String key, String enDefault, int n) =>
    tr(context, key, enDefault).replaceAll('{n}', '$n');

enum _Phase { loading, error, empty, active, done }

class _ReviewItem {
  const _ReviewItem(this.card, {required this.sendSnapshot});

  final SrsCard card;

  /// Include the word snapshot in POST /srs/review (needed the first time a
  /// brand-new word is graded so the server can create the card).
  final bool sendSnapshot;
}

/// Study session: SRS flashcards (`mode=review`) or MCQ quiz (`mode=quiz`).
class StudyScreen extends ConsumerStatefulWidget {
  const StudyScreen({
    super.key,
    required this.mode,
    this.sources = const [],
    this.count = 20,
    this.qmodes = const ['cp', 'ct'],
  });

  /// 'review' | 'quiz'
  final String mode;

  /// Selected sources: pack ids (e.g. `hsk1`, textbook ids) and/or `deck:<id>`.
  final List<String> sources;
  final int count;

  /// Quiz question modes (subset of [kAllQmodes]); defaults to the web's
  /// 字→Pinyin + 字→Meaning pair.
  final List<String> qmodes;

  @override
  ConsumerState<StudyScreen> createState() => _StudyScreenState();
}

class _StudyScreenState extends ConsumerState<StudyScreen> {
  _Phase _phase = _Phase.loading;
  String _error = '';

  // Review state.
  final List<_ReviewItem> _queue = [];
  bool _flipped = false;

  // Quiz state.
  List<QuizQuestion> _questions = const [];
  int? _selected;
  Timer? _advanceTimer;

  // Shared session progress.
  int _index = 0;
  int _answered = 0; // grades submitted, incl. repeats of "Again" cards
  final Set<String> _seenIds = {};
  int _firstTryCorrect = 0;
  final Map<String, Word> _mistakes = {};
  int _syncFailed = 0;
  final List<Future<void>> _pending = [];
  Future<SrsSummary?>? _resultsSummary;
  bool _leaving = false;

  bool get _isQuiz => widget.mode == 'quiz';
  int get _total => _isQuiz ? _questions.length : _queue.length;
  bool get _midSession =>
      _phase == _Phase.active && _answered > 0 && !_leaving;

  int get _tzOffset => DateTime.now().timeZoneOffset.inMinutes;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _advanceTimer?.cancel();
    super.dispose();
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  Future<void> _load() async {
    _advanceTimer?.cancel();
    // Completed (or abandoned) sync futures from a previous "Study again"
    // run must not leak into the next session's results barrier.
    _pending.clear();
    setState(() {
      _phase = _Phase.loading;
      _index = 0;
      _answered = 0;
      _firstTryCorrect = 0;
      _seenIds.clear();
      _mistakes.clear();
      _syncFailed = 0;
      _flipped = false;
      _selected = null;
      _resultsSummary = null;
    });
    try {
      if (_isQuiz) {
        final pool = await _loadPool();
        final questions = buildQuiz(
            pool, widget.qmodes, widget.count, ref.read(languageProvider));
        if (!mounted) return;
        setState(() {
          _questions = questions;
          _phase = questions.isEmpty ? _Phase.empty : _Phase.active;
        });
      } else {
        final api = ref.read(apiProvider);
        final data = await api.get('/srs/queue', query: {
          if (widget.sources.isNotEmpty) 'packs': widget.sources.join(','),
          'limit': widget.count.clamp(1, 100),
        });
        final cardsRaw = data['cards'];
        final items = <_ReviewItem>[];
        if (cardsRaw is List) {
          for (final raw in cardsRaw) {
            if (raw is! Map) continue;
            final card = SrsCard.fromJson(Map<String, dynamic>.from(raw));
            if (card.wordId.isEmpty || card.word.simplified.isEmpty) continue;
            items.add(_ReviewItem(card, sendSnapshot: card.isNew));
          }
        }
        if (!mounted) return;
        setState(() {
          _queue
            ..clear()
            ..addAll(items);
          _phase = items.isEmpty ? _Phase.empty : _Phase.active;
        });
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _error = e.isNetwork
            ? tr(context, 'error.network', 'Network error. Check your connection.')
            : e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _error = tr(context, 'common.error', 'Something went wrong');
      });
    }
  }

  /// Word pool for quiz mode from the selected sources.
  Future<List<Word>> _loadPool() async {
    final sources = widget.sources.isEmpty ? const ['hsk1'] : widget.sources;
    final api = ref.read(apiProvider);
    final byId = <String, Word>{};
    for (final source in sources) {
      List<Word> words;
      if (source.startsWith('deck:')) {
        final data = await api.get('/decks/${source.substring(5)}');
        final deckRaw = data['deck'];
        final deck = Deck.fromJson(
          deckRaw is Map ? Map<String, dynamic>.from(deckRaw) : data,
        );
        words = deck.words;
      } else if (bundledHskPackIds.contains(source.toLowerCase())) {
        words = await ref.read(wordPacksProvider(source.toLowerCase()).future);
      } else {
        final data = await api.get('/words', query: {'pack': source});
        final items = data['items'];
        words = items is List
            ? [
                for (final w in items)
                  if (w is Map) Word.fromJson(Map<String, dynamic>.from(w)),
              ]
            : const [];
      }
      for (final w in words) {
        if (w.simplified.isNotEmpty) byId[w.id] = w;
      }
    }
    return byId.values.toList();
  }

  // -------------------------------------------------------------------------
  // Grading / advancing
  // -------------------------------------------------------------------------

  /// Sends the review to the server without blocking the UI; retries once on
  /// failure (offline tolerance), then counts the loss for the results screen.
  void _postReview(String wordId, int grade, {Word? snapshot}) {
    final api = ref.read(apiProvider);
    final body = <String, dynamic>{
      'wordId': wordId,
      'grade': grade,
      if (snapshot != null) 'word': snapshot.toSnapshotJson(),
      'tzOffset': _tzOffset,
    };
    final future = () async {
      try {
        await api.post('/srs/review', body: body);
      } on ApiException {
        await Future<void>.delayed(const Duration(seconds: 2));
        try {
          await api.post('/srs/review', body: body);
        } on ApiException {
          if (mounted) setState(() => _syncFailed++);
        }
      }
    }();
    _pending.add(future);
  }

  void _gradeCard(int grade) {
    if (_phase != _Phase.active || _index >= _queue.length) return;
    final item = _queue[_index];
    final card = item.card;
    _answered++;
    final firstTry = _seenIds.add(card.wordId);
    if (firstTry) {
      if (grade >= 2) {
        _firstTryCorrect++;
      } else {
        _mistakes[card.wordId] = card.word;
      }
    }
    if (grade == 0) {
      // Reinsert the card a few positions later so it comes back this session.
      final at = math.min(_index + 3, _queue.length);
      _queue.insert(
        at,
        _ReviewItem(
          SrsCard(
            wordId: card.wordId,
            word: card.word,
            state: 'learning',
            ease: math.max(1.3, card.state == 'review' ? card.ease - 0.2 : card.ease),
            intervalDays: 0,
            due: DateTime.now().toUtc(),
            reps: card.reps + 1,
            lapses: card.lapses,
          ),
          // Keep sending the snapshot for cards that entered the session as
          // brand-new: if the first POST /srs/review never reached the server
          // (offline blip), a snapshot-less repeat would 400 with
          // "word snapshot required". For existing cards the server ignores
          // the extra snapshot, so this is always safe.
          sendSnapshot: item.sendSnapshot,
        ),
      );
    }
    _postReview(card.wordId, grade,
        snapshot: item.sendSnapshot ? card.word : null);
    _next();
  }

  void _answerQuiz(int option) {
    if (_phase != _Phase.active || _selected != null) return;
    final q = _questions[_index];
    final correct = option == q.correctIndex;
    _answered++;
    _seenIds.add(q.word.id);
    if (correct) {
      _firstTryCorrect++;
    } else {
      _mistakes[q.word.id] = q.word;
    }
    // MCQ auto-grade: correct first try → Good(2), wrong → Again(0).
    _postReview(q.word.id, correct ? 2 : 0, snapshot: q.word);
    setState(() => _selected = option);
    _advanceTimer?.cancel();
    if (correct) {
      // Correct answers flash green and auto-advance; wrong answers reveal
      // the right option and wait for the Next button (like the web session).
      _advanceTimer = Timer(const Duration(milliseconds: 650), () {
        if (mounted) _next();
      });
    }
  }

  void _next() {
    final next = _index + 1;
    if (next >= _total) {
      _finish();
      return;
    }
    setState(() {
      _index = next;
      _flipped = false;
      _selected = null;
    });
  }

  void _finish() {
    _advanceTimer?.cancel();
    // Session telemetry (no-op without Firebase): first-try accuracy over
    // unique cards, matching what the results screen shows.
    final unique = _seenIds.length;
    FirebaseBootstrap.logEvent('session_complete', {
      'mode': widget.mode,
      'answered': _answered,
      'accuracy': unique == 0 ? 0 : ((_firstTryCorrect / unique) * 100).round(),
    });
    _resultsSummary = _loadResultsSummary();
    setState(() => _phase = _Phase.done);
  }

  Future<SrsSummary?> _loadResultsSummary() async {
    try {
      await Future.wait(_pending);
      final api = ref.read(apiProvider);
      final data = await api.get('/srs/summary', query: {'tzOffset': _tzOffset});
      final summary = SrsSummary.fromJson(data);
      // Post-session streak — logged here, right after it could have grown.
      if (summary.streak > 0) {
        FirebaseBootstrap.logEvent('streak', {'days': summary.streak});
      }
      return summary;
    } on ApiException {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Exit confirmation
  // -------------------------------------------------------------------------

  void _requestExit() {
    if (_midSession) {
      _confirmExit();
    } else {
      context.pop();
    }
  }

  Future<void> _confirmExit() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr(dialogContext, 'study.exitTitle', 'Leave session?')),
        content: Text(tr(
          dialogContext,
          'study.exitText',
          'Graded cards are already saved. The rest will wait for next time.',
        )),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(tr(dialogContext, 'study.keepGoing', 'Keep going')),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              tr(dialogContext, 'study.leave', 'Leave'),
              style: const TextStyle(color: dangerColor),
            ),
          ),
        ],
      ),
    );
    if (leave == true && mounted) {
      setState(() => _leaving = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.pop();
      });
    }
  }

  // -------------------------------------------------------------------------
  // Build
  // -------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    final title = _isQuiz
        ? tr(context, 'study.quiz', 'Quiz')
        : tr(context, 'study.review', 'Review');
    final active = _phase == _Phase.active;

    return PopScope(
      canPop: !_midSession,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _confirmExit();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: _requestExit,
          ),
          title: Text(
            active && _total > 0
                ? '$title · ${math.min(_index + 1, _total)}/$_total'
                : title,
          ),
          bottom: active
              ? PreferredSize(
                  preferredSize: const Size.fromHeight(6),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 2),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(2),
                      child: LinearProgressIndicator(
                        value: _total == 0 ? 0 : _index / _total,
                        minHeight: 4,
                      ),
                    ),
                  ),
                )
              : null,
        ),
        body: SafeArea(child: _body(context)),
      ),
    );
  }

  Widget _body(BuildContext context) {
    switch (_phase) {
      case _Phase.loading:
        return const LoadingView();
      case _Phase.error:
        return ErrorView(message: _error, onRetry: _load);
      case _Phase.empty:
        return _emptyView(context);
      case _Phase.done:
        return _resultsView(context);
      case _Phase.active:
        return _isQuiz ? _quizView(context) : _reviewView(context);
    }
  }

  Widget _emptyView(BuildContext context) {
    return EmptyView(
      glyph: '好',
      title: _isQuiz
          ? tr(context, 'study.quizEmptyTitle', 'No words found')
          : tr(context, 'study.allCaughtUp', 'All caught up!'),
      text: _isQuiz
          ? tr(context, 'study.quizEmptyText',
              'The selected packs have no words to quiz.')
          : tr(context, 'study.caughtUpText',
              'No cards are due right now. Come back later, or learn new words.'),
      action: PillButton(
        label: tr(context, 'nav.home', 'Home'),
        icon: Icons.home_rounded,
        onPressed: () => context.pop(),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Review (flashcards)
  // -------------------------------------------------------------------------

  Widget _reviewView(BuildContext context) {
    final item = _queue[_index];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        children: [
          Expanded(
            child: InkCard(
              padding: const EdgeInsets.all(24),
              onTap: () => setState(() => _flipped = !_flipped),
              child: SizedBox.expand(
                child: _flipped
                    ? _cardBack(context, item.card.word)
                    : _cardFront(context, item.card),
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (_flipped)
            _gradeRow(context, item.card)
          else
            PillButton(
              label: tr(context, 'study.showAnswer', 'Show answer'),
              variant: PillVariant.soft,
              size: PillSize.lg,
              expanded: true,
              onPressed: () => setState(() => _flipped = true),
            ),
        ],
      ),
    );
  }

  Widget _cardFront(BuildContext context, SrsCard card) {
    final word = card.word;
    final size = word.simplified.length <= 2
        ? 88.0
        : word.simplified.length <= 4
            ? 64.0
            : 44.0;
    return Column(
      children: [
        Expanded(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (card.isNew) ...[
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: accentSoftOf(context),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      tr(context, 'study.new', 'NEW'),
                      style: monoStyle(context,
                          size: 10, color: accentOf(context)),
                    ),
                  ),
                  const SizedBox(height: 18),
                ],
                HanziText(word.simplified,
                    size: size, textAlign: TextAlign.center),
                if (word.traditional.isNotEmpty &&
                    word.traditional != word.simplified) ...[
                  const SizedBox(height: 10),
                  HanziText(word.traditional,
                      size: 24, color: text3Of(context)),
                ],
              ],
            ),
          ),
        ),
        Text(
          tr(context, 'study.tapToReveal', 'Tap to reveal'),
          style: GoogleFonts.manrope(fontSize: 12, color: text3Of(context)),
        ),
      ],
    );
  }

  Widget _cardBack(BuildContext context, Word word) {
    final lang = I18n.language;
    final translations = lang == 'ru' ? word.ru : word.en;
    final extra = [
      for (final t in translations)
        if (!word.definitions.contains(t)) t,
    ];
    return SingleChildScrollView(
      child: SizedBox(
        width: double.infinity,
        child: Column(
          children: [
            const SizedBox(height: 8),
            HanziText(word.simplified, size: 44, textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(
              word.pinyin,
              textAlign: TextAlign.center,
              style: GoogleFonts.manrope(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: accentOf(context),
              ),
            ),
            const SizedBox(height: 16),
            Container(width: 56, height: 1, color: hairlineOf(context)),
            const SizedBox(height: 16),
            for (final def in word.definitions)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Text(
                  def,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(fontSize: 15.5, height: 1.4),
                ),
              ),
            if (extra.isNotEmpty) ...[
              const SizedBox(height: 8),
              for (final t in extra.take(4))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    t,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.manrope(
                      fontSize: 14,
                      height: 1.4,
                      color: text2Of(context),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _gradeRow(BuildContext context, SrsCard card) {
    final accent = accentOf(context);
    final specs = [
      (0, tr(context, 'study.again', 'Again'),
          dangerColor.withValues(alpha: 0.14), dangerColor),
      (1, tr(context, 'study.hard', 'Hard'),
          warnColor.withValues(alpha: 0.14), warnColor),
      (2, tr(context, 'study.good', 'Good'),
          accent.withValues(alpha: 0.14), accent),
      (3, tr(context, 'study.easy', 'Easy'), accent, onAccent(accent)),
    ];
    return Row(
      children: [
        for (var i = 0; i < specs.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: _GradeButton(
              label: specs[i].$2,
              hint: formatInterval(nextIntervalDays(card, specs[i].$1)),
              background: specs[i].$3,
              foreground: specs[i].$4,
              onTap: () => _gradeCard(specs[i].$1),
            ),
          ),
        ],
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Quiz (MCQ)
  // -------------------------------------------------------------------------

  Widget _quizView(BuildContext context) {
    final q = _questions[_index];
    final wrong = _selected != null && _selected != q.correctIndex;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        children: [
          Center(
            child: QmodeLabel(
              q.qmode,
              style: monoStyle(context),
              hanziSize: 13,
              uppercase: true,
            ),
          ),
          Expanded(child: Center(child: _quizPrompt(context, q))),
          for (var i = 0; i < q.options.length; i++) ...[
            _optionButton(context, q, i),
            if (i < q.options.length - 1) const SizedBox(height: 10),
          ],
          if (wrong) ...[
            const SizedBox(height: 14),
            PillButton(
              label: tr(context, 'study.next', 'Next'),
              size: PillSize.lg,
              expanded: true,
              onPressed: _next,
            ),
          ],
        ],
      ),
    );
  }

  /// Prompt side of the question, styled per field like the web
  /// `.sess-quiz__prompt` variants: big serif hanzi, accent pinyin,
  /// plain meaning text.
  Widget _quizPrompt(BuildContext context, QuizQuestion q) {
    switch (q.promptType) {
      case QuizField.hanzi:
        final size = q.prompt.length <= 2
            ? 76.0
            : q.prompt.length <= 4
                ? 56.0
                : 40.0;
        return HanziText(q.prompt, size: size, textAlign: TextAlign.center);
      case QuizField.pinyin:
        return Text(
          q.prompt,
          textAlign: TextAlign.center,
          style: GoogleFonts.manrope(
            fontSize: 26,
            fontWeight: FontWeight.w600,
            color: accentOf(context),
          ),
        );
      case QuizField.meaning:
        return Text(
          q.prompt,
          textAlign: TextAlign.center,
          style: GoogleFonts.manrope(
            fontSize: 19,
            fontWeight: FontWeight.w600,
            height: 1.35,
          ),
        );
    }
  }

  Widget _optionButton(BuildContext context, QuizQuestion q, int i) {
    final answered = _selected != null;
    final isCorrect = i == q.correctIndex;
    final isChosen = _selected == i;

    Color background = surfaceOf(context);
    Color border = hairlineOf(context);
    Color numColor = text3Of(context);
    double opacity = 1;
    if (answered) {
      if (isCorrect) {
        background = okColor.withValues(alpha: 0.16);
        border = okColor.withValues(alpha: 0.6);
        numColor = okColor;
      } else if (isChosen) {
        background = dangerColor.withValues(alpha: 0.14);
        border = dangerColor.withValues(alpha: 0.6);
        numColor = dangerColor;
      } else {
        opacity = 0.45;
      }
    }

    // Answer text styled per field, like the web `.sess-option--hanzi` /
    // `--pinyin` variants: serif hanzi, larger pinyin, plain meaning.
    final answerStyle = switch (q.answerType) {
      QuizField.hanzi => hanziStyle(context, size: 22),
      QuizField.pinyin =>
        GoogleFonts.manrope(fontSize: 16.5, fontWeight: FontWeight.w600),
      QuizField.meaning =>
        GoogleFonts.manrope(fontSize: 14.5, fontWeight: FontWeight.w600),
    };

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 150),
      opacity: opacity,
      child: Material(
        color: background,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: answered ? null : () => _answerQuiz(i),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: surface2Of(context),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: hairlineOf(context)),
                  ),
                  child: Text(
                    '${i + 1}',
                    style: monoStyle(context,
                        size: 11.5, letterSpacing: 0, color: numColor),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    q.options[i],
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: answerStyle,
                  ),
                ),
                if (answered && isCorrect)
                  const Icon(Icons.check_circle_rounded,
                      size: 20, color: okColor)
                else if (answered && isChosen)
                  const Icon(Icons.cancel_rounded,
                      size: 20, color: dangerColor),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Results
  // -------------------------------------------------------------------------

  Widget _resultsView(BuildContext context) {
    final unique = _seenIds.length;
    final accuracy = unique == 0 ? 0.0 : _firstTryCorrect / unique;
    final mistakes = _mistakes.values.toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      children: [
        Center(
          child: SizedBox(
            width: 116,
            height: 116,
            child: CustomPaint(
              painter: _RingPainter(
                progress: accuracy,
                color: accentOf(context),
                track: surface3Of(context),
                stroke: 10,
              ),
              child: Center(
                child: Text(
                  '${(accuracy * 100).round()}%',
                  style: GoogleFonts.manrope(
                      fontSize: 24, fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            tr(context, 'study.accuracy', 'Accuracy'),
            style: GoogleFonts.manrope(fontSize: 12, color: text3Of(context)),
          ),
        ),
        const SizedBox(height: 14),
        Center(
          child: Text(
            tr(context, 'study.sessionComplete', 'Session complete'),
            style:
                GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            _ResultStat(
              value: '$_answered',
              label: tr(context, 'study.reviewed', 'Reviewed'),
            ),
            const SizedBox(width: 10),
            _ResultStat(
              value: '$_firstTryCorrect',
              label: tr(context, 'study.correct', 'Correct'),
            ),
            const SizedBox(width: 10),
            _ResultStat(
              value: '${mistakes.length}',
              label: tr(context, 'study.mistakes', 'Mistakes'),
            ),
          ],
        ),
        const SizedBox(height: 14),
        FutureBuilder<SrsSummary?>(
          future: _resultsSummary,
          builder: (context, snap) {
            final streak = snap.data?.streak ?? 0;
            if (streak <= 0) return const SizedBox.shrink();
            return Center(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: accentSoftOf(context),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '🔥 ${_trN(context, 'study.dayStreak', '{n}-day streak', streak)}',
                  style: GoogleFonts.manrope(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: accentOf(context),
                  ),
                ),
              ),
            );
          },
        ),
        if (_syncFailed > 0) ...[
          const SizedBox(height: 12),
          Center(
            child: Text(
              _trN(context, 'study.syncFailed',
                  '{n} reviews failed to sync', _syncFailed),
              style: GoogleFonts.manrope(fontSize: 12.5, color: warnColor),
            ),
          ),
        ],
        if (mistakes.isNotEmpty) ...[
          const SizedBox(height: 24),
          SectionLabel(tr(context, 'study.mistakes', 'Mistakes')),
          const SizedBox(height: 10),
          InkCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < mistakes.length; i++) ...[
                  if (i > 0) const Divider(),
                  _mistakeRow(context, mistakes[i]),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: PillButton(
                label: tr(context, 'study.studyAgain', 'Study again'),
                variant: PillVariant.soft,
                icon: Icons.replay_rounded,
                onPressed: _load,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: PillButton(
                label: tr(context, 'nav.home', 'Home'),
                icon: Icons.home_rounded,
                onPressed: () => context.pop(),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _mistakeRow(BuildContext context, Word word) {
    final meaning = quizMeaning(word, I18n.language);
    return InkWell(
      onTap: () => showWordSheet(context, ref, word),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            HanziText(word.simplified, size: 22),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    word.pinyin,
                    style: GoogleFonts.manrope(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: accentOf(context),
                    ),
                  ),
                  if (meaning.isNotEmpty)
                    Text(
                      meaning,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.manrope(
                          fontSize: 13, color: text2Of(context)),
                    ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded,
                size: 20, color: text3Of(context)),
          ],
        ),
      ),
    );
  }
}

/// Compact grade button: label + predicted-interval hint.
class _GradeButton extends StatelessWidget {
  const _GradeButton({
    required this.label,
    required this.hint,
    required this.background,
    required this.foreground,
    required this.onTap,
  });

  final String label;
  final String hint;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.manrope(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: foreground,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                hint,
                style: GoogleFonts.manrope(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: foreground.withValues(alpha: 0.75),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResultStat extends StatelessWidget {
  const _ResultStat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkCard(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        child: Column(
          children: [
            Text(
              value,
              style: GoogleFonts.manrope(
                  fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.manrope(
                  fontSize: 11.5, color: text2Of(context)),
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.color,
    required this.track,
    this.stroke = 8,
  });

  final double progress;
  final Color color;
  final Color track;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide - stroke) / 2;
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );
    final p = progress.clamp(0.0, 1.0);
    if (p > 0) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -math.pi / 2,
        p * 2 * math.pi,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.color != color ||
      oldDelegate.track != track ||
      oldDelegate.stroke != stroke;
}
