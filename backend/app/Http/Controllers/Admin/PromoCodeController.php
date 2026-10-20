<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PromoCode;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Validation\Rule;

class PromoCodeController extends Controller
{
    public function index(): JsonResponse
    {
        $promos = PromoCode::latest()->get()->map(fn (PromoCode $p) => [
            ...$p->toArray(),
            'used_count' => $p->usedCount(),
            'label'      => $p->label(),
        ]);

        return response()->json($promos);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(PromoCode::create($this->validated($request)), 201);
    }

    public function update(Request $request, PromoCode $promoCode): JsonResponse
    {
        $promoCode->update($this->validated($request, $promoCode));

        return response()->json($promoCode->fresh());
    }

    public function destroy(PromoCode $promoCode): JsonResponse
    {
        // Bookings keep their discount amount; the link to the code is nulled by the FK
        $promoCode->delete();

        return response()->json(['message' => 'Kode promo dihapus.']);
    }

    private function validated(Request $request, ?PromoCode $existing = null): array
    {
        $request->merge(['code' => strtoupper(trim((string) $request->input('code')))]);

        return $request->validate([
            'code'      => ['required', 'string', 'max:32', 'regex:/^[A-Z0-9_-]+$/', Rule::unique('promo_codes', 'code')->ignore($existing?->id)],
            'type'      => ['required', 'in:percent,fixed'],
            'value'     => ['required', 'integer', 'min:1', $request->input('type') === 'percent' ? 'max:100' : 'max:100000000'],
            'max_uses'  => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at'   => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['boolean'],
        ], [
            'code.regex' => 'Kode promo hanya boleh huruf, angka, - dan _.',
        ]);
    }
}
