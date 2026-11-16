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
