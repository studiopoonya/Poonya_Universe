<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentTest extends Model
{
    public const PREFIX = 'TEST-';

    protected $fillable = ['order_id', 'provider', 'amount', 'status', 'method', 'gateway_payload', 'paid_at', 'created_by'];

    protected function casts(): array
    {
        return [
            'amount'          => 'integer',
            'gateway_payload' => 'array',
            'paid_at'         => 'datetime',
        ];
    }

    /** Apply a gateway outcome (paid | failed | pending); a paid test never goes back. */
    public function record(string $outcome, ?string $method, array $payload): void
    {
        if ($this->status === 'paid' || $outcome === 'pending') {
            $this->update(['method' => $method ?: $this->method, 'gateway_payload' => $payload]);
            return;
        }

        $this->update([
            'status'          => $outcome,
            'method'          => $method ?: $this->method,
            'gateway_payload' => $payload,
            'paid_at'         => $outcome === 'paid' ? now() : null,
        ]);
    }
}
