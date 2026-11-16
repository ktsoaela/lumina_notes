import 'package:flutter/material.dart';

import 'library_screen.dart';

/// Signed-in home. Phones and tablets share the Library → Book flow; inside a
/// book, tablets (≥ [breakpoint] dp) show the page list beside the editor.
class AdaptiveHome extends StatelessWidget {
  const AdaptiveHome({super.key});

  static const breakpoint = 840.0;

  @override
  Widget build(BuildContext context) => const LibraryScreen();
}
