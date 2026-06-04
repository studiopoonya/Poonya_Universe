<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Package;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Str;

class PackageController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Package::orderBy('sort_order')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'         => ['required', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'duration_min' => ['required', 'integer', 'min:15'],
            'price'        => ['required', 'integer', 'min:0'],
            'features'     => ['nullable', 'array'],
            'is_active'    => ['boolean'],
            'sort_order'   => ['integer'],
        ]);

        $data['slug'] = Str::slug($data['name']);
        $package = Package::create($data);

        return response()->json($package, 201);
    }

    public function update(Request $request, Package $package): JsonResponse
    {
        $data = $request->validate([
            'name'         => ['sometimes', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'duration_min' => ['sometimes', 'integer', 'min:15'],
            'price'        => ['sometimes', 'integer', 'min:0'],
            'features'     => ['nullable', 'array'],
            'is_active'    => ['boolean'],
            'sort_order'   => ['integer'],
        ]);

        if (isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        $package->update($data);

        return response()->json($package);
    }

    public function destroy(Package $package): JsonResponse
    {
        abort_if($package->bookings()->exists(), 422, 'Cannot delete a package with existing bookings.');
        $package->delete();

        return response()->json(['message' => 'Package dihapus.']);
    }
}
