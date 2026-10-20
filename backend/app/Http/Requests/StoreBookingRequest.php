<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    /** 8–15 digits, optional leading + (after spaces/dashes/dots are stripped). */
    public const PHONE_RULE = 'regex:/^\+?[0-9]{8,15}$/';

    /** rfc + PHP's filter: rejects addresses with no domain dot like "budi@gmail". */
    public const EMAIL_RULE = 'email:rfc,filter';

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // open to guests and authenticated users
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'customer_phone' => self::normalizePhone($this->input('customer_phone')),
            'customer_email' => is_string($this->input('customer_email')) ? trim($this->input('customer_email')) : $this->input('customer_email'),
        ]);
    }

    public static function normalizePhone(mixed $phone): mixed
    {
        return is_string($phone) ? preg_replace('/[\s\-.()]/', '', $phone) : $phone;
    }

    public function rules(): array
    {
        return [
            'studio_id'      => ['required', 'integer', 'exists:studios,id'],
            'slot_id'        => ['required', 'integer', 'exists:slots,id'],
            'customer_name'  => ['required', 'string', 'max:255'],
            'customer_email' => ['required', self::EMAIL_RULE, 'max:255'],
            'customer_phone' => ['required', 'string', self::PHONE_RULE],
            'notes'          => ['nullable', 'string', 'max:1000'],
            'promo_code'     => ['nullable', 'string', 'max:32'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_phone.regex' => 'Nomor HP tidak valid. Gunakan 8–15 angka, contoh 081234567890.',
        ];
    }
}
