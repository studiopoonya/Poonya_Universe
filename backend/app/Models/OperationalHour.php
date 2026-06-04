<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OperationalHour extends Model
{
    protected $fillable = ['weekday', 'open_time', 'close_time', 'is_open'];

    protected function casts(): array
    {
        return ['is_open' => 'boolean'];
    }
}
