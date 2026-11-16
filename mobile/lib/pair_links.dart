import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import 'app_scope.dart';
import 'data/pair_link.dart';
import 'ui/repo_list.dart' show errorMessage;

/// Applies `lumina://pair` links the OS opens the app with (cold start and while
/// running — app_links' stream includes the initial link) and reports the
/// outcome in a snackbar.
StreamSubscription<Uri> listenForPairLinks(
  AppServices services,
  GlobalKey<ScaffoldMessengerState> messenger, {
  Stream<Uri>? links,
}) {
  return (links ?? AppLinks().uriLinkStream).listen((uri) async {
    final msg = await handlePairLink(services, uri.toString());
    messenger.currentState?.showSnackBar(SnackBar(content: Text(msg)));
  });
}

/// Applies [raw] (scanned or opened). Returns a short message for the user.
Future<String> handlePairLink(AppServices services, String raw) async {
  final link = parsePairLink(raw);
  if (link == null) return 'Not a Lumina pairing code';
  try {
    await services.applyPairLink(link);
    return services.isSignedIn ? 'Connected' : 'Server saved — log in to continue';
  } catch (e) {
    return errorMessage(e);
  }
}
