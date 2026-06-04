<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Studio extends Model
{
    protected $fillable = [
        'name', 'slug', 'description', 'price', 'capacity',
        'features', 'thumbnail_url', 'color', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'features'  => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function slots()
    {
        return $this->hasMany(Slot::class);
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
