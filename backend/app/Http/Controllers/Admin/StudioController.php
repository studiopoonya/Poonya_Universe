<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Studio;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StudioController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Studio::orderBy('sort_order')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['slug'] = Str::slug($data['name']);

        if ($request->hasFile('thumbnail')) {
            $path = $request->file('thumbnail')->store('studios', 'public');
            $data['thumbnail_url'] = Storage::url($path);
        }

        return response()->json(Studio::create($data), 201);
    }

    public function update(Request $request, Studio $studio): JsonResponse
    {
        $data = $this->validated($request, partial: true);
        if (isset($data['name'])) $data['slug'] = Str::slug($data['name']);

        if ($request->hasFile('thumbnail')) {
            $this->deleteThumbnail($studio);
            $path = $request->file('thumbnail')->store('studios', 'public');
            $data['thumbnail_url'] = Storage::url($path);
        }

        $studio->update($data);
        return response()->json($studio->fresh());
    }

    public function destroy(Studio $studio): JsonResponse
    {
        abort_if($studio->bookings()->exists(), 422, 'Tidak dapat menghapus studio yang memiliki booking.');

        $this->deleteThumbnail($studio);

        $studio->delete();
        return response()->json(['message' => 'Studio dihapus.']);
    }

    /** Thumbnails live on the 'public' disk; the URL is /storage/<path>. */
    private function deleteThumbnail(Studio $studio): void
    {
        if (! $studio->thumbnail_url) return;

        $path = ltrim(str_replace('/storage/', '', parse_url($studio->thumbnail_url, PHP_URL_PATH) ?? ''), '/');
        if ($path) Storage::disk('public')->delete($path);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $sometimes = $partial ? 'sometimes|' : '';
        $data = $request->validate([
            'name'        => ["{$sometimes}required", 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'price'       => ["{$sometimes}required", 'integer', 'min:0'],
            'weekend_price' => ['nullable', 'integer', 'min:0'],
            'capacity'    => ['integer', 'min:1'],
            'features'    => ['nullable', 'array'],
            'thumbnail'   => ['nullable', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
            'color'       => ['nullable', 'string', 'max:20'],
            'is_active'   => ['boolean'],
            'sort_order'  => ['integer'],
        ]);

        // The form sends an empty `features` value when every feature was removed
        if (array_key_exists('features', $data)) $data['features'] ??= [];

        return $data;
    }
}
