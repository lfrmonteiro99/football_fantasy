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
        Schema::create('match_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_id')->constrained('matches');
            $table->integer('minute');
            $table->string('event_type');
            $table->string('team_type'); // 'home' or 'away'
            $table->string('player_name');
            $table->text('description');
            $table->integer('x_coordinate');
            $table->integer('y_coordinate');
            $table->text('commentary')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('match_events');
    }
};
 