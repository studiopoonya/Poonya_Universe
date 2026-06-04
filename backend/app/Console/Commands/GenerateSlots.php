<?php

namespace App\Console\Commands;

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
        $slotDuration = 30; // minutes per slot
        $days         = (int) $this->argument('days');
        $studios      = \App\Models\Studio::where('is_active', true)->get();
        $opHours      = \App\Models\OperationalHour::where('is_open', true)->get()->keyBy('weekday');
        $created      = 0;

        if ($studios->isEmpty()) {
            $this->error('No active studios found. Run db:seed first.');
            return;
        }

        foreach ($studios as $studio) {
            for ($i = 0; $i < $days; $i++) {
                $date   = \Carbon\Carbon::today()->addDays($i);
                $opHour = $opHours->get($date->dayOfWeek);

                if (! $opHour) continue;

                $current = \Carbon\Carbon::parse($date->toDateString() . ' ' . $opHour->open_time);
                $closeAt = \Carbon\Carbon::parse($date->toDateString() . ' ' . $opHour->close_time);

                while ($current->copy()->addMinutes($slotDuration)->lte($closeAt)) {
                    \App\Models\Slot::firstOrCreate(
                        [
                            'studio_id'  => $studio->id,
                            'date'       => $date->toDateString(),
                            'start_time' => $current->toTimeString(),
                        ],
                        [
                            'end_time' => $current->copy()->addMinutes($slotDuration)->toTimeString(),
                            'status'   => 'available',
                        ]
                    );
                    $created++;
                    $current->addMinutes($slotDuration);
                }
            }
            $this->line("  Studio [{$studio->name}] done.");
        }

        $this->info("Done! Generated {$created} slots for {$days} days × {$studios->count()} studios.");
    }
}
