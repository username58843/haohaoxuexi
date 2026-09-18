import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

const _sections = ['tasks', 'topics', 'characters', 'grammar'];
Map<String, dynamic> _decodeSyllabus(String raw) =>
    (jsonDecode(raw) as Map<String, dynamic>)['sections']
        as Map<String, dynamic>;

class HskGuideCard extends ConsumerWidget {
  const HskGuideCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(languageProvider);
    return InkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            tr(context, 'hsk3.title', 'HSK 3.0 · Syllabus'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          Text(
            tr(
              context,
              'hsk3.dates',
              'Published November 2025 · Effective July 2026',
            ),
          ),
          const SizedBox(height: 12),
          Text(tr(context, 'hsk3.intro', '11,000 vocabulary entries')),
          const SizedBox(height: 12),
          Text(
            tr(context, 'hsk3.editorial', 'Translations are being reviewed.'),
            style: TextStyle(color: text2Of(context), fontSize: 13),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => context.push('/hsk/syllabus'),
            child: Text(tr(context, 'hsk3.open', 'Read the syllabus')),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/memorize'),
            icon: const Icon(Icons.menu_book),
            label: Text(tr(context, 'memorize.title', 'Memorize')),
          ),
        ],
      ),
    );
  }
}

class HskSyllabusScreen extends ConsumerStatefulWidget {
  const HskSyllabusScreen({super.key});
  @override
  ConsumerState<HskSyllabusScreen> createState() => _HskSyllabusScreenState();
}

class _HskSyllabusScreenState extends ConsumerState<HskSyllabusScreen> {
  late Future<Map<String, dynamic>> _source;
  String _section = 'tasks';

  Future<Map<String, dynamic>> _load() async => compute(
    _decodeSyllabus,
    await rootBundle.loadString('assets/hsk/syllabus-zh.json'),
  );

  @override
  void initState() {
    super.initState();
    _source = _load();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          tr(context, 'hsk3.title', 'HSK 3.0 · Syllabus'),
          maxLines: 2,
        ),
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _source,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return ErrorView(
              message: tr(
                context,
                'memorize.error',
                'Could not load this text.',
              ),
              onRetry: () => setState(() => _source = _load()),
            );
          }
          if (!snapshot.hasData) return const LoadingView();
          final blocks = snapshot.data![_section] as List;
          return ListView.builder(
            key: ValueKey(_section),
            padding: const EdgeInsets.all(16),
            itemCount: blocks.length + 1,
            itemBuilder: (context, index) {
              if (index == 0) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      tr(
                        context,
                        'hsk3.dates',
                        'Published November 2025 · Effective July 2026',
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      tr(context, 'hsk3.intro', '11,000 vocabulary entries'),
                    ),
                    const SizedBox(height: 12),
                    Text(tr(context, 'hsk3.scope', 'Syllabus scope')),
                    for (final section in _sections)
                      ExpansionTile(
                        title: Text(tr(context, 'hsk3.$section', section)),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: Text(
                              tr(context, 'hsk3.${section}Text', section),
                            ),
                          ),
                        ],
                      ),
                    const SizedBox(height: 18),
                    Text(
                      tr(context, 'hsk3.original', 'Chinese original'),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      tr(context, 'hsk3.originalNote', 'Original source text'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _section,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: tr(context, 'hsk3.title', 'Syllabus'),
                      ),
                      items: [
                        for (final section in _sections)
                          DropdownMenuItem(
                            value: section,
                            child: Text(tr(context, 'hsk3.$section', section)),
                          ),
                      ],
                      onChanged: (value) {
                        if (value != null) setState(() => _section = value);
                      },
                    ),
                    const SizedBox(height: 20),
                  ],
                );
              }
              final block = blocks[index - 1] as Map;
              if (block['type'] == 'table') {
                final rows = block['rows'] as List;
                final columns = rows.fold<int>(
                  1,
                  (n, row) => math.max(n, (row as List).length),
                );
                return Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: SizedBox(
                      width: math.max(
                        MediaQuery.sizeOf(context).width - 32,
                        columns * 150.0,
                      ),
                      child: Table(
                        border: TableBorder.all(color: hairlineOf(context)),
                        defaultVerticalAlignment:
                            TableCellVerticalAlignment.top,
                        children: [
                          for (final row in rows)
                            TableRow(
                              children: [
                                for (var i = 0; i < columns; i++)
                                  Padding(
                                    padding: const EdgeInsets.all(10),
                                    child: SelectableText(
                                      i < (row as List).length
                                          ? '${row[i]}'
                                          : '',
                                      style: hanziStyle(
                                        context,
                                        size: 18,
                                        weight: FontWeight.w400,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              }
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: SelectableText(
                  '${block['text']}',
                  style: hanziStyle(
                    context,
                    size: 18,
                    height: 1.8,
                    weight: FontWeight.w400,
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
