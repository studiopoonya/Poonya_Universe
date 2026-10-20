<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'booking_id', 'gateway', 'gateway_ref', 'method',
        'amount', 'cash_received', 'cash_change', 'currency', 'status', 'gateway_payload', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'amount'          => 'integer',
            'cash_received'   => 'integer',
            'cash_change'     => 'integer',
            'gateway_payload' => 'array',
            'paid_at'         => 'datetime',
        ];
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}
