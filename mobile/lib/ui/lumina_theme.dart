import 'package:flutter/material.dart';

/// Lumina's desktop palette (src/index.css), shared by phone and tablet.
class LuminaColors {
  static const spine = Color(0xFF547F72); // sage accent
  static const spineDark = Color(0xFF8DB8A9);

  // Light
  static const alabaster = Color(0xFFF9F9F6); // app background
  static const paper = Color(0xFFFFFFFF);
  static const gutter = Color(0xFFE2ECE9); // sage wash
  static const stone = Color(0xFFDCD9D2); // borders
  static const charcoal = Color(0xFF111111);
  static const muted = Color(0xFF6B6B66);
  static const danger = Color(0xFF8A5A4C);

  // Dark
  static const nightBg = Color(0xFF121411);
  static const nightPaper = Color(0xFF1A1D19);
  static const nightGutter = Color(0xFF223029);
  static const nightStone = Color(0xFF2E322E);
  static const nightFg = Color(0xFFF3F3F0);
  static const nightMuted = Color(0xFFA3A69F);

  /// Chapter tab colours — muted, paper-friendly tints that cycle per chapter.
  static const chapterTints = [
    Color(0xFF547F72),
    Color(0xFF8A6F4C),
    Color(0xFF5C6F8A),
    Color(0xFF8A5A6E),
    Color(0xFF6F7F4C),
    Color(0xFF4C7F8A),
  ];

  static Color chapterTint(int i) => chapterTints[i % chapterTints.length];
}

/// Display face for headings (Fraunces on desktop; the platform serif here).
const displayFamily = 'serif';

ThemeData luminaTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final bg = dark ? LuminaColors.nightBg : LuminaColors.alabaster;
  final paper = dark ? LuminaColors.nightPaper : LuminaColors.paper;
  final fg = dark ? LuminaColors.nightFg : LuminaColors.charcoal;
  final muted = dark ? LuminaColors.nightMuted : LuminaColors.muted;
  final border = dark ? LuminaColors.nightStone : LuminaColors.stone;
  final gutter = dark ? LuminaColors.nightGutter : LuminaColors.gutter;
  final accent = dark ? LuminaColors.spineDark : LuminaColors.spine;

  final scheme = ColorScheme.fromSeed(
    seedColor: LuminaColors.spine,
    brightness: brightness,
  ).copyWith(
    primary: accent,
    onPrimary: dark ? LuminaColors.nightBg : Colors.white,
    surface: paper,
    onSurface: fg,
    onSurfaceVariant: muted,
    surfaceContainerLowest: paper,
    surfaceContainerLow: bg,
    surfaceContainer: bg,
    surfaceContainerHigh: gutter,
    secondaryContainer: gutter,
    onSecondaryContainer: accent,
    outline: border,
    outlineVariant: border,
    error: LuminaColors.danger,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);
  final text = base.textTheme.apply(bodyColor: fg, displayColor: fg);
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));

  return base.copyWith(
    scaffoldBackgroundColor: bg,
    dividerColor: border,
    textTheme: text.copyWith(
      headlineSmall: text.headlineSmall?.copyWith(fontFamily: displayFamily, fontWeight: FontWeight.w500),
      titleLarge: text.titleLarge?.copyWith(fontFamily: displayFamily, fontWeight: FontWeight.w500),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      foregroundColor: fg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: text.titleLarge?.copyWith(fontFamily: displayFamily, fontWeight: FontWeight.w500),
      shape: Border(bottom: BorderSide(color: border)),
    ),
    cardTheme: CardThemeData(
      color: paper,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: shape.copyWith(side: BorderSide(color: border)),
    ),
    dividerTheme: DividerThemeData(color: border, space: 1, thickness: 1),
    drawerTheme: DrawerThemeData(backgroundColor: paper, surfaceTintColor: Colors.transparent),
    listTileTheme: ListTileThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      selectedTileColor: accent,
      selectedColor: dark ? LuminaColors.nightBg : Colors.white,
      iconColor: muted,
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: paper,
      selectedColor: gutter,
      side: BorderSide(color: border),
      shape: StadiumBorder(side: BorderSide(color: border)),
      labelStyle: text.labelLarge,
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: accent,
      foregroundColor: scheme.onPrimary,
      elevation: 1,
      shape: const StadiumBorder(),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(backgroundColor: accent, foregroundColor: scheme.onPrimary, shape: const StadiumBorder()),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: fg,
        side: BorderSide(color: border),
        shape: const StadiumBorder(),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: paper,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: accent, width: 1.5)),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: gutter,
        selectedForegroundColor: accent,
        side: BorderSide(color: border),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: paper, surfaceTintColor: Colors.transparent, showDragHandle: true),
    dialogTheme: DialogThemeData(backgroundColor: paper, surfaceTintColor: Colors.transparent, shape: shape),
  );
}

/// Small uppercase eyebrow label, as on the desktop ("QUIET SPINE", "LIBRARY").
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              letterSpacing: 2.2,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
      );
}
