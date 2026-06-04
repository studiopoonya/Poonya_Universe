<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // open to guests and authenticated users
    }

    public function rules(): array
    {
        return [
            'studio_id'      => ['required', 'integer', 'exists:studios,id'],
            'slot_id'        => ['required', 'integer', 'exists:slots,id'],
            'customer_name'  => ['required', 'string', 'max:255'],
            'customer_email' => ['required', 'email:rfc', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'notes'          => ['nullable', 'string', 'max:1000'],
        ];
    }
}
