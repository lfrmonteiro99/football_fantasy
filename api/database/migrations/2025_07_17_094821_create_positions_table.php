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
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // e.g., "Goalkeeper", "Centre-Back", "Striker"
            $table->string('short_name', 3); // e.g., "GK", "CB", "ST"
            $table->enum('category', ['goalkeeper', 'defender', 'midfielder', 'forward']);
            $table->json('key_attributes'); // JSON array of important attributes for this position
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('positions');
    }
};
