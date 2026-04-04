<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration for INVESTIGATIONS module tables.
 * Auto-generated from schema dump.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('investigation_connections', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('from_node_id', 36);
            $table->string('to_node_id', 36);
            $table->string('from_side', 16)->default('right');
            $table->string('to_side', 16)->default('left');
            $table->enum('style', ['solid', 'dashed', 'dotted'])->default('solid');
            $table->enum('path_type', ['curved', 'straight', 'orthogonal'])->default('curved');
            $table->string('color', 7)->default('#6b7280');
            $table->decimal('thickness', 3, 1)->default(2.0);
            $table->enum('arrow_type', ['none', 'forward', 'backward', 'both'])->default('forward');
            $table->string('relationship_type', 64)->nullable();
            $table->string('relationship_label')->nullable();
            $table->enum('sentiment', ['neutral', 'positive', 'negative'])->default('neutral');
            $table->integer('weight')->default(5);
            $table->text('notes')->nullable();
            $table->string('partition_id', 36);
            $table->boolean('deleted')->default(false);
            $table->string('deleted_by', 36)->nullable();
            $table->timestamps();
            $table->index('investigation_id', 'investigation_connections_investigation_id_index');
            $table->index('from_node_id', 'investigation_connections_from_node_id_index');
            $table->index('to_node_id', 'investigation_connections_to_node_id_index');
            $table->index('partition_id', 'investigation_connections_partition_id_index');
            $table->index('relationship_type', 'investigation_connections_relationship_type_index');
            $table->index('deleted', 'investigation_connections_deleted_index');
            $table->foreign('from_node_id')->references('record_id')->on('investigation_nodes')->onDelete('cascade');
            $table->foreign('investigation_id')->references('record_id')->on('investigations')->onDelete('cascade');
            // Cross-module FK skipped: investigation_connections_partition_id_foreign -> identity_partitions.record_id
            $table->foreign('to_node_id')->references('record_id')->on('investigation_nodes')->onDelete('cascade');
        });

        Schema::create('investigation_drawings', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('tool', 32)->default('pencil');
            $table->json('points');
            $table->string('color', 7)->default('#000000');
            $table->decimal('size', 5, 1)->default(2.0);
            $table->enum('line_style', ['solid', 'dashed', 'dotted'])->nullable();
            $table->decimal('thickness', 3, 1)->nullable();
            $table->enum('arrow_type', ['none', 'one-way', 'two-way'])->nullable();
            $table->string('text', 500)->nullable();
            $table->integer('z_index')->default(0);
            $table->string('partition_id', 36);
            $table->boolean('deleted')->default(false);
            $table->string('deleted_by', 36)->nullable();
            $table->timestamps();
            $table->index('investigation_id', 'investigation_drawings_investigation_id_index');
            $table->index('partition_id', 'investigation_drawings_partition_id_index');
            $table->index('deleted', 'investigation_drawings_deleted_index');
            $table->foreign('investigation_id')->references('record_id')->on('investigations')->onDelete('cascade');
            // Cross-module FK skipped: investigation_drawings_partition_id_foreign -> identity_partitions.record_id
        });

        Schema::create('investigation_entities', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('entity_id')->nullable();
            $table->string('role');
            $table->string('relationship')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_key_entity')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index('created_by', 'investigation_entities_created_by_foreign');
            $table->index(['investigation_id', 'role'], 'investigation_entities_investigation_id_role_index');
            $table->index(['investigation_id', 'entity_id'], 'investigation_entities_investigation_id_entity_id_index');
            $table->index(['investigation_id', 'is_key_entity'], 'investigation_entities_investigation_id_is_key_entity_index');
            $table->index('entity_id', 'idx_investigation_entities_entity');
            $table->index('deleted_by', 'investigation_entities_deleted_by_foreign');
            $table->index('updated_by', 'investigation_entities_updated_by_foreign');
            $table->index('deleted', 'investigation_entities_deleted_index');
            // Cross-module FK skipped: investigation_entities_deleted_by_foreign -> identity_users.record_id
            // Cross-module FK skipped: investigation_entities_entity_id_foreign -> entities.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_entities_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigation_events', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('event_id')->nullable();
            $table->string('role')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_key_event')->default(false);
            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index(['investigation_id', 'event_id'], 'investigation_events_investigation_id_event_id_index');
            $table->index(['investigation_id', 'is_key_event'], 'investigation_events_investigation_id_is_key_event_index');
            $table->index('deleted_by', 'investigation_events_deleted_by_foreign');
            $table->index('deleted', 'investigation_events_deleted_index');
            $table->index('event_id', 'investigation_events_event_id_foreign');
            $table->index('created_by', 'investigation_events_created_by_foreign');
            $table->index('updated_by', 'investigation_events_updated_by_foreign');
            // Cross-module FK skipped: investigation_events_created_by_foreign -> identity_users.record_id
            // Cross-module FK skipped: investigation_events_deleted_by_foreign -> identity_users.record_id
            // Cross-module FK skipped: investigation_events_event_id_foreign -> events.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_events_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigation_evidence', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('title');
            $table->string('evidence_type');
            $table->text('description');
            $table->string('source')->nullable();
            $table->date('date_collected')->nullable();
            $table->string('collected_by')->nullable();
            $table->integer('chain_position')->default(1);
            $table->string('verification_status')->default('unverified');
            $table->text('notes')->nullable();
            $table->string('related_people')->nullable();
            $table->string('related_events')->nullable();
            $table->string('files')->nullable();
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index('created_by', 'investigation_evidence_created_by_foreign');
            $table->index(['investigation_id', 'evidence_type'], 'inv_evidence_type_idx');
            $table->index(['investigation_id', 'verification_status'], 'inv_evidence_status_idx');
            $table->index(['investigation_id', 'chain_position'], 'inv_evidence_chain_idx');
            $table->index(['investigation_id', 'date_collected'], 'inv_evidence_date_idx');
            $table->index('deleted_by', 'investigation_evidence_deleted_by_foreign');
            $table->index('updated_by', 'investigation_evidence_updated_by_foreign');
            $table->index('deleted', 'investigation_evidence_deleted_index');
            // Cross-module FK skipped: investigation_evidence_deleted_by_foreign -> identity_users.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_evidence_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigation_files', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('file_id')->nullable();
            $table->string('file_type')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_key_file')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index('created_by', 'investigation_files_created_by_foreign');
            $table->index(['investigation_id', 'file_id'], 'investigation_files_investigation_id_file_id_index');
            $table->index(['investigation_id', 'file_type'], 'investigation_files_investigation_id_file_type_index');
            $table->index(['investigation_id', 'is_key_file'], 'investigation_files_investigation_id_is_key_file_index');
            $table->index('file_id', 'investigation_files_file_id_foreign');
            $table->index('deleted_by', 'investigation_files_deleted_by_foreign');
            $table->index('updated_by', 'investigation_files_updated_by_foreign');
            $table->index('deleted', 'investigation_files_deleted_index');
            // Cross-module FK skipped: investigation_files_deleted_by_foreign -> identity_users.record_id
            // Cross-module FK skipped: investigation_files_file_id_foreign -> files.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_files_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigation_folders', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('folder_id')->nullable();
            $table->string('folder_type')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_key_folder')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index('created_by', 'investigation_folders_created_by_foreign');
            $table->index(['investigation_id', 'folder_id'], 'investigation_folders_investigation_id_folder_id_index');
            $table->index(['investigation_id', 'folder_type'], 'investigation_folders_investigation_id_folder_type_index');
            $table->index(['investigation_id', 'is_key_folder'], 'investigation_folders_investigation_id_is_key_folder_index');
            $table->index('folder_id', 'investigation_folders_folder_id_foreign');
            $table->index('deleted_by', 'investigation_folders_deleted_by_foreign');
            $table->index('updated_by', 'investigation_folders_updated_by_foreign');
            $table->index('deleted', 'investigation_folders_deleted_index');
            // Cross-module FK skipped: investigation_folders_deleted_by_foreign -> identity_users.record_id
            // Cross-module FK skipped: investigation_folders_folder_id_foreign -> folders.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_folders_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigation_nodes', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('entity_type', 64);
            $table->string('entity_id', 36);
            $table->decimal('x', 10, 2)->default(0.00);
            $table->decimal('y', 10, 2)->default(0.00);
            $table->decimal('width', 10, 2)->default(200.00);
            $table->decimal('height', 10, 2)->default(100.00);
            $table->integer('z_index')->default(0);
            $table->json('style')->nullable();
            $table->string('label_override')->nullable();
            $table->text('notes')->nullable();
            $table->json('tags')->nullable();
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_collapsed')->default(false);
            $table->string('partition_id', 36);
            $table->boolean('deleted')->default(false);
            $table->string('deleted_by', 36)->nullable();
            $table->timestamps();
            $table->unique(['investigation_id', 'entity_type', 'entity_id'], 'inv_nodes_unique');
            $table->index('investigation_id', 'investigation_nodes_investigation_id_index');
            $table->index('partition_id', 'investigation_nodes_partition_id_index');
            $table->index(['entity_type', 'entity_id'], 'investigation_nodes_entity_type_entity_id_index');
            $table->index('deleted', 'investigation_nodes_deleted_index');
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_nodes_partition_id_foreign -> identity_partitions.record_id
        });

        Schema::create('investigation_notes', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('note_id')->nullable();
            $table->string('note_type')->nullable();
            $table->text('summary')->nullable();
            $table->boolean('is_key_note')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index('created_by', 'investigation_notes_created_by_foreign');
            $table->index(['investigation_id', 'note_id'], 'investigation_notes_investigation_id_note_id_index');
            $table->index(['investigation_id', 'note_type'], 'investigation_notes_investigation_id_note_type_index');
            $table->index(['investigation_id', 'is_key_note'], 'investigation_notes_investigation_id_is_key_note_index');
            $table->index('note_id', 'investigation_notes_note_id_foreign');
            $table->index('deleted_by', 'investigation_notes_deleted_by_foreign');
            $table->index('updated_by', 'investigation_notes_updated_by_foreign');
            $table->index('deleted', 'investigation_notes_deleted_index');
            // Cross-module FK skipped: investigation_notes_deleted_by_foreign -> identity_users.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_notes_note_id_foreign -> notes.record_id
            // Cross-module FK skipped: investigation_notes_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigation_people', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('person_id')->nullable();
            $table->string('role');
            $table->string('relationship')->nullable();
            $table->text('statement')->nullable();
            $table->boolean('is_key_person')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index('created_by', 'investigation_people_created_by_foreign');
            $table->index(['investigation_id', 'role'], 'investigation_people_investigation_id_role_index');
            $table->index(['investigation_id', 'person_id'], 'investigation_people_investigation_id_person_id_index');
            $table->index(['investigation_id', 'is_key_person'], 'investigation_people_investigation_id_is_key_person_index');
            $table->index('person_id', 'idx_investigation_people_person');
            $table->index('deleted_by', 'investigation_people_deleted_by_foreign');
            $table->index('updated_by', 'investigation_people_updated_by_foreign');
            $table->index('deleted', 'investigation_people_deleted_index');
            // Cross-module FK skipped: investigation_people_deleted_by_foreign -> identity_users.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_people_person_id_foreign -> people.record_id
            // Cross-module FK skipped: investigation_people_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigation_tags', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('tag_id')->nullable();
            $table->string('tag_context')->nullable();
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index('created_by', 'investigation_tags_created_by_foreign');
            $table->index(['investigation_id', 'tag_id'], 'investigation_tags_investigation_id_tag_id_index');
            $table->index(['investigation_id', 'tag_context'], 'investigation_tags_investigation_id_tag_context_index');
            $table->index('tag_id', 'idx_investigation_tags_tag');
            $table->index('deleted_by', 'investigation_tags_deleted_by_foreign');
            $table->index('updated_by', 'investigation_tags_updated_by_foreign');
            $table->index('deleted', 'investigation_tags_deleted_index');
            // Cross-module FK skipped: investigation_tags_deleted_by_foreign -> identity_users.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_tags_tag_id_foreign -> tags.record_id
            // Cross-module FK skipped: investigation_tags_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigation_tasks', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('investigation_id', 36);
            $table->string('task_id')->nullable();
            $table->string('task_type')->nullable();
            $table->text('context')->nullable();
            $table->boolean('is_key_task')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->index('created_by', 'investigation_tasks_created_by_foreign');
            $table->index(['investigation_id', 'task_id'], 'investigation_tasks_investigation_id_task_id_index');
            $table->index(['investigation_id', 'task_type'], 'investigation_tasks_investigation_id_task_type_index');
            $table->index(['investigation_id', 'is_key_task'], 'investigation_tasks_investigation_id_is_key_task_index');
            $table->index('task_id', 'investigation_tasks_task_id_foreign');
            $table->index('deleted_by', 'investigation_tasks_deleted_by_foreign');
            $table->index('updated_by', 'investigation_tasks_updated_by_foreign');
            $table->index('deleted', 'investigation_tasks_deleted_index');
            // Cross-module FK skipped: investigation_tasks_deleted_by_foreign -> identity_users.record_id
            $table->foreign('investigation_id')->references('record_id')->on('investigations');
            // Cross-module FK skipped: investigation_tasks_task_id_foreign -> tasks.record_id
            // Cross-module FK skipped: investigation_tasks_updated_by_foreign -> identity_users.record_id
        });

        Schema::create('investigations', function (Blueprint $table) {
            $table->string('record_id', 36)->primary();
            $table->string('title');
            $table->string('case_number');
            $table->text('description')->nullable();
            $table->string('status')->default('open');
            $table->string('priority')->default('medium');
            $table->json('canvas_state')->nullable();
            $table->string('default_layout', 20)->default('freeform');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->date('due_date')->nullable();
            $table->string('lead_investigator_id')->nullable();
            $table->string('lead_investigator_name')->nullable();
            $table->string('case_type')->nullable();
            $table->string('jurisdiction')->nullable();
            $table->string('location')->nullable();
            $table->string('agency')->nullable();
            $table->boolean('is_confidential')->default(false);
            $table->boolean('is_sensitive')->default(false);
            $table->string('access_level')->default('internal');
            $table->string('tags')->nullable();
            $table->string('related_cases')->nullable();
            $table->unsignedInteger('evidence_count')->default(0);
            $table->unsignedInteger('witness_count')->default(0);
            $table->unsignedInteger('suspect_count')->default(0);
            $table->unsignedInteger('victim_count')->default(0);
            $table->unsignedInteger('document_count')->default(0);
            $table->unsignedInteger('note_count')->default(0);
            $table->unsignedInteger('task_count')->default(0);
            $table->string('partition_id', 36);
            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            $table->unique('case_number', 'investigations_case_number_unique');
            $table->index(['partition_id', 'case_number'], 'investigations_partition_id_case_number_index');
            $table->index(['partition_id', 'status'], 'investigations_partition_id_status_index');
            $table->index(['partition_id', 'priority'], 'investigations_partition_id_priority_index');
            $table->index(['partition_id', 'case_type'], 'investigations_partition_id_case_type_index');
            $table->index(['partition_id', 'jurisdiction'], 'investigations_partition_id_jurisdiction_index');
            $table->index(['partition_id', 'agency'], 'investigations_partition_id_agency_index');
            $table->index(['partition_id', 'is_confidential'], 'investigations_partition_id_is_confidential_index');
            $table->index(['partition_id', 'is_sensitive'], 'investigations_partition_id_is_sensitive_index');
            $table->index(['partition_id', 'access_level'], 'investigations_partition_id_access_level_index');
            $table->index('deleted_by', 'investigations_deleted_by_foreign');
            $table->index('deleted', 'investigations_deleted_index');
            $table->index('created_by', 'investigations_created_by_foreign');
            $table->index('updated_by', 'investigations_updated_by_foreign');
            $table->index('lead_investigator_id', 'investigations_lead_investigator_id_foreign');
            // Cross-module FK skipped: investigations_created_by_foreign -> identity_users.record_id
            // Cross-module FK skipped: investigations_deleted_by_foreign -> identity_users.record_id
            // Cross-module FK skipped: investigations_lead_investigator_id_foreign -> identity_users.record_id
            // Cross-module FK skipped: investigations_partition_id_foreign -> identity_partitions.record_id
            // Cross-module FK skipped: investigations_updated_by_foreign -> identity_users.record_id
        });

        // Archive table
        Schema::create('investigation_connections_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('from_node_id', 36);
            $table->string('to_node_id', 36);
            $table->string('from_side', 16);
            $table->string('to_side', 16);
            $table->string('style');
            $table->string('path_type');
            $table->string('color', 7);
            $table->decimal('thickness', 3, 1)->default(2.0);
            $table->string('arrow_type');
            $table->string('relationship_type', 64)->nullable();
            $table->string('relationship_label')->nullable();
            $table->string('sentiment');
            $table->integer('weight')->default(5);
            $table->text('notes')->nullable();
            $table->string('partition_id', 36);
            $table->boolean('deleted')->default(false);
            $table->string('deleted_by', 36)->nullable();
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index(['partition_id', 'original_record_id'], 'idx_investigation_connections_archive_partition_record');
            $table->index('archived_at', 'idx_investigation_connections_archive_archived_at');
            $table->index('original_record_id', 'investigation_connections_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_drawings_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('tool', 32);
            $table->json('points');
            $table->string('color', 7);
            $table->decimal('size', 5, 1)->default(2.0);
            $table->string('line_style')->nullable();
            $table->decimal('thickness', 3, 1)->nullable();
            $table->string('arrow_type')->nullable();
            $table->string('text', 500)->nullable();
            $table->integer('z_index')->default(0);
            $table->string('partition_id', 36);
            $table->boolean('deleted')->default(false);
            $table->string('deleted_by', 36)->nullable();
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index(['partition_id', 'original_record_id'], 'idx_investigation_drawings_archive_partition_record');
            $table->index('archived_at', 'idx_investigation_drawings_archive_archived_at');
            $table->index('original_record_id', 'investigation_drawings_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_entities_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('entity_id')->nullable();
            $table->string('role');
            $table->string('relationship')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_key_entity')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_entities_archive_archived_at');
            $table->index('original_record_id', 'investigation_entities_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_events_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('event_id')->nullable();
            $table->string('role')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_key_event')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_events_archive_archived_at');
            $table->index('original_record_id', 'investigation_events_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_evidence_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('title');
            $table->string('evidence_type');
            $table->text('description');
            $table->string('source')->nullable();
            $table->date('date_collected')->nullable();
            $table->string('collected_by')->nullable();
            $table->integer('chain_position')->default(1);
            $table->string('verification_status');
            $table->text('notes')->nullable();
            $table->string('related_people')->nullable();
            $table->string('related_events')->nullable();
            $table->string('files')->nullable();
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_evidence_archive_archived_at');
            $table->index('original_record_id', 'investigation_evidence_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_files_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('file_id')->nullable();
            $table->string('file_type')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_key_file')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_files_archive_archived_at');
            $table->index('original_record_id', 'investigation_files_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_folders_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('folder_id')->nullable();
            $table->string('folder_type')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_key_folder')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_folders_archive_archived_at');
            $table->index('original_record_id', 'investigation_folders_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_nodes_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('entity_type', 64);
            $table->string('entity_id', 36);
            $table->decimal('x', 10, 2)->default(0.00);
            $table->decimal('y', 10, 2)->default(0.00);
            $table->decimal('width', 10, 2)->default(200.00);
            $table->decimal('height', 10, 2)->default(100.00);
            $table->integer('z_index')->default(0);
            $table->json('style')->nullable();
            $table->string('label_override')->nullable();
            $table->text('notes')->nullable();
            $table->json('tags')->nullable();
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_collapsed')->default(false);
            $table->string('partition_id', 36);
            $table->boolean('deleted')->default(false);
            $table->string('deleted_by', 36)->nullable();
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index(['partition_id', 'original_record_id'], 'idx_investigation_nodes_archive_partition_record');
            $table->index('archived_at', 'idx_investigation_nodes_archive_archived_at');
            $table->index('original_record_id', 'investigation_nodes_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_notes_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('note_id')->nullable();
            $table->string('note_type')->nullable();
            $table->text('summary')->nullable();
            $table->boolean('is_key_note')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_notes_archive_archived_at');
            $table->index('original_record_id', 'investigation_notes_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_people_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('person_id')->nullable();
            $table->string('role');
            $table->string('relationship')->nullable();
            $table->text('statement')->nullable();
            $table->boolean('is_key_person')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_people_archive_archived_at');
            $table->index('original_record_id', 'investigation_people_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_tags_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('tag_id')->nullable();
            $table->string('tag_context')->nullable();
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_tags_archive_archived_at');
            $table->index('original_record_id', 'investigation_tags_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigation_tasks_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('investigation_id', 36);
            $table->string('task_id')->nullable();
            $table->string('task_type')->nullable();
            $table->text('context')->nullable();
            $table->boolean('is_key_task')->default(false);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index('archived_at', 'idx_investigation_tasks_archive_archived_at');
            $table->index('original_record_id', 'investigation_tasks_archive_original_record_id_index');
        });

        // Archive table
        Schema::create('investigations_archive', function (Blueprint $table) {
            $table->bigIncrements('archive_id');
            $table->string('original_record_id', 36);
            $table->string('title');
            $table->string('case_number');
            $table->text('description')->nullable();
            $table->string('status');
            $table->string('priority');
            $table->json('canvas_state')->nullable();
            $table->string('default_layout', 20);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->date('due_date')->nullable();
            $table->string('lead_investigator_id')->nullable();
            $table->string('lead_investigator_name')->nullable();
            $table->string('case_type')->nullable();
            $table->string('jurisdiction')->nullable();
            $table->string('location')->nullable();
            $table->string('agency')->nullable();
            $table->boolean('is_confidential')->default(false);
            $table->boolean('is_sensitive')->default(false);
            $table->string('access_level');
            $table->string('tags')->nullable();
            $table->string('related_cases')->nullable();
            $table->unsignedInteger('evidence_count')->default(0);
            $table->unsignedInteger('witness_count')->default(0);
            $table->unsignedInteger('suspect_count')->default(0);
            $table->unsignedInteger('victim_count')->default(0);
            $table->unsignedInteger('document_count')->default(0);
            $table->unsignedInteger('note_count')->default(0);
            $table->unsignedInteger('task_count')->default(0);
            $table->string('partition_id', 36);
            $table->string('created_by', 36);
            $table->string('updated_by', 36)->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamp('deleted_at')->nullable();
            $table->string('deleted_by', 36)->nullable();
            $table->boolean('deleted')->default(false);
            $table->timestamp('archived_at')->useCurrent();
            $table->string('archived_by', 64)->default('system-archive-daemon');
            $table->timestamps();
            $table->index(['partition_id', 'original_record_id'], 'idx_investigations_archive_partition_record');
            $table->index('archived_at', 'idx_investigations_archive_archived_at');
            $table->index('original_record_id', 'investigations_archive_original_record_id_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('investigations_archive');
        Schema::dropIfExists('investigation_tasks_archive');
        Schema::dropIfExists('investigation_tags_archive');
        Schema::dropIfExists('investigation_people_archive');
        Schema::dropIfExists('investigation_notes_archive');
        Schema::dropIfExists('investigation_nodes_archive');
        Schema::dropIfExists('investigation_folders_archive');
        Schema::dropIfExists('investigation_files_archive');
        Schema::dropIfExists('investigation_evidence_archive');
        Schema::dropIfExists('investigation_events_archive');
        Schema::dropIfExists('investigation_entities_archive');
        Schema::dropIfExists('investigation_drawings_archive');
        Schema::dropIfExists('investigation_connections_archive');
        Schema::dropIfExists('investigations');
        Schema::dropIfExists('investigation_tasks');
        Schema::dropIfExists('investigation_tags');
        Schema::dropIfExists('investigation_people');
        Schema::dropIfExists('investigation_notes');
        Schema::dropIfExists('investigation_nodes');
        Schema::dropIfExists('investigation_folders');
        Schema::dropIfExists('investigation_files');
        Schema::dropIfExists('investigation_evidence');
        Schema::dropIfExists('investigation_events');
        Schema::dropIfExists('investigation_entities');
        Schema::dropIfExists('investigation_drawings');
        Schema::dropIfExists('investigation_connections');
        Schema::enableForeignKeyConstraints();
    }
};
