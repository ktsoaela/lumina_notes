import 'package:flutter/material.dart';

import '../sync/sync_engine.dart';

/// App-bar chip: sync state at a glance. Tap to sync now, see the error, or
/// sign in again when the token expired.
class SyncStatusChip extends StatelessWidget {
  const SyncStatusChip({super.key, required this.engine, required this.onSignInAgain});

  final SyncEngine engine;
  final VoidCallback onSignInAgain;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: engine,
      builder: (context, _) {
        final scheme = Theme.of(context).colorScheme;
        final (label, icon, color) = switch (engine.state) {
          SyncState.idle => ('Synced', Icons.cloud_done_outlined, scheme.primary),
          SyncState.syncing => ('Syncing…', Icons.sync, scheme.primary),
          SyncState.offline => ('Offline', Icons.cloud_off_outlined, scheme.outline),
          SyncState.error => ('Sync error', Icons.error_outline, scheme.error),
          SyncState.authExpired => ('Sign in again', Icons.lock_outline, scheme.error),
        };
        final text = engine.pending > 0 && engine.state != SyncState.idle ? '$label · ${engine.pending}' : label;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: ActionChip(
            avatar: Icon(icon, size: 18, color: color),
            label: Text(text),
            tooltip: engine.lastError,
            onPressed: () {
              switch (engine.state) {
                case SyncState.authExpired:
                  onSignInAgain();
                case SyncState.error:
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(engine.lastError ?? 'Sync failed'),
                    action: SnackBarAction(label: 'Retry', onPressed: engine.syncNow),
                  ));
                default:
                  engine.syncNow();
              }
            },
          ),
        );
      },
    );
  }
}
