import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'local_db.g.dart';

/// Local mirror of the server hierarchy. `updatedAt` is the time of the last
/// local edit, or the server's `updatedAt` for rows that came from a pull.
@DataClassName('BookshelfRow')
class Bookshelves extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  DateTimeColumn get updatedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('NotebookRow')
class Notebooks extends Table {
  TextColumn get id => text()();
  TextColumn get bookshelfId => text()();
  TextColumn get name => text()();
  BoolColumn get archived => boolean().withDefault(const Constant(false))();
  DateTimeColumn get updatedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('SectionRow')
class Sections extends Table {
  TextColumn get id => text()();
  TextColumn get notebookId => text()();
  TextColumn get name => text()();
  DateTimeColumn get updatedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('PageRow')
class Pages extends Table {
  TextColumn get id => text()();
  TextColumn get sectionId => text()();
  TextColumn get title => text()();
  TextColumn get content => text()();
  DateTimeColumn get updatedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Pending local mutations, one row per entity. [seq] is the push order.
@DataClassName('OutboxEntry')
class Outbox extends Table {
  IntColumn get seq => integer().autoIncrement()();
  TextColumn get entity => text()(); // EntityKind.wire
  TextColumn get entityId => text()();
  TextColumn get op => text()(); // 'upsert' | 'delete'
  TextColumn get payload => text()(); // JSON (row without id)
  DateTimeColumn get clientUpdatedAt => dateTime()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();

  @override
  List<Set<Column>> get uniqueKeys => [
        {entity, entityId},
      ];
}

@DataClassName('SyncMetaRow')
class SyncMeta extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();

  @override
  Set<Column> get primaryKey => {key};
}

@DriftDatabase(tables: [Bookshelves, Notebooks, Sections, Pages, Outbox, SyncMeta])
class LocalDb extends _$LocalDb {
  LocalDb() : super(driftDatabase(name: 'lumina'));

  LocalDb.forTesting(super.executor);

  @override
  int get schemaVersion => 1;
}
