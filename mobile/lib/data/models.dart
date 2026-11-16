/// Plain data types mirroring the FastAPI JSON (camelCase keys as the server sends them).
library;

enum EntityKind {
  bookshelf,
  notebook,
  section,
  page;

  String get wire => name;
}

final _tzSuffix = RegExp(r'(Z|[+-]\d{2}:?\d{2})$');

/// Server timestamps are UTC; SQLite returns them without a zone ("2026-11-16 10:00:00").
DateTime? parseServerTime(Object? v) {
  if (v == null) return null;
  final s = v.toString().trim();
  if (s.isEmpty) return null;
  final iso = _tzSuffix.hasMatch(s) ? s : '${s.replaceFirst(' ', 'T')}Z';
  return DateTime.tryParse(iso)?.toUtc();
}

String? _timeToJson(DateTime? t) => t?.toUtc().toIso8601String();

class User {
  const User({required this.id, required this.email, required this.name, this.username});

  final int id;
  final String email;
  final String name;
  final String? username;

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: (j['id'] as num).toInt(),
        email: (j['email'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        username: j['username'] as String?,
      );

  Map<String, dynamic> toJson() =>
      {'id': id, 'email': email, 'name': name, 'username': username};
}

class AuthResult {
  const AuthResult({required this.token, required this.user});

  final String token;
  final User user;

  factory AuthResult.fromJson(Map<String, dynamic> j) => AuthResult(
        token: j['token'] as String,
        user: User.fromJson(j['user'] as Map<String, dynamic>),
      );
}

class Bookshelf {
  const Bookshelf({required this.id, required this.name, this.updatedAt});

  final String id;
  final String name;
  final DateTime? updatedAt;

  factory Bookshelf.fromJson(Map<String, dynamic> j) => Bookshelf(
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        updatedAt: parseServerTime(j['updatedAt']),
      );

  Map<String, dynamic> toJson() =>
      {'id': id, 'name': name, 'updatedAt': _timeToJson(updatedAt)};

  Bookshelf copyWith({String? name, DateTime? updatedAt}) =>
      Bookshelf(id: id, name: name ?? this.name, updatedAt: updatedAt ?? this.updatedAt);
}

class Notebook {
  const Notebook({
    required this.id,
    required this.name,
    required this.bookshelfId,
    this.archived = false,
    this.updatedAt,
  });

  final String id;
  final String name;
  final String bookshelfId;
  final bool archived;
  final DateTime? updatedAt;

  factory Notebook.fromJson(Map<String, dynamic> j) => Notebook(
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        bookshelfId: (j['bookshelfId'] ?? '') as String,
        archived: j['archived'] == true || j['archived'] == 1,
        updatedAt: parseServerTime(j['updatedAt']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'bookshelfId': bookshelfId,
        'archived': archived,
        'updatedAt': _timeToJson(updatedAt),
      };

  Notebook copyWith({String? name, String? bookshelfId, bool? archived, DateTime? updatedAt}) =>
      Notebook(
        id: id,
        name: name ?? this.name,
        bookshelfId: bookshelfId ?? this.bookshelfId,
        archived: archived ?? this.archived,
        updatedAt: updatedAt ?? this.updatedAt,
      );
}

class Section {
  const Section({required this.id, required this.notebookId, required this.name, this.updatedAt});

  final String id;
  final String notebookId;
  final String name;
  final DateTime? updatedAt;

  factory Section.fromJson(Map<String, dynamic> j) => Section(
        id: j['id'] as String,
        notebookId: (j['notebookId'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        updatedAt: parseServerTime(j['updatedAt']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'notebookId': notebookId,
        'name': name,
        'updatedAt': _timeToJson(updatedAt),
      };

  Section copyWith({String? name, String? notebookId, DateTime? updatedAt}) => Section(
        id: id,
        notebookId: notebookId ?? this.notebookId,
        name: name ?? this.name,
        updatedAt: updatedAt ?? this.updatedAt,
      );
}

/// A note page. Named NotePage to avoid clashing with Flutter's `Page`.
class NotePage {
  const NotePage({
    required this.id,
    required this.sectionId,
    required this.title,
    required this.content,
    this.updatedAt,
  });

  final String id;
  final String sectionId;
  final String title;
  final String content;
  final DateTime? updatedAt;

  factory NotePage.fromJson(Map<String, dynamic> j) => NotePage(
        id: j['id'] as String,
        sectionId: (j['sectionId'] ?? '') as String,
        title: (j['title'] ?? '') as String,
        content: (j['content'] ?? '') as String,
        updatedAt: parseServerTime(j['updatedAt']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'sectionId': sectionId,
        'title': title,
        'content': content,
        'updatedAt': _timeToJson(updatedAt),
      };

  NotePage copyWith({String? title, String? content, String? sectionId, DateTime? updatedAt}) =>
      NotePage(
        id: id,
        sectionId: sectionId ?? this.sectionId,
        title: title ?? this.title,
        content: content ?? this.content,
        updatedAt: updatedAt ?? this.updatedAt,
      );
}

EntityKind entityKindFromWire(String wire) => EntityKind.values.byName(wire);

/// Response of `GET /api/sync/changes`.
class SyncChanges {
  const SyncChanges({
    required this.cursor,
    this.bookshelves = const [],
    this.notebooks = const [],
    this.sections = const [],
    this.pages = const [],
    this.tombstones = const [],
  });

  final String cursor;
  final List<Bookshelf> bookshelves;
  final List<Notebook> notebooks;
  final List<Section> sections;
  final List<NotePage> pages;
  final List<(EntityKind, String)> tombstones;

  factory SyncChanges.fromJson(Map<String, dynamic> j) {
    List<Map<String, dynamic>> list(String k) => ((j[k] as List?) ?? const []).cast<Map<String, dynamic>>();
    return SyncChanges(
      cursor: j['cursor'] as String,
      bookshelves: list('bookshelves').map(Bookshelf.fromJson).toList(),
      notebooks: list('notebooks').map(Notebook.fromJson).toList(),
      sections: list('sections').map(Section.fromJson).toList(),
      pages: list('pages').map(NotePage.fromJson).toList(),
      tombstones: list('tombstones')
          .map((t) => (entityKindFromWire(t['entity'] as String), t['id'] as String))
          .toList(),
    );
  }
}

/// One queued mutation sent to `POST /api/sync/push`.
class PushOp {
  const PushOp({
    required this.opId,
    required this.entity,
    required this.op,
    required this.id,
    required this.clientUpdatedAt,
    this.baseUpdatedAt,
    this.data,
  });

  final String opId;
  final EntityKind entity;
  final String op; // 'upsert' | 'delete'
  final String id;
  final DateTime clientUpdatedAt;

  /// Server version this edit was based on (null: never seen by the server).
  final DateTime? baseUpdatedAt;
  final Map<String, dynamic>? data;

  Map<String, dynamic> toJson() => {
        'opId': opId,
        'entity': entity.wire,
        'op': op,
        'id': id,
        'clientUpdatedAt': clientUpdatedAt.toUtc().toIso8601String(),
        'baseUpdatedAt': baseUpdatedAt?.toUtc().toIso8601String(),
        'data': data,
      };
}

/// Per-op push result: `applied`, `stale` or `rejected` (+ server's current row).
class PushResult {
  const PushResult({required this.opId, required this.status, this.detail, this.current, this.updatedAt});

  final String opId;
  final String status;
  final String? detail;
  final Map<String, dynamic>? current;

  /// For `applied`: the row's new server version.
  final DateTime? updatedAt;

  factory PushResult.fromJson(Map<String, dynamic> j) => PushResult(
        opId: j['opId'] as String,
        status: j['status'] as String,
        detail: j['detail'] as String?,
        current: j['current'] as Map<String, dynamic>?,
        updatedAt: parseServerTime(j['updatedAt']),
      );
}
