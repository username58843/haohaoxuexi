import 'package:flutter/material.dart';

const hanziFonts = <String, String>{
  'songti': 'Songti · ZCOOL XiaoWei',
  'system': 'System',
  'web': 'Noto Serif SC · Web',
  'kai': 'Ma Shan Zheng · 楷书',
  'sans': 'Noto Sans SC · 黑体',
};

const interfaceFonts = <String, String>{
  'manrope': 'Manrope',
  'system': 'System',
  'inter': 'Inter',
  'lora': 'Lora',
  'mono': 'JetBrains Mono',
};

const _hanziFamilies = {
  'songti': 'HanziSongti',
  'system': 'sans-serif',
  'web': 'HanziWeb',
  'kai': 'HanziKai',
  'sans': 'HanziSans',
};

const _uiFamilies = {
  'manrope': 'AppManrope',
  'system': 'sans-serif',
  'inter': 'AppInter',
  'lora': 'AppLora',
  'mono': 'AppMono',
};

@immutable
class AppTypography extends ThemeExtension<AppTypography> {
  const AppTypography({this.hanzi = 'songti', this.ui = 'manrope'});

  final String hanzi;
  final String ui;
  String get hanziFamily => _hanziFamilies[hanzi] ?? _hanziFamilies['songti']!;
  String get uiFamily => _uiFamilies[ui] ?? _uiFamilies['manrope']!;

  @override
  AppTypography copyWith({String? hanzi, String? ui}) =>
      AppTypography(hanzi: hanzi ?? this.hanzi, ui: ui ?? this.ui);

  @override
  AppTypography lerp(covariant AppTypography? other, double t) =>
      t < 0.5 || other == null ? this : other;
}
