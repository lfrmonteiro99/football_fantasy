<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('managed_team_id')->nullable()->after('password');
            $table->foreign('managed_team_id')->references('id')->on('teams')->onDelete('set null');
            $table->unique('managed_team_id'); // One manager per team
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['managed_team_id']);
            $table->dropColumn('managed_team_id');
        });
    }
};
