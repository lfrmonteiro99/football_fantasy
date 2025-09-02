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
        Schema::table('matches', function (Blueprint $table) {
            $table->foreignId('manager_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->index(['manager_id', 'league_id', 'season_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->dropForeign(['manager_id']);
            $table->dropIndex(['manager_id', 'league_id', 'season_id']);
            $table->dropColumn('manager_id');
        });
    }
};
