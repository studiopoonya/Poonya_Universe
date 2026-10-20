<?php

namespace App\Console\Commands;

use App\Services\SlotGenerator;
use Illuminate\Console\Command;

class GenerateSlots extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature   = 'slots:generate {days=30 : Number of days ahead to generate}';
    protected $description = 'Pre-generate available time slots based on operational hours.';

    public function handle(): void
    {
        $days = (int) $this->argument('days');

        if (! \App\Models\Studio::where('is_active', true)->exists()) {
            $this->error('No active studios found. Run db:seed first.');
            return;
        }

        $created = SlotGenerator::ahead($days);

        $this->info("Done! Created {$created} new slots for the next {$days} days.");
    }
}
