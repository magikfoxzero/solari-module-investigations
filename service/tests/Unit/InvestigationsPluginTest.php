<?php

namespace Tests\Unit;

use NewSolari\Identity\Models\IdentityPartition;
use NewSolari\Identity\Models\IdentityUser;
use NewSolari\Investigations\InvestigationsPlugin;
use NewSolari\Investigations\Models\Investigation;
use NewSolari\Investigations\Models\InvestigationNode;
use NewSolari\Investigations\Models\InvestigationConnection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestigationsPluginTest extends TestCase
{
    use RefreshDatabase;

    protected $plugin;
    protected $partition;
    protected $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->plugin = new InvestigationsPlugin();

        $this->partition = IdentityPartition::create([
            'record_id' => 'plugin-test-partition',
            'name' => 'Plugin Test Partition',
            'description' => 'Test partition for investigations plugin tests',
        ]);

        $this->user = IdentityUser::create([
            'record_id' => 'plugin-test-user',
            'username' => 'plugintestuser',
            'email' => 'plugintest@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);
        $this->user->setSystemUser(true);
    }

    /** @test */
    public function it_has_correct_plugin_metadata()
    {
        $this->assertEquals('investigations-meta-app', $this->plugin->getId());
        $this->assertEquals('Investigations', $this->plugin->getName());
        $this->assertNotEmpty($this->plugin->getDescription());
    }

    /** @test */
    public function it_returns_correct_container_model()
    {
        $model = $this->plugin->getContainerModel();
        $this->assertEquals(Investigation::class, $model);
    }

    /** @test */
    public function it_has_validation_rules()
    {
        $rules = $this->plugin->getValidationRules();
        $this->assertIsArray($rules);
        $this->assertArrayHasKey('title', $rules);
        $this->assertArrayHasKey('status', $rules);
        $this->assertArrayHasKey('priority', $rules);
    }

    /** @test */
    public function it_has_linkable_entity_types()
    {
        $types = $this->plugin->getLinkableEntityTypes();

        $this->assertIsArray($types);
        $this->assertContains('person', $types);
        $this->assertContains('entity', $types);
        $this->assertContains('place', $types);
        $this->assertContains('event', $types);
        $this->assertContains('note', $types);
        $this->assertContains('task', $types);
        $this->assertContains('file', $types);
        $this->assertContains('hypothesis', $types);
        $this->assertContains('motive', $types);
        $this->assertContains('inventory_object', $types);
        $this->assertContains('tag', $types);
        $this->assertNotContains('blocknote', $types); // blocknote excluded from investigations
    }

    /** @test */
    public function it_has_timeline_date_fields()
    {
        $fields = $this->plugin->getTimelineDateFields();

        $this->assertIsArray($fields);
        $this->assertArrayHasKey('person', $fields);
        $this->assertArrayHasKey('event', $fields);
        $this->assertArrayHasKey('task', $fields);
    }

    /** @test */
    public function it_has_entity_visual_configs()
    {
        $configs = $this->plugin->getEntityVisualConfig();

        $this->assertIsArray($configs);
        $this->assertArrayHasKey('person', $configs);

        $personConfig = $configs['person'];
        $this->assertArrayHasKey('icon', $personConfig);
        $this->assertArrayHasKey('color', $personConfig);
        $this->assertArrayHasKey('backgroundColor', $personConfig);
    }

    /** @test */
    public function it_has_correct_permission_prefix()
    {
        $this->assertEquals('investigations', $this->plugin->getPermissionPrefix());
    }

    /** @test */
    public function it_generates_correct_permission_names()
    {
        $this->assertEquals('investigations.create', $this->plugin->getPermissionName('create'));
        $this->assertEquals('investigations.read', $this->plugin->getPermissionName('read'));
        $this->assertEquals('investigations.update', $this->plugin->getPermissionName('update'));
        $this->assertEquals('investigations.delete', $this->plugin->getPermissionName('delete'));
        $this->assertEquals('investigations.manage', $this->plugin->getPermissionName('manage'));
    }

    /** @test */
    public function it_can_create_an_investigation()
    {
        $data = [
            'record_id' => (string) \Str::uuid(),
            'title' => 'Test Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'description' => 'A test investigation created via plugin',
            'status' => Investigation::STATUS_OPEN,
            'priority' => Investigation::PRIORITY_HIGH,
            'is_public' => false,
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ];

        $investigation = $this->plugin->createContainerItem($data, $this->user);

        $this->assertInstanceOf(Investigation::class, $investigation);
        $this->assertEquals('Test Investigation', $investigation->title);
        $this->assertEquals(Investigation::STATUS_OPEN, $investigation->status);
    }

    /** @test */
    public function it_validates_required_fields()
    {
        $this->expectException(\Exception::class);

        $invalidData = [
            'record_id' => (string) \Str::uuid(),
            'description' => 'Missing title',
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
        ];

        $this->plugin->createContainerItem($invalidData, $this->user);
    }

    /** @test */
    public function it_can_get_investigations_query()
    {
        Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Query Test Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        $query = $this->plugin->getInvestigationsQuery($this->user);
        $this->assertInstanceOf(\Illuminate\Database\Eloquent\Builder::class, $query);

        $results = $query->get();
        $this->assertGreaterThanOrEqual(1, $results->count());
    }

    /** @test */
    public function it_can_get_statistics()
    {
        // Create some investigations
        Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Open Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'status' => Investigation::STATUS_OPEN,
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Closed Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'status' => Investigation::STATUS_CLOSED,
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        $stats = $this->plugin->getStatistics($this->user);

        $this->assertIsArray($stats);
        $this->assertArrayHasKey('total_investigations', $stats);
        $this->assertArrayHasKey('open_investigations', $stats);
        $this->assertArrayHasKey('closed_investigations', $stats);
        $this->assertArrayHasKey('total_nodes', $stats);
        $this->assertArrayHasKey('total_connections', $stats);

        $this->assertGreaterThanOrEqual(2, $stats['total_investigations']);
        $this->assertGreaterThanOrEqual(1, $stats['open_investigations']);
    }

    /** @test */
    public function it_has_node_validation_rules()
    {
        $rules = $this->plugin->getNodeValidationRules();

        $this->assertIsArray($rules);
        $this->assertArrayHasKey('investigation_id', $rules);
        $this->assertArrayHasKey('entity_type', $rules);
        $this->assertArrayHasKey('entity_id', $rules);
        $this->assertArrayHasKey('x', $rules);
        $this->assertArrayHasKey('y', $rules);
    }

    /** @test */
    public function it_has_connection_validation_rules()
    {
        $rules = $this->plugin->getConnectionValidationRules();

        $this->assertIsArray($rules);
        $this->assertArrayHasKey('investigation_id', $rules);
        $this->assertArrayHasKey('from_node_id', $rules);
        $this->assertArrayHasKey('to_node_id', $rules);
    }

    /** @test */
    public function it_has_canvas_state_validation_rules()
    {
        $rules = $this->plugin->getCanvasStateValidationRules();

        $this->assertIsArray($rules);
        $this->assertArrayHasKey('zoom', $rules);
        $this->assertArrayHasKey('panX', $rules);
        $this->assertArrayHasKey('panY', $rules);
    }

    /** @test */
    public function it_can_check_data_access_for_owner()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Owner Access Test', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        $hasAccess = $this->plugin->checkDataAccess($investigation, $this->user, 'read');
        $this->assertTrue($hasAccess);
    }

    /** @test */
    public function it_can_check_data_access_for_public_records()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Public Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => true,
        ]);

        // Create another user in the same partition
        $otherUser = IdentityUser::create([
            'record_id' => 'plugin-test-user-2',
            'username' => 'plugintestuser2',
            'email' => 'plugintest2@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $hasAccess = $this->plugin->checkDataAccess($investigation, $otherUser, 'read');
        $this->assertTrue($hasAccess);
    }

    /** @test */
    public function it_denies_access_to_private_records_for_other_users()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Private Investigation', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        // Create another user in the same partition (non-admin)
        $otherUser = IdentityUser::create([
            'record_id' => 'plugin-test-user-3',
            'username' => 'plugintestuser3',
            'email' => 'plugintest3@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $hasAccess = $this->plugin->checkDataAccess($investigation, $otherUser, 'read');
        $this->assertFalse($hasAccess);
    }

    /** @test */
    public function it_grants_access_to_system_users()
    {
        // Create a different user to own the investigation
        $otherUser = IdentityUser::create([
            'record_id' => 'plugin-test-user-owner',
            'username' => 'plugintestuserowner',
            'email' => 'plugintestowner@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'System User Test', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $otherUser->record_id,
            'is_public' => false,
        ]);

        // The user is a system user and should have access even though they don't own it
        $hasAccess = $this->plugin->checkDataAccess($investigation, $this->user, 'read');
        $this->assertTrue($hasAccess);
    }

    /** @test */
    public function owner_can_change_privacy()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Privacy Test', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        $canChange = $this->plugin->canUserChangePrivacy($investigation, $this->user);
        $this->assertTrue($canChange);
    }

    /** @test */
    public function non_owner_cannot_change_privacy()
    {
        $investigation = Investigation::create([
            'record_id' => (string) \Str::uuid(),
            'title' => 'Privacy Test 2', 'case_number' => 'CASE-' . \Str::random(8),
            'partition_id' => $this->partition->record_id,
            'created_by' => $this->user->record_id,
            'is_public' => false,
        ]);

        $otherUser = IdentityUser::create([
            'record_id' => 'plugin-test-user-4',
            'username' => 'plugintestuser4',
            'email' => 'plugintest4@example.com',
            'password_hash' => 'password',
            'partition_id' => $this->partition->record_id,
            'is_active' => true,
        ]);

        $canChange = $this->plugin->canUserChangePrivacy($investigation, $otherUser);
        $this->assertFalse($canChange);
    }
}
