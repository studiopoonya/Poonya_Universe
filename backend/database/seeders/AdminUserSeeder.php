<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\User::updateOrCreate(
            ['email' => 'admin@selfstudio.id'],
            [
                'name'     => 'Studio Admin',
                'email'    => 'admin@selfstudio.id',
                'password' => \Illuminate\Support\Facades\Hash::make('admin123'),
                'role'     => 'admin',
                'phone'    => '08123456789',
            ]
        );
    }
}
