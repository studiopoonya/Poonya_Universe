<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class StudioSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $studios = [
            [
                'name'        => 'Studio A — Minimalist',
                'slug'        => 'studio-a',
                'description' => 'Booth bersih dengan backdrop putih dan abu-abu. Cocok untuk konten profesional, headshot, dan foto formal.',
                'price'       => 75000,
                'capacity'    => 2,
                'features'    => ['Backdrop Putih & Abu', 'Ring Light 60cm', 'Full-length Mirror', 'WiFi Kencang'],
                'color'       => '#4f6ef7',
                'sort_order'  => 1,
            ],
            [
                'name'        => 'Studio B — Aesthetic',
                'slug'        => 'studio-b',
                'description' => 'Booth dengan nuansa hangat, backdrop krem, dan dekorasi minimal. Perfect untuk feed Instagram.',
                'price'       => 85000,
                'capacity'    => 3,
                'features'    => ['Backdrop Krem & Terracotta', 'Softbox Premium', 'Prop Dekorasi', 'Bluetooth Speaker'],
                'color'       => '#f59e0b',
                'sort_order'  => 2,
            ],
            [
                'name'        => 'Studio C — Dark & Moody',
                'slug'        => 'studio-c',
                'description' => 'Booth dengan backdrop gelap dan pencahayaan dramatis. Ideal untuk foto edgy dan fashion.',
                'price'       => 95000,
                'capacity'    => 4,
                'features'    => ['Backdrop Hitam & Navy', 'Lampu LED Colored', 'Smoke Machine', 'Full-length Mirror'],
                'color'       => '#6d28d9',
                'sort_order'  => 3,
            ],
        ];

        foreach ($studios as $data) {
            \App\Models\Studio::updateOrCreate(['slug' => $data['slug']], $data);
        }
    }
}
