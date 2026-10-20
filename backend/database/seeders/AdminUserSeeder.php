<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use RuntimeException;

class AdminUserSeeder extends Seeder
{
    /**
     * First admin account. The password comes from .env (ADMIN_PASSWORD) so it is
     * never committed to the repository.
     */
    public function run(): void
    {
        $email    = env('ADMIN_EMAIL', 'studiopoonya@gmail.com');
        $password = env('ADMIN_PASSWORD');

        if (! $password || strlen($password) < 8) {
            throw new RuntimeException('Set ADMIN_PASSWORD (min. 8 karakter) di .env sebelum menjalankan seeder.');
        }

        \App\Models\User::updateOrCreate(
            ['email' => $email],
            [
                'name'     => 'Poonya Studio',
                'password' => \Illuminate\Support\Facades\Hash::make($password),
                'role'     => 'admin',
            ]
        );
    }
}
