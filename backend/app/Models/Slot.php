<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Slot extends Model
{
    protected $fillable = ['studio_id', 'date', 'start_time', 'end_time', 'status', 'locked_until'];

    protected function casts(): array
    {
        return ['locked_until' => 'datetime'];
    }

    public function booking()
    {
        return $this->hasOne(Booking::class);
    }

    /** True once the slot's start time has passed (app timezone, WIB). */
    public function hasStarted(): bool
    {
        return \Carbon\Carbon::parse($this->date . ' ' . $this->start_time)->lte(now());
    }

    public function scopeAvailable($query)
    {
        return $query->where('status', 'available');
    }

    public function scopeForDate($query, string $date)
    {
        return $query->where('date', $date);
    }
}
