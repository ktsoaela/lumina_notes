import 'dart:convert';

import 'package:flutter/material.dart';

import 'data/session_store.dart';

/// Reading/writing font families. Lumina's own identity is the serif.
enum ReaderFont {
  lumina('Lumina serif (default)', 'serif'),
  sans('Sans', 'sans-serif'),
  mono('Monospace', 'monospace');

  const ReaderFont(this.label, this.family);

  final String label;

  /// Platform family name (Android maps these to Noto Serif / Roboto / Droid Sans Mono).
  final String family;
}

/// Device-local preferences: theme, reading typography, update notices.
class AppSettings extends ChangeNotifier {
  AppSettings(this._store);

  /// Not persisted (tests).
  AppSettings.inMemory() : _store = MemoryKeyValueStore();

  final KeyValueSecureStore _store;
  static const _key = 'lumina.settings';

  static const minSize = 12.0;
  static const maxSize = 28.0;

  ThemeMode themeMode = ThemeMode.system;
  ReaderFont font = ReaderFont.lumina;
  double fontSize = 16;

  /// ARGB, or null to follow the theme.
  int? fontColor;
  bool notifyUpdates = true;

  Future<void> load() async {
    try {
      final raw = await _store.read(_key);
      if (raw == null) return;
      final j = jsonDecode(raw) as Map<String, dynamic>;
      themeMode = ThemeMode.values.asNameMap()[j['themeMode']] ?? ThemeMode.system;
      font = ReaderFont.values.asNameMap()[j['font']] ?? ReaderFont.lumina;
      final size = (j['fontSize'] as num?)?.toDouble() ?? 16;
      fontSize = size.clamp(minSize, maxSize);
      fontColor = (j['fontColor'] as num?)?.toInt();
      notifyUpdates = j['notifyUpdates'] != false;
    } catch (_) {
      // Corrupt prefs: keep defaults.
    }
    notifyListeners();
  }

  Future<void> _save() => _store.write(
        _key,
        jsonEncode({
          'themeMode': themeMode.name,
          'font': font.name,
          'fontSize': fontSize,
          'fontColor': fontColor,
          'notifyUpdates': notifyUpdates,
        }),
      );

  void update({
    ThemeMode? themeMode,
    ReaderFont? font,
    double? fontSize,
    int? fontColor,
    bool clearFontColor = false,
    bool? notifyUpdates,
  }) {
    this.themeMode = themeMode ?? this.themeMode;
    this.font = font ?? this.font;
    this.fontSize = (fontSize ?? this.fontSize).clamp(minSize, maxSize);
    this.fontColor = clearFontColor ? null : (fontColor ?? this.fontColor);
    this.notifyUpdates = notifyUpdates ?? this.notifyUpdates;
    notifyListeners();
    _save().ignore();
  }

  void reset() => update(
        font: ReaderFont.lumina,
        fontSize: 16,
        clearFontColor: true,
      );

  /// Text style for page content (editor + reader body).
  TextStyle readerStyle(ColorScheme scheme) => TextStyle(
        fontFamily: font.family,
        fontSize: fontSize,
        height: 1.6,
        color: fontColor != null ? Color(fontColor!) : scheme.onSurface,
      );
}
