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

  /// Opt-in (ADR 0003): fetch a newer APK in the background. Installing still asks.
  bool autoDownloadUpdates = false;

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
      autoDownloadUpdates = j['autoDownloadUpdates'] == true;
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
          'autoDownloadUpdates': autoDownloadUpdates,
        }),
      );

  void update({
    ThemeMode? themeMode,
    ReaderFont? font,
    double? fontSize,
    int? fontColor,
    bool clearFontColor = false,
    bool? notifyUpdates,
    bool? autoDownloadUpdates,
  }) {
    this.themeMode = themeMode ?? this.themeMode;
    this.font = font ?? this.font;
    this.fontSize = (fontSize ?? this.fontSize).clamp(minSize, maxSize);
    this.fontColor = clearFontColor ? null : (fontColor ?? this.fontColor);
    this.notifyUpdates = notifyUpdates ?? this.notifyUpdates;
    this.autoDownloadUpdates = autoDownloadUpdates ?? this.autoDownloadUpdates;
    notifyListeners();
    _save().ignore();
  }

  void reset() => update(
        font: ReaderFont.lumina,
        fontSize: 16,
        clearFontColor: true,
      );

  /// Minimum WCAG contrast for a custom text colour (ADR 0004 contrast guard).
  static const minContrast = 3.0;

  /// True when the chosen colour stays readable on [background].
  bool fontColorReadableOn(Color background) {
    if (fontColor == null) return true;
    return contrastRatio(Color(fontColor!), background) >= minContrast;
  }

  /// Text style for page content (editor + reader body). A colour that would
  /// vanish on the current theme falls back to the theme's text colour.
  TextStyle readerStyle(ColorScheme scheme) => TextStyle(
        fontFamily: font.family,
        fontSize: fontSize,
        height: 1.6,
        color: fontColor != null && fontColorReadableOn(scheme.surface) ? Color(fontColor!) : scheme.onSurface,
      );
}

/// WCAG contrast ratio between two colours (1–21).
double contrastRatio(Color a, Color b) {
  final la = a.computeLuminance(), lb = b.computeLuminance();
  final hi = la > lb ? la : lb, lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}
