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
        Schema::create('leagues', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('country');
            $table->integer('level')->default(1); // 1 = top division, 2 = second division, etc.
            $table->integer('max_teams')->default(20);
            $table->decimal('reputation', 3, 1)->default(5.0); // 1-10 scale
            $table->string('logo')->nullable();
            $table->timestamps();

            // Add indexes
            $table->index('country');
            $table->index('level');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leagues');
    }
};
