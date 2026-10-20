<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PromoCode extends Model
{
    protected $fillable = ['code', 'type', 'value', 'max_uses', 'starts_at', 'ends_at', 'is_active'];

    protected function casts(): array
    {
        return [
            'value'     => 'integer',
            'max_uses'  => 'integer',
            'starts_at' => 'date:Y-m-d',
            'ends_at'   => 'date:Y-m-d',
            'is_active' => 'boolean',
        ];
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    /** Uses = bookings holding the code that are still alive (pending or confirmed). */
    public function usedCount(): int
    {
        return $this->bookings()->whereIn('status', ['pending', 'confirmed'])->count();
    }

    /** Why the code can't be used right now, or null when it can. */
    public function unusableReason(): ?string
    {
        $today = now()->startOfDay();

        return match (true) {
            ! $this->is_active                                        => 'Kode promo sudah tidak aktif.',
            $this->starts_at && $today->lt($this->starts_at)          => 'Kode promo belum berlaku.',
            $this->ends_at && $today->gt($this->ends_at)              => 'Kode promo sudah kedaluwarsa.',
            $this->max_uses !== null && $this->usedCount() >= $this->max_uses => 'Kuota kode promo sudah habis.',
            default                                                    => null,
        };
    }

    public function discountFor(int $price): int
    {
        $discount = $this->type === 'percent'
            ? intdiv($price * min($this->value, 100), 100)
            : $this->value;

        return min($discount, $price);
    }

    public function label(): string
    {
        return $this->type === 'percent'
            ? "Diskon {$this->value}%"
            : 'Potongan Rp ' . number_format($this->value, 0, ',', '.');
    }
}
