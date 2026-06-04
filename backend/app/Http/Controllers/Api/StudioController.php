<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Studio;
use Illuminate\Http\JsonResponse;

class StudioController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Studio::active()->get());
    }

    public function show(Studio $studio): JsonResponse
    {
        abort_if(! $studio->is_active, 404);

        return response()->json($studio);
    }
}
