<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    protected $fillable = [
        'user_id', 'studio_id', 'slot_id', 'order_id', 'status',
        'customer_name', 'customer_email', 'customer_phone',
        'notes', 'expires_at', 'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at'   => 'datetime',
            'confirmed_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function studio()
    {
        return $this->belongsTo(Studio::class);
    }

    public function slot()
    {
        return $this->belongsTo(Slot::class);
    }

    public function payment()
    {
        return $this->hasOne(Payment::class);
    }
}
