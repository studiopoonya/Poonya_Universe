<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class PackageSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $packages = [
            [
                'name'         => 'Solo Starter',
                'slug'         => 'solo-starter',
                'description'  => 'Perfect for individuals who want a quick, clean photo session.',
                'duration_min' => 30,
                'price'        => 75000,
                'features'     => ['30 menit sesi', '1 backdrop pilihan', '5 foto edited', 'Akses booth studio'],
                'sort_order'   => 1,
            ],
            [
                'name'         => 'Solo Classic',
                'slug'         => 'solo-classic',
                'description'  => 'Our most popular package for solo sessions.',
                'duration_min' => 60,
                'price'        => 150000,
                'features'     => ['60 menit sesi', '2 backdrop pilihan', '15 foto edited', 'Akses booth studio', 'Soft copy via Google Drive'],
                'sort_order'   => 2,
            ],
            [
                'name'         => 'Couple / Duo',
                'slug'         => 'couple-duo',
                'description'  => 'Great for couples or two friends capturing memories together.',
                'duration_min' => 60,
                'price'        => 200000,
                'features'     => ['60 menit sesi', '3 backdrop pilihan', '20 foto edited', 'Akses booth studio', 'Soft copy via Google Drive', 'Free 1 cetak 4R'],
                'sort_order'   => 3,
            ],
            [
                'name'         => 'Premium Studio',
                'slug'         => 'premium-studio',
                'description'  => 'Full creative control with the longest session and most deliverables.',
                'duration_min' => 90,
                'price'        => 350000,
                'features'     => ['90 menit sesi', 'Semua backdrop', '40 foto edited', 'Akses booth studio', 'Soft copy via Google Drive', 'Free 3 cetak 4R', 'Mini photobook'],
                'sort_order'   => 4,
            ],
        ];

        foreach ($packages as $pkg) {
            \App\Models\Package::updateOrCreate(['slug' => $pkg['slug']], $pkg);
        }
    }
}
