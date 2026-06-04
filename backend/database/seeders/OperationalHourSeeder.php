<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class OperationalHourSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $hours = [
            ['weekday' => 0, 'open_time' => '10:00:00', 'close_time' => '20:00:00', 'is_open' => false], // Sun
            ['weekday' => 1, 'open_time' => '09:00:00', 'close_time' => '21:00:00', 'is_open' => true],  // Mon
            ['weekday' => 2, 'open_time' => '09:00:00', 'close_time' => '21:00:00', 'is_open' => true],  // Tue
            ['weekday' => 3, 'open_time' => '09:00:00', 'close_time' => '21:00:00', 'is_open' => true],  // Wed
            ['weekday' => 4, 'open_time' => '09:00:00', 'close_time' => '21:00:00', 'is_open' => true],  // Thu
            ['weekday' => 5, 'open_time' => '09:00:00', 'close_time' => '22:00:00', 'is_open' => true],  // Fri
            ['weekday' => 6, 'open_time' => '10:00:00', 'close_time' => '22:00:00', 'is_open' => true],  // Sat
        ];

        foreach ($hours as $h) {
            \App\Models\OperationalHour::updateOrCreate(['weekday' => $h['weekday']], $h);
        }
    }
}
