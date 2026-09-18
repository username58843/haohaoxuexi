import 'dart:convert';

import 'models.dart';

List<Word> decodeWordPack(String raw) {
  final decoded = jsonDecode(raw);
  if (decoded is! List) throw const FormatException('Invalid word pack');
  return [
    for (final entry in decoded)
      if (entry is Map)
        Word.fromJson(Map<String, dynamic>.from(entry))
      else
        throw const FormatException('Invalid word entry'),
  ];
}
